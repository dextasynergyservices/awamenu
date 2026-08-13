"use server";

import {
	AuditActorType,
	type PaymentChannel,
	type PaymentGateway,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { env } from "@/env";
import { recordAuditEvent } from "@/lib/audit";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { sendPayoutAccountChangedEmail } from "@/lib/email";
import {
	type GatewayCredentials,
	getGatewayAdapter,
} from "@/lib/payment-gateways";
import {
	AWAMENU_PAY_PROVIDERS,
	type AwamenuPayProvider,
	estimateGatewayFee,
	getGatewayDescriptor as getGatewayDescriptorCatalog,
} from "@/lib/payment-gateways/catalog";
import { enforceRateLimit, getClientIp } from "@/lib/ratelimit";
import { decryptSecret, encryptSecret } from "@/lib/secret-box";

/**
 * A gateway that can actually back AwaMenu Pay.
 *
 * Checked against the catalog's capability list rather than a hardcoded pair,
 * so a newly-added provider is accepted the moment its adapter exists — and one
 * that can't settle to a sub-merchant is rejected here rather than failing when
 * the subaccount call is made.
 */
const awamenuPayProviderSchema = z
	.enum(["PAYSTACK", "FLUTTERWAVE", "MONNIFY"])
	.refine((gateway) => AWAMENU_PAY_PROVIDERS.includes(gateway), {
		message: "That provider can't be used for AwaMenu Pay.",
	});

async function requireOwnedRestaurant(slug: string) {
	const user = await requireUser();
	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		select: { id: true, slug: true, name: true },
	});
	if (!restaurant) throw new Error("Restaurant not found.");
	return { user, restaurant };
}

/**
 * Platform credentials for one provider.
 *
 * Returns null rather than throwing when a provider isn't configured on this
 * deployment: an unconfigured provider should simply not be offered, not break
 * the settings page for everyone.
 */
function platformCredentialsFor(
	gateway: PaymentGateway,
	paystackSecretFromSettings?: string | null,
): GatewayCredentials | null {
	if (gateway === "MONNIFY") {
		const apiKey = env.MONNIFY_API_KEY;
		const monnifySecret = env.MONNIFY_SECRET_KEY;
		if (!apiKey || !monnifySecret) return null;
		return {
			// The adapter base64-encodes this pair for Monnify's OAuth2 login.
			secretKey: `${apiKey}:${monnifySecret}`,
			contractCode: env.MONNIFY_CONTRACT_CODE,
		};
	}

	// Falls back to the deployment's own key so AwaMenu Pay works before a
	// super-admin has saved anything in platform settings.
	const secretKey = paystackSecretFromSettings || env.PAYSTACK_SECRET_KEY;
	return secretKey ? { secretKey } : null;
}

/**
 * Platform-level settings that drive AwaMenu Pay.
 *
 * `allowedChannels` / `allowedPayProviders` / `allowedOwnGateways` are the
 * super-admin's shop window. Every write path below checks them, so hiding an
 * option in the super-admin also refuses it server-side rather than merely
 * removing the button.
 */
async function getPlatformPaymentConfig() {
	const settings = await db.platformSetting.findFirst({
		select: {
			awamenuPayCommissionPercent: true,
			paystackSecretKey: true,
			enabledPaymentChannels: true,
			awamenuPayProviders: true,
			ownGatewayProviders: true,
		},
	});

	// No platform row yet (a fresh deployment) means nothing has been restricted,
	// so everything is on — matching the column defaults.
	const allowedChannels: PaymentChannel[] =
		settings?.enabledPaymentChannels ?? [
			"AWAMENU_PAY",
			"OWN_GATEWAY",
			"BANK_TRANSFER",
			"CASH",
		];

	const allowedPayProviders = settings?.awamenuPayProviders ?? [
		...AWAMENU_PAY_PROVIDERS,
	];

	// Used only where a provider hasn't been named — the bank list and account
	// lookup for the manual Bank transfer channel, which isn't tied to any
	// provider but still needs one to ask. The first offered provider that has
	// credentials, so it can't point at something unusable.
	const defaultProvider: PaymentGateway =
		allowedPayProviders.find(
			(gateway) =>
				platformCredentialsFor(gateway, settings?.paystackSecretKey) !== null,
		) ?? "PAYSTACK";

	return {
		defaultProvider,
		commissionPercent: Number(settings?.awamenuPayCommissionPercent ?? 0),
		allowedChannels,
		allowedPayProviders,
		allowedOwnGateways: settings?.ownGatewayProviders ?? [
			"PAYSTACK" as const,
			"FLUTTERWAVE" as const,
			"MONNIFY" as const,
		],
		credentialsFor: (gateway: PaymentGateway) =>
			platformCredentialsFor(gateway, settings?.paystackSecretKey),
	};
}

