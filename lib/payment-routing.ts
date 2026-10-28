import type { PaymentChannel, PaymentGateway } from "@prisma/client";
import { env } from "@/env";
import { getRestaurantCommission } from "@/lib/commission";
import { db } from "@/lib/db";
import type { GatewayCredentials } from "@/lib/payment-gateways";
import {
	AWAMENU_PAY_PROVIDERS,
	estimateGatewayFee,
	getGatewayDescriptor as getGatewayDescriptorCatalog,
} from "@/lib/payment-gateways/catalog";
import { decryptSecret, isEncryptedSecret } from "@/lib/secret-box";

/**
 * Which gateway, and whose keys, a charge runs through.
 *
 * Server-only by construction: these functions return *decrypted gateway
 * secret keys*. They used to live in actions/payment-settings.actions.ts, a
 * "use server" file — and every export of such a file is a server action a
 * browser can invoke with arguments of its choosing. A plain module like this
 * one is only reachable from server code.
 */

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
	// super-admin has saved anything in platform settings. Saved keys are
	// encrypted; one saved before that change is still read as-is.
	const fromSettings = paystackSecretFromSettings
		? isEncryptedSecret(paystackSecretFromSettings)
			? decryptSecret(paystackSecretFromSettings)
			: paystackSecretFromSettings
		: null;
	const secretKey = fromSettings || env.PAYSTACK_SECRET_KEY;
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
export async function getPlatformPaymentConfig() {
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
	/** The restaurant's own keys rather than the platform's. */
	ownGateway: boolean;
	credentials: GatewayCredentials;
	subaccountCode?: string;
	platformChargeKobo?: number;
	/** The AwaMenu Pay commission rate this charge is made at. */
	commissionPercent?: number;
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
					ownGateway: true,
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

	// Platform rate, or this restaurant's custom/exempt rate (lib/commission.ts).
	const commission = await getRestaurantCommission(
		restaurantId,
		platform.commissionPercent,
	);

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
			const commissionNaira = (amountNaira * commission.percent) / 100;
			// Never let the deduction exceed the order itself.
			platformChargeKobo = Math.min(
				amountKobo,
				Math.round((providerFee + commissionNaira) * 100),
			);
		}

		return [
			{
				gateway: account.gateway,
				ownGateway: false,
				credentials,
				subaccountCode: account.subaccountCode,
				platformChargeKobo,
				commissionPercent: commission.percent,
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

/**
 * The keys a recorded checkout must be verified with: the same account it was
 * charged on. Decided by what the attempt recorded at checkout, not by the
 * restaurant's settings now — an owner who has since switched gateways must
 * not make an earlier payment unverifiable.
 */
export async function credentialsForAttempt(attempt: {
	gateway: PaymentGateway;
	ownGateway: boolean;
	restaurantId: string | null;
}): Promise<GatewayCredentials | null> {
	if (attempt.ownGateway) {
		if (!attempt.restaurantId) return null;
		const own = await db.restaurantPaymentMethod.findFirst({
			where: {
				restaurantId: attempt.restaurantId,
				channel: "OWN_GATEWAY",
				gateway: attempt.gateway,
				NOT: { secretKeyEncrypted: null },
			},
			select: { secretKeyEncrypted: true, contractCode: true },
		});
		const secretKey = own?.secretKeyEncrypted
			? decryptSecret(own.secretKeyEncrypted)
			: null;
		return secretKey
			? { secretKey, contractCode: own?.contractCode ?? undefined }
			: null;
	}

	const platform = await getPlatformPaymentConfig();
	return platform.credentialsFor(attempt.gateway);
}
