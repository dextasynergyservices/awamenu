import crypto from "node:crypto";
import type { PaymentGateway } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/env";
import {
	type BillingIntervalValue,
	getPlanIntervalPrice,
	getPlanPaystackCode,
	parseBillingInterval,
} from "@/lib/billing";
import { db } from "@/lib/db";
import {
	awamenuMetadata,
	createPaymentAttempt,
	isAwamenuReference,
	recordProviderReference,
	verifyPaymentAttempt,
} from "@/lib/payment-attempts";
import { getGatewayAdapter } from "@/lib/payment-gateways";
import {
	getPlatformPaymentConfig,
	resolveCheckoutGateway,
} from "@/lib/payment-routing";

/**
 * Starting and confirming checkouts.
 *
 * Every checkout is recorded as a PaymentAttempt with a reference we generate
 * before the customer leaves for the provider (see lib/payment-attempts.ts).
 * Confirmation never depends on a webhook arriving: the return page and the
 * payments cron both verify the attempt by reference against the account it
 * was charged on.
 */

type PaystackSubscriptionParams = {
	userId: string;
	planId: string;
	customerEmail: string;
	billingInterval?: BillingIntervalValue;
	/** Present when upgrading/downgrading an existing restaurant's plan
	 * (as opposed to the onboarding flow, where the restaurant doesn't
	 * exist yet) — lets verification target the right subscription row. */
	restaurantId?: string;
};

const NO_ONLINE_PAYMENTS =
	"This restaurant hasn't set up online payments yet. Please choose cash or bank transfer.";

/**
 * Starts a charge for a restaurant through whichever channel it configured,
 * recording the attempt first.
 *
 * There is deliberately no fallback to the platform's own Paystack account.
 * That charged the customer into AwaMenu's balance with no subaccount and no
 * split — money settled to AwaMenu's bank with nothing tying it to the
 * restaurant, which also makes AwaMenu a holder of other people's money, a
 * regulated activity.
 */
async function startRestaurantCharge(params: {
	restaurantId: string;
	amountKobo: number;
	email: string;
	callbackUrl: string;
	preferredGateway?: PaymentGateway | null;
	metadata: Record<string, unknown>;
	target:
		| { kind: "ORDER"; orderId: string }
		| {
				kind: "RESERVATION";
				reservationId: string;
		  };
}) {
	const routed = await resolveCheckoutGateway(
		params.restaurantId,
		params.amountKobo,
		params.preferredGateway,
	);
	if (!routed) throw new Error(NO_ONLINE_PAYMENTS);

	const attempt = await createPaymentAttempt({
		...params.target,
		gateway: routed.gateway,
		ownGateway: routed.ownGateway,
		amountKobo: params.amountKobo,
		restaurantId: params.restaurantId,
		commissionPercent: routed.ownGateway
			? null
			: (routed.commissionPercent ?? null),
		platformChargeKobo: routed.ownGateway
			? null
			: (routed.platformChargeKobo ?? null),
	});

	const result = await getGatewayAdapter(routed.gateway).initializeCharge(
		routed.credentials,
		{
			amountKobo: params.amountKobo,
			email: params.email,
			reference: attempt.reference,
			callbackUrl: params.callbackUrl,
			metadata: awamenuMetadata(params.metadata, attempt.reference),
			subaccountCode: routed.subaccountCode,
			// Verified against the live Paystack API: `bearer: "subaccount"` is
			// rejected with "Invalid split transaction values" at every
			// percentage_charge, so the platform account is billed by Paystack and
			// recovers the fee through `transaction_charge` below. Changing this
			// back will break every AwaMenu Pay checkout.
			feeBearer: "platform",
			platformChargeKobo: routed.platformChargeKobo,
		},
	);

	// Monnify names the transaction itself; verification must use its id.
	if (result.reference && result.reference !== attempt.reference) {
		await recordProviderReference(attempt.id, result.reference);
	}

	return result.authorizationUrl;
}