/**
 * What this restaurant is allowed to set up.
 *
 * An AwaMenu Pay provider must clear two bars: the super-admin has to be
 * offering it, and the platform has to hold credentials for it — otherwise a
 * restaurant could start a connection that can only fail on the first API call.
 */
export async function listAvailablePaymentOptionsAction(input: {
	slug: string;
}) {
	await requireOwnedRestaurant(input.slug);
	const platform = await getPlatformPaymentConfig();

	return {
		channels: platform.allowedChannels,
		providers: AWAMENU_PAY_PROVIDERS.filter(
			(gateway) =>
				platform.allowedPayProviders.includes(gateway) &&
				platform.credentialsFor(gateway) !== null,
		),
		ownGateways: platform.allowedOwnGateways,
	};
}

/**
 * Banks are listed through whichever provider will actually create the
 * subaccount, because bank codes are provider-specific — a Paystack code is not
 * interchangeable with a Monnify one.
 */
export async function listBanksAction(input: {
	slug: string;
	gateway?: PaymentGateway;
}) {
	await requireOwnedRestaurant(input.slug);
	const platform = await getPlatformPaymentConfig();
	const gateway = input.gateway ?? platform.defaultProvider;
	const credentials = platform.credentialsFor(gateway);
	if (!credentials) {
		return { banks: [], error: "That provider isn't available right now." };
	}

	try {
		const banks = await getGatewayAdapter(gateway).listBanks(credentials);

		// Providers return duplicate codes — Paystack's NGN list has four, where
		// the same code appears under variant names. The code is what identifies
		// the bank for resolution, so the first entry wins; keeping both produced
		// duplicate React keys in the picker and let the user select an option
		// that couldn't be told apart from its twin.
		const seen = new Set<string>();
		const unique = banks.filter((bank) => {
			if (seen.has(bank.code)) return false;
			seen.add(bank.code);
			return true;
		});

		return { banks: unique.sort((a, b) => a.name.localeCompare(b.name)) };
	} catch {
		return { banks: [], error: "Couldn't load the bank list. Please retry." };
	}
}

const resolveSchema = z.object({
	slug: z.string().min(1),
	gateway: z.enum(["PAYSTACK", "FLUTTERWAVE", "MONNIFY"]).optional(),
	bankCode: z.string().min(1).max(10),
	accountNumber: z
		.string()
		.regex(/^\d{10}$/, "Enter the 10-digit account number."),
});

/**
 * Resolves an account number to its registered name.
 *
 * Rate limited: this is an unauthenticated-looking lookup against a third party
 * and would otherwise let a signed-in user enumerate account names.
 */
export async function resolveAccountAction(input: {
	slug: string;
	gateway?: PaymentGateway;
	bankCode: string;
	accountNumber: string;
}): Promise<{ accountName: string } | { error: string }> {
	const parsed = resolveSchema.safeParse(input);
	if (!parsed.success) {
		return { error: parsed.error.issues[0]?.message ?? "Invalid details." };
	}

	const { restaurant } = await requireOwnedRestaurant(parsed.data.slug);

	try {
		await enforceRateLimit(
			"admin",
			`resolve:${restaurant.id}:${await getClientIp()}`,
		);
	} catch {
		return { error: "Too many lookups. Please wait a moment." };
	}

	const platform = await getPlatformPaymentConfig();
	const gateway = parsed.data.gateway ?? platform.defaultProvider;
	const credentials = platform.credentialsFor(gateway);
	if (!credentials) {
		return { error: "That provider isn't available right now." };
	}

	try {
		const resolved = await getGatewayAdapter(gateway).resolveAccount(
			credentials,
			{
				bankCode: parsed.data.bankCode,
				accountNumber: parsed.data.accountNumber,
			},
		);
		return { accountName: resolved.accountName };
	} catch {
		return {
			error: "We couldn't verify that account. Check the number and bank.",
		};
	}
}

const toggleSchema = z.object({
	slug: z.string().min(1),
	channel: z.enum(["AWAMENU_PAY", "OWN_GATEWAY", "BANK_TRANSFER", "CASH"]),
	isEnabled: z.boolean(),
});