export async function initiateOrderPaymentForRestaurant(params: {
	restaurantId: string;
	orderId: string;
	restaurantSlug: string;
	customerName: string;
	customerEmail?: string | null;
	amountKobo: number;
	/** What the customer picked when the restaurant offers more than one. */
	preferredGateway?: PaymentGateway | null;
}) {
	return startRestaurantCharge({
		restaurantId: params.restaurantId,
		amountKobo: params.amountKobo,
		email: params.customerEmail || `${params.orderId}@orders.awamenu.com`,
		// One return route for every provider; it reads each one's parameter.
		callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/${params.restaurantSlug}/order/${params.orderId}/paystack-return`,
		preferredGateway: params.preferredGateway,
		metadata: {
			type: "ORDER",
			orderId: params.orderId,
			customerName: params.customerName,
		},
		target: { kind: "ORDER", orderId: params.orderId },
	});
}

/**
 * Starts a reservation deposit/payment.
 *
 * Routed exactly like an order, so the money settles to the restaurant. It used
 * to be charged straight to the platform Paystack account with no subaccount.
 */
export async function initiateReservationPayment(params: {
	restaurantId: string;
	reservationId: string;
	restaurantSlug: string;
	customerName: string;
	customerEmail?: string | null;
	amountKobo: number;
}) {
	return startRestaurantCharge({
		restaurantId: params.restaurantId,
		amountKobo: params.amountKobo,
		email:
			params.customerEmail ||
			`${params.reservationId}@reservations.awamenu.com`,
		callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/${params.restaurantSlug}/reservation/${params.reservationId}`,
		metadata: {
			type: "RESERVATION_PAYMENT",
			reservationId: params.reservationId,
			customerName: params.customerName,
		},
		target: { kind: "RESERVATION", reservationId: params.reservationId },
	});
}

/** The platform's Paystack account, for AwaMenu's own billing. */
async function platformPaystackCredentials() {
	const platform = await getPlatformPaymentConfig();
	const credentials = platform.credentialsFor("PAYSTACK");
	if (!credentials) throw new Error("PAYSTACK_SECRET_KEY is required");
	return credentials;
}

export async function initiateSubscriptionPayment(
	params: PaystackSubscriptionParams & { callbackUrl?: string },
) {
	const plan = await db.plan.findUniqueOrThrow({
		where: { id: params.planId },
	});
	const billingInterval = parseBillingInterval(params.billingInterval);
	const amountKobo = Math.round(
		getPlanIntervalPrice(plan, billingInterval) * 100,
	);
	const paystackPlanCode = getPlanPaystackCode(plan, billingInterval);

	const attempt = await createPaymentAttempt({
		kind: "SUBSCRIPTION",
		gateway: "PAYSTACK",
		amountKobo,
		userId: params.userId,
		planId: params.planId,
		billingInterval,
		restaurantId: params.restaurantId ?? null,
	});

	const res = await fetch("https://api.paystack.co/transaction/initialize", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${(await platformPaystackCredentials()).secretKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			email: params.customerEmail,
			amount: amountKobo,
			reference: attempt.reference,
			plan: paystackPlanCode,
			callback_url:
				params.callbackUrl ||
				`${env.NEXT_PUBLIC_APP_URL}/onboarding/setup?planId=${params.planId}&billing=${billingInterval}`,
			metadata: awamenuMetadata(
				{
					type: "SUBSCRIPTION",
					userId: params.userId,
					planId: params.planId,
					billingInterval,
					restaurantId: params.restaurantId,
				},
				attempt.reference,
			),
		}),
		signal: AbortSignal.timeout(15_000),
	});

	const payload = await res.json();

	if (!res.ok || !payload?.data?.authorization_url) {
		throw new Error("Unable to initialize subscription payment.");
	}

	return payload.data.authorization_url as string;
}

export async function initiateCardAddPayment(params: {
	userId: string;
	customerEmail: string;
	callbackUrl?: string;
}) {
	const res = await fetch("https://api.paystack.co/transaction/initialize", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${(await platformPaystackCredentials()).secretKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			email: params.customerEmail,
			amount: 5000,
			channels: ["card"],
			// Tagged like every AwaMenu charge so it is identifiable on the
			// shared Paystack account, though it settles nothing here.
			reference: `AWM-CARD-${crypto.randomBytes(6).toString("hex").toUpperCase()}`,
			callback_url: params.callbackUrl,
			metadata: { type: "ADD_CARD", userId: params.userId, app: "awamenu" },
		}),
		signal: AbortSignal.timeout(15_000),
	});

	const payload = await res.json();

	if (!res.ok || !payload?.data?.authorization_url) {
		throw new Error("Unable to initialize card binding payment.");
	}

	return payload.data.authorization_url as string;
}

/**
 * Return-page confirmation for an order.
 *
 * Checks the attempt belongs to this order — the reference arrives in a URL
 * anyone can edit — then verifies through the account it was charged on. This
 * used to verify every order against the platform Paystack key, so orders paid
 * through a restaurant's own keys, or through Monnify, could never confirm.
 */