export async function togglePaymentChannelAction(input: {
	slug: string;
	channel: PaymentChannel;
	isEnabled: boolean;
}): Promise<{ ok: true } | { error: string }> {
	const parsed = toggleSchema.parse(input);
	const { restaurant } = await requireOwnedRestaurant(parsed.slug);

	const platform = await getPlatformPaymentConfig();
	if (parsed.isEnabled && !platform.allowedChannels.includes(parsed.channel)) {
		return { error: "That payment option isn't available on AwaMenu." };
	}

	const existing = await db.restaurantPaymentMethod.findUnique({
		where: {
			restaurantId_channel: {
				restaurantId: restaurant.id,
				channel: parsed.channel,
			},
		},
		select: {
			subaccountCode: true,
			secretKeyEncrypted: true,
			accountNumber: true,
		},
	});

	// Enabling a channel that isn't configured would silently offer customers a
	// payment option that can't complete, so it's blocked with a clear reason.
	if (parsed.isEnabled) {
		if (parsed.channel === "AWAMENU_PAY") {
			const connected = await db.restaurantPayoutAccount.count({
				where: { restaurantId: restaurant.id, isEnabled: true },
			});
			if (connected === 0) {
				return {
					error:
						"Connect at least one provider below before enabling AwaMenu Pay.",
				};
			}
		}
		if (parsed.channel === "OWN_GATEWAY" && !existing?.secretKeyEncrypted) {
			return {
				error: "Connect your gateway keys before enabling this option.",
			};
		}
		if (parsed.channel === "BANK_TRANSFER" && !existing?.accountNumber) {
			return { error: "Add the account customers should transfer to first." };
		}
	}

	await db.restaurantPaymentMethod.upsert({
		where: {
			restaurantId_channel: {
				restaurantId: restaurant.id,
				channel: parsed.channel,
			},
		},
		create: {
			restaurantId: restaurant.id,
			channel: parsed.channel,
			isEnabled: parsed.isEnabled,
		},
		update: { isEnabled: parsed.isEnabled },
	});

	revalidatePath(`/dashboard/${restaurant.slug}/settings`);
	return { ok: true };
}

const bankDetailsSchema = z.object({
	slug: z.string().min(1),
	bankCode: z.string().min(1).max(10),
	bankName: z.string().min(1).max(120),
	accountNumber: z.string().regex(/^\d{10}$/),
	accountName: z.string().min(1).max(160),
});

/** Saves the account customers transfer to manually. No provider involved. */
export async function saveBankDetailsAction(input: {
	slug: string;
	bankCode: string;
	bankName: string;
	accountNumber: string;
	accountName: string;
}): Promise<{ ok: true } | { error: string }> {
	const parsed = bankDetailsSchema.safeParse(input);
	if (!parsed.success) return { error: "Please complete the account details." };

	const { restaurant } = await requireOwnedRestaurant(parsed.data.slug);
	const data = parsed.data;

	await db.restaurantPaymentMethod.upsert({
		where: {
			restaurantId_channel: {
				restaurantId: restaurant.id,
				channel: "BANK_TRANSFER",
			},
		},
		create: {
			restaurantId: restaurant.id,
			channel: "BANK_TRANSFER",
			bankCode: data.bankCode,
			bankName: data.bankName,
			accountNumber: data.accountNumber,
			accountName: data.accountName,
		},
		update: {
			bankCode: data.bankCode,
			bankName: data.bankName,
			accountNumber: data.accountNumber,
			accountName: data.accountName,
		},
	});

	revalidatePath(`/dashboard/${restaurant.slug}/settings`);
	return { ok: true };
}

const connectPayoutSchema = z.object({
	slug: z.string().min(1),
	gateway: awamenuPayProviderSchema,
	bankCode: z.string().min(1).max(10),
	bankName: z.string().min(1).max(120),
	accountNumber: z.string().regex(/^\d{10}$/),
	accountName: z.string().min(1).max(160),
});

/**
 * Connects one AwaMenu Pay provider for a restaurant.
 *
 * Creating the subaccount is what makes settlement go direct to the restaurant
 * rather than through AwaMenu — funds never touch the platform balance. Each
 * provider is connected independently, so a restaurant can offer Paystack,
 * Monnify, or both, and the customer picks at checkout.
 */
export async function connectPayoutAccountAction(input: {
	slug: string;
	gateway: AwamenuPayProvider;
	bankCode: string;
	bankName: string;
	accountNumber: string;
	accountName: string;
}): Promise<{ ok: true } | { error: string }> {
	const parsed = connectPayoutSchema.safeParse(input);
	if (!parsed.success) return { error: "Please complete the account details." };

	const { user, restaurant } = await requireOwnedRestaurant(parsed.data.slug);
	const data = parsed.data;

	const platform = await getPlatformPaymentConfig();
	const credentials = platform.credentialsFor(data.gateway);
	// Both bars: the super-admin must be offering it, and credentials must exist.
	if (!credentials || !platform.allowedPayProviders.includes(data.gateway)) {
		return {
			error: `${getGatewayDescriptorCatalog(data.gateway).label} isn't available on AwaMenu right now.`,
		};
	}
	if (!platform.allowedChannels.includes("AWAMENU_PAY")) {
		return { error: "AwaMenu Pay isn't available right now." };
	}

	let subaccountCode: string;
	try {
		const created = await getGatewayAdapter(data.gateway).createSubaccount(
			credentials,
			{
				businessName: `AwaMenu — ${restaurant.name}`,
				bankCode: data.bankCode,
				accountNumber: data.accountNumber,
				platformCommissionPercent: platform.commissionPercent,
				email: user.email,
			},
		);
		subaccountCode = created.subaccountCode;
	} catch (error) {
		return {
			error:
				error instanceof Error
					? error.message
					: "Couldn't set up your settlement account. Please try again.",
		};
	}

	// Read before writing so the audit entry can say what it changed FROM.
	// Redirecting settlement to a different account is the classic insider-fraud
	// path — every payment afterwards leaves quietly and nothing looks broken —
	// so this is recorded and the owner is told, whoever made the change.
	const previous = await db.restaurantPayoutAccount.findUnique({
		where: {
			restaurantId_gateway: {
				restaurantId: restaurant.id,
				gateway: data.gateway,
			},
		},
		select: { bankName: true, accountNumber: true, accountName: true },
	});

	await db.restaurantPayoutAccount.upsert({
		where: {
			restaurantId_gateway: {
				restaurantId: restaurant.id,
				gateway: data.gateway,
			},
		},
		create: {
			restaurantId: restaurant.id,
			gateway: data.gateway,
			bankCode: data.bankCode,
			bankName: data.bankName,
			accountNumber: data.accountNumber,
			accountName: data.accountName,
			subaccountCode,
		},
		update: {
			bankCode: data.bankCode,
			bankName: data.bankName,
			accountNumber: data.accountNumber,
			accountName: data.accountName,
			subaccountCode,
			isEnabled: true,
		},
	});

	const describe = (account: {
		bankName: string;
		accountNumber: string;
		accountName: string;
	}) =>
		// Only the last four digits. An audit trail is read by more people than
		// the settings page, and it does not need the whole account number to
		// answer "did this change, and to what".
		`${account.bankName} ••••${account.accountNumber.slice(-4)} (${account.accountName})`;

	const nextDescription = describe(data);
	const previousDescription = previous ? describe(previous) : null;

	if (previousDescription !== nextDescription) {
		await recordAuditEvent({
			restaurantId: restaurant.id,
			actorType: AuditActorType.OWNER,
			actorId: user.id,
			actorName: user.name ?? user.email ?? "Owner",
			action: previous ? "payout.account_changed" : "payout.account_connected",
			target: getGatewayDescriptorCatalog(data.gateway).label,
			previousValue: previousDescription,
			newValue: nextDescription,
		});

		if (previous) {
			await sendPayoutAccountChangedEmail({
				to: user.email,
				restaurantName: restaurant.name,
				previous: previousDescription ?? "—",
				next: nextDescription,
			});
		}
	}

	revalidatePath(`/dashboard/${restaurant.slug}/settings`);
	return { ok: true };
}

/**
 * Turns one connected provider on or off at checkout.
 *
 * The subaccount is kept either way — Paystack has no delete endpoint, and an
 * owner toggling a provider off for a week shouldn't have to re-verify their
 * bank account to turn it back on.
 */