export async function verifyOrderPaymentReference(params: {
	reference: string;
	orderId: string;
}) {
	if (!isAwamenuReference(params.reference)) return false;
	const attempt = await db.paymentAttempt.findUnique({
		where: { reference: params.reference },
	});
	if (attempt?.kind !== "ORDER" || attempt.orderId !== params.orderId) {
		return false;
	}

	const result = await verifyPaymentAttempt(attempt);
	return result.state === "SETTLED" && result.outcome === "CREDITED";
}

export async function verifyReservationPaymentReference(params: {
	reference: string;
	reservationId: string;
}) {
	if (!isAwamenuReference(params.reference)) return false;
	const attempt = await db.paymentAttempt.findUnique({
		where: { reference: params.reference },
	});
	if (
		attempt?.kind !== "RESERVATION" ||
		attempt.reservationId !== params.reservationId
	) {
		return false;
	}

	const result = await verifyPaymentAttempt(attempt);
	return (
		result.state === "SETTLED" &&
		["CONFIRMED", "ALREADY_CONFIRMED", "REINSTATED"].includes(result.outcome)
	);
}

/**
 * Return-page confirmation for a subscription checkout.
 *
 * The attempt row says who bought which plan; the URL's planId and the
 * provider's metadata are only checked against it, never trusted.
 */
export async function verifySubscriptionPaymentReference(params: {
	reference: string;
	userId: string;
	planId: string;
	billingInterval?: BillingIntervalValue;
	restaurantId?: string;
}) {
	if (!isAwamenuReference(params.reference)) return false;
	const attempt = await db.paymentAttempt.findUnique({
		where: { reference: params.reference },
	});
	if (
		attempt?.kind !== "SUBSCRIPTION" ||
		attempt.userId !== params.userId ||
		attempt.planId !== params.planId ||
		(attempt.restaurantId ?? null) !== (params.restaurantId ?? null)
	) {
		return false;
	}

	const result = await verifyPaymentAttempt(attempt);
	return result.state === "SETTLED" && result.outcome === "APPLIED";
}

/**
 * Paystack signs `x-paystack-signature` with the account's **secret key** —
 * there is no separate webhook secret in Paystack. Verifying against
 * PAYSTACK_WEBHOOK_SECRET alone rejected every genuine webhook whenever that
 * variable held anything else.
 *
 * The secret key is tried first; PAYSTACK_WEBHOOK_SECRET is still accepted so
 * an environment that set it to the secret key keeps working.
 */
export function verifyPaystackWebhook(body: string, sig: string): boolean {
	const candidates = [env.PAYSTACK_SECRET_KEY, env.PAYSTACK_WEBHOOK_SECRET]
		.filter((value): value is string => Boolean(value))
		// A public key (pk_…) is never a signing key: it's sent to every
		// customer's browser, so accepting it would let anyone sign a webhook.
		.filter((value) => {
			if (!value.startsWith("pk_")) return true;
			Sentry.captureMessage(
				"A Paystack public key is configured as a webhook secret and was ignored",
				{ level: "error" },
			);
			return false;
		})
		.filter((value, index, all) => all.indexOf(value) === index);

	if (candidates.length === 0) {
		throw new Error("PAYSTACK_SECRET_KEY is required");
	}
	if (!/^[0-9a-f]+$/i.test(sig)) return false;

	return candidates.some((secret) => hmacMatches(secret, body, sig));
}

function hmacMatches(secret: string, body: string, sig: string) {
	const hash = crypto.createHmac("sha512", secret).update(body).digest("hex");
	const hashBuffer = Buffer.from(hash, "hex");
	const sigBuffer = Buffer.from(sig, "hex");
	if (hashBuffer.length !== sigBuffer.length) return false;
	return crypto.timingSafeEqual(hashBuffer, sigBuffer);
}

/**
 * The checkout reference a provider appended to our return URL. Each names it
 * differently: Paystack `reference`/`trxref`, Flutterwave `tx_ref`, Monnify
 * `paymentReference`. Only our own references are accepted.
 */
export function referenceFromReturnParams(
	params: Record<string, string | string[] | undefined> | undefined,
): string | null {
	if (!params) return null;
	for (const key of ["reference", "trxref", "tx_ref", "paymentReference"]) {
		const raw = params[key];
		const value = Array.isArray(raw) ? raw[0] : raw;
		if (value && isAwamenuReference(value)) return value;
	}
	return null;
}