export async function togglePayoutProviderAction(input: {
	slug: string;
	gateway: AwamenuPayProvider;
	isEnabled: boolean;
}): Promise<{ ok: true } | { error: string }> {
	const parsed = z
		.object({
			slug: z.string().min(1),
			gateway: awamenuPayProviderSchema,
			isEnabled: z.boolean(),
		})
		.safeParse(input);
	if (!parsed.success) return { error: "Invalid request." };

	const { restaurant } = await requireOwnedRestaurant(parsed.data.slug);

	const account = await db.restaurantPayoutAccount.findUnique({
		where: {
			restaurantId_gateway: {
				restaurantId: restaurant.id,
				gateway: parsed.data.gateway,
			},
		},
		select: { id: true },
	});
	if (!account) return { error: "Connect this provider first." };

	// Turning off the last one would leave AwaMenu Pay enabled with nothing
	// behind it, so the channel goes off with it rather than failing at checkout.
	if (!parsed.data.isEnabled) {
		const remaining = await db.restaurantPayoutAccount.count({
			where: {
				restaurantId: restaurant.id,
				isEnabled: true,
				NOT: { id: account.id },
			},
		});
		if (remaining === 0) {
			await db.restaurantPaymentMethod.updateMany({
				where: { restaurantId: restaurant.id, channel: "AWAMENU_PAY" },
				data: { isEnabled: false },
			});
		}
	}

	await db.restaurantPayoutAccount.update({
		where: { id: account.id },
		data: { isEnabled: parsed.data.isEnabled },
	});

	revalidatePath(`/dashboard/${restaurant.slug}/settings`);
	return { ok: true };
}

const ownGatewaySchema = z.object({
	slug: z.string().min(1),
	gateway: z.enum(["PAYSTACK", "FLUTTERWAVE", "MONNIFY"]),
	publicKey: z.string().max(200).optional(),
	secretKey: z.string().min(8).max(300),
	contractCode: z.string().max(60).optional(),
});

/**
 * Connects a restaurant's own gateway.
 *
 * The keys are tested against the provider before they're stored, so a typo
 * surfaces here rather than at a customer's first checkout, and the secret is
 * encrypted at rest — it is never returned to the browser afterwards.
 */
export async function saveOwnGatewayAction(input: {
	slug: string;
	gateway: PaymentGateway;
	publicKey?: string;
	secretKey: string;
	contractCode?: string;
}): Promise<{ ok: true } | { error: string }> {
	const parsed = ownGatewaySchema.safeParse(input);
	if (!parsed.success) {
		return { error: parsed.error.issues[0]?.message ?? "Invalid credentials." };
	}

	const { restaurant } = await requireOwnedRestaurant(parsed.data.slug);
	const data = parsed.data;

	const platform = await getPlatformPaymentConfig();
	if (
		!platform.allowedChannels.includes("OWN_GATEWAY") ||
		!platform.allowedOwnGateways.includes(data.gateway)
	) {
		return {
			error: `${getGatewayDescriptorCatalog(data.gateway).label} can't be connected on AwaMenu right now.`,
		};
	}

	const credentials: GatewayCredentials = {
		secretKey: data.secretKey,
		publicKey: data.publicKey,
		contractCode: data.contractCode,
	};

	const works = await getGatewayAdapter(data.gateway).testCredentials(
		credentials,
	);
	if (!works) {
		return {
			error:
				"Those keys were rejected by the provider. Double-check you copied the live keys.",
		};
	}

	await db.restaurantPaymentMethod.upsert({
		where: {
			restaurantId_channel: {
				restaurantId: restaurant.id,
				channel: "OWN_GATEWAY",
			},
		},
		create: {
			restaurantId: restaurant.id,
			channel: "OWN_GATEWAY",
			gateway: data.gateway,
			publicKey: data.publicKey,
			secretKeyEncrypted: encryptSecret(data.secretKey),
			contractCode: data.contractCode,
			lastVerifiedAt: new Date(),
		},
		update: {
			gateway: data.gateway,
			publicKey: data.publicKey,
			secretKeyEncrypted: encryptSecret(data.secretKey),
			contractCode: data.contractCode,
			lastVerifiedAt: new Date(),
		},
	});

	revalidatePath(`/dashboard/${restaurant.slug}/settings`);
	return { ok: true };
}

/**
 * Credentials that can refund a charge this restaurant took.
 *
 * A refund has to go back through whichever account was actually billed: the
 * restaurant's own keys if they used them, otherwise the platform's. Sending it
 * through the wrong one either fails or refunds from the wrong balance.
 */
export async function resolveRefundCredentials(
	restaurantId: string,
	gateway: PaymentGateway,
): Promise<GatewayCredentials | null> {
	const own = await db.restaurantPaymentMethod.findFirst({
		where: {
			restaurantId,
			channel: "OWN_GATEWAY",
			gateway,
			NOT: { secretKeyEncrypted: null },
		},
		select: { secretKeyEncrypted: true, contractCode: true },
	});

	if (own?.secretKeyEncrypted) {
		// An undecryptable key means the encryption secret changed. Falling back
		// to the platform account would refund from the wrong balance, so this
		// stops instead.
		const secretKey = decryptSecret(own.secretKeyEncrypted);
		if (!secretKey) return null;
		return { secretKey, contractCode: own.contractCode ?? undefined };
	}

	const platform = await getPlatformPaymentConfig();
	return platform.credentialsFor(gateway);
}

export type CheckoutGatewayOption = {
	gateway: PaymentGateway;
	credentials: GatewayCredentials;
	subaccountCode?: string;
	platformChargeKobo?: number;
};

/**
 * Every online option a customer can be offered for this restaurant.
 *
 * Own gateway wins outright when connected — a restaurant that supplied their
 * own keys expects the money in that account, and there's nothing to choose
 * between. Otherwise every enabled AwaMenu Pay provider is returned, and the
 * customer picks one at checkout.
 */
export async function listCheckoutGateways(
	restaurantId: string,
	amountKobo?: number,
): Promise<CheckoutGatewayOption[]> {
	const platform = await getPlatformPaymentConfig();

	const own = platform.allowedChannels.includes("OWN_GATEWAY")
		? await db.restaurantPaymentMethod.findFirst({
				where: { restaurantId, channel: "OWN_GATEWAY", isEnabled: true },
			})
		: null;
	if (own?.secretKeyEncrypted && own.gateway) {
		const secretKey = decryptSecret(own.secretKeyEncrypted);
		if (secretKey) {
			return [
				{
					gateway: own.gateway,
					credentials: {
						secretKey,
						publicKey: own.publicKey ?? undefined,
						contractCode: own.contractCode ?? undefined,
					},
				},
			];
		}
	}

	if (!platform.allowedChannels.includes("AWAMENU_PAY")) return [];

	const channel = await db.restaurantPaymentMethod.findFirst({
		where: { restaurantId, channel: "AWAMENU_PAY", isEnabled: true },
		select: { id: true },
	});
	if (!channel) return [];

	const accounts = await db.restaurantPayoutAccount.findMany({
		where: { restaurantId, isEnabled: true },
		orderBy: { createdAt: "asc" },
	});
	if (accounts.length === 0) return [];

	return accounts.flatMap((account) => {
		const credentials = platform.credentialsFor(account.gateway);
		// A provider the super-admin has since pulled, or whose platform
		// credentials were removed, must not be offered — the charge would fail
		// after the customer had already committed to paying.
		if (
			!credentials ||
			!platform.allowedPayProviders.includes(account.gateway)
		) {
			return [];
		}

		// The platform account is billed by the provider, so the provider's fee
		// plus any commission is taken back out of this transaction and routed to
		// the platform. The subaccount keeps the remainder — which is exactly the
		// "you receive" figure shown in the restaurant's payment settings.
		let platformChargeKobo: number | undefined;
		if (amountKobo && amountKobo > 0) {
			const amountNaira = amountKobo / 100;
			const fees = getGatewayDescriptorCatalog(account.gateway).fees;
			const providerFee = estimateGatewayFee(amountNaira, fees);
			const commission = (amountNaira * platform.commissionPercent) / 100;
			// Never let the deduction exceed the order itself.
			platformChargeKobo = Math.min(
				amountKobo,
				Math.round((providerFee + commission) * 100),
			);
		}

		return [
			{
				gateway: account.gateway,
				credentials,
				subaccountCode: account.subaccountCode,
				platformChargeKobo,
			},
		];
	});
}

/**
 * Picks the one gateway a charge will actually run through.
 *
 * `preferred` is what the customer chose at checkout; it's honoured only if
 * it's genuinely on offer, so a tampered form field can't route a payment
 * through a provider this restaurant never connected.
 */
export async function resolveCheckoutGateway(
	restaurantId: string,
	amountKobo?: number,
	preferred?: PaymentGateway | null,
): Promise<CheckoutGatewayOption | null> {
	const options = await listCheckoutGateways(restaurantId, amountKobo);
	if (options.length === 0) return null;
	return (
		(preferred && options.find((o) => o.gateway === preferred)) ||
		options[0] ||
		null
	);
}

/** The online options a public checkout page should show. Never returns keys. */
export async function listPublicCheckoutProviders(restaurantId: string) {
	const options = await listCheckoutGateways(restaurantId);
	return options.map((option) => ({
		gateway: option.gateway,
		label: getGatewayDescriptorCatalog(option.gateway).label,
		checkoutMethods: getGatewayDescriptorCatalog(option.gateway)
			.checkoutMethods,
	}));
}
