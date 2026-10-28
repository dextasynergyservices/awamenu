import {
	type BillingInterval,
	NotificationAudience,
	NotificationType,
	OrderStatus,
	type PaymentAttempt,
	type PaymentAttemptKind,
	type PaymentGateway,
} from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { customAlphabet } from "nanoid";
import { parseBillingInterval } from "@/lib/billing";
import { db } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";
import { notifyOrderConfirmed, notifyOrderPaid } from "@/lib/order-emails";
import { notifyCustomerOrderStatus } from "@/lib/order-messaging";
import { notifyNewOrder } from "@/lib/order-notifications";
import { getGatewayAdapter } from "@/lib/payment-gateways";
import { creditOrder } from "@/lib/payment-ledger";
import { credentialsForAttempt } from "@/lib/payment-routing";
import { settleReservationPayment } from "@/lib/reservation-payments";
import { applySubscriptionCharge } from "@/lib/subscription-payments";

/**
 * Payment attempts: confirming payments without relying on webhooks.
 *
 * The Paystack account is shared with another project and allows a single
 * webhook URL, which points there. Restaurants on their own gateway keys send
 * webhooks to their own accounts. So AwaMenu cannot assume a webhook will ever
 * arrive, and instead:
 *
 * 1. **Tags** every checkout with a reference of its own (`AWM-…`) and
 *    `metadata.app = "awamenu"`, so its payments are identifiable on the shared
 *    account and can never be confused with the other project's.
 * 2. **Records** the attempt before redirecting the customer — what it pays for,
 *    the amount, the gateway, and whose keys.
 * 3. **Settles** it from whichever signal comes first: the customer returning
 *    from checkout, the payments cron verifying pending attempts by reference,
 *    or a webhook if one is ever forwarded. Settlement is idempotent, so all
 *    three can fire for one payment safely.
 *
 * What a charge is *for* always comes from the attempt row, never from the
 * provider's metadata — anyone with the public key can initialise a Paystack
 * transaction carrying whatever metadata they like.
 */

export const AWAMENU_REFERENCE_PREFIX = "AWM";
export const AWAMENU_APP_TAG = "awamenu";

/** How long a checkout is chased before it's written off. Bank transfers and
 *  USSD can confirm well after the customer has left the page. */
const VERIFY_WINDOW_MS = 24 * 60 * 60 * 1000;

// Providers accept letters, digits and hyphens everywhere; nanoid's default
// alphabet includes "_", which some of them reject.
const randomPart = customAlphabet("0123456789ABCDEFGHJKLMNPQRSTUVWXYZ", 12);

const KIND_CODE: Record<PaymentAttemptKind, string> = {
	ORDER: "ORD",
	RESERVATION: "RSV",
	SUBSCRIPTION: "SUB",
};

/** True for references this app generated. */
export function isAwamenuReference(reference: string | null | undefined) {
	return Boolean(reference?.startsWith(`${AWAMENU_REFERENCE_PREFIX}-`));
}

/** Metadata every AwaMenu charge carries, alongside its own fields. */
export function awamenuMetadata<T extends Record<string, unknown>>(
	metadata: T,
	reference: string,
) {
	return { ...metadata, app: AWAMENU_APP_TAG, attemptReference: reference };
}

export type NewPaymentAttempt = {
	gateway: PaymentGateway;
	ownGateway?: boolean;
	amountKobo: number;
	restaurantId?: string | null;
	/** AwaMenu Pay only: the commission rate and total platform charge sent. */
	commissionPercent?: number | null;
	platformChargeKobo?: number | null;
} & (
	| { kind: "ORDER"; orderId: string }
	| { kind: "RESERVATION"; reservationId: string }
	| {
			kind: "SUBSCRIPTION";
			userId: string;
			planId: string;
			billingInterval: BillingInterval;
	  }
);

/** Records a checkout before the customer is sent to the provider. */
export async function createPaymentAttempt(input: NewPaymentAttempt) {
	const reference = `${AWAMENU_REFERENCE_PREFIX}-${KIND_CODE[input.kind]}-${randomPart()}`;

	return db.paymentAttempt.create({
		data: {
			reference,
			gateway: input.gateway,
			ownGateway: input.ownGateway ?? false,
			kind: input.kind,
			amountKobo: input.amountKobo,
			restaurantId: input.restaurantId ?? null,
			commissionPercent: input.commissionPercent ?? null,
			platformChargeKobo: input.platformChargeKobo ?? null,
			orderId: input.kind === "ORDER" ? input.orderId : null,
			reservationId: input.kind === "RESERVATION" ? input.reservationId : null,
			userId: input.kind === "SUBSCRIPTION" ? input.userId : null,
			planId: input.kind === "SUBSCRIPTION" ? input.planId : null,
			billingInterval:
				input.kind === "SUBSCRIPTION" ? input.billingInterval : null,
		},
	});
}

/** Stores the provider's own id when it differs from ours (Monnify). */
export async function recordProviderReference(
	attemptId: string,
	providerReference: string,
) {
	await db.paymentAttempt.update({
		where: { id: attemptId },
		data: { providerReference },
	});
}

/** A confirmed charge, however it was learned of. */
export type ConfirmedCharge = {
	amountKobo: number;
	currency: string;
	feeKobo?: number | null;
	subaccountCode?: string | null;
	raw?: unknown;
};

async function safely(label: string, run: () => Promise<unknown>) {
	try {
		await run();
	} catch (error) {
		Sentry.captureException(error, { tags: { component: label } });
		console.error(`[payment-attempt] ${label} failed`, error);
	}
}

/**
 * Applies a confirmed charge to whatever the attempt pays for.
 *
 * Each target's settlement is idempotent on the reference, so this is safe to
 * call from every channel at once; only the first actually changes anything
 * or notifies anyone.
 */
export async function settleAttempt(
	attempt: PaymentAttempt,
	charge: ConfirmedCharge,
): Promise<string> {
	let outcome: string;

	if (attempt.kind === "ORDER" && attempt.orderId) {
		const orderId = attempt.orderId;
		const before = await db.order.findUnique({
			where: { id: orderId },
			select: { status: true },
		});
		const credit = await creditOrder(orderId, {
			kind: "GATEWAY",
			gateway: attempt.gateway,
			reference: attempt.reference,
			paidMinorUnits: charge.amountKobo,
			currency: charge.currency,
			gatewayFeeMinorUnits: charge.feeKobo ?? null,
			subaccountCode: charge.subaccountCode ?? null,
			ownGateway: attempt.ownGateway,
			rawPayload: charge.raw,
		});
		outcome = credit.ok ? "CREDITED" : credit.reason;

		// Paid after the order was cancelled (the customer finished checkout
		// in another tab, or a bank transfer cleared late). The money is real
		// and on the ledger; the order stays cancelled and the restaurant is
		// told to give it back — never kept quietly.
		if (credit.ok && before?.status === OrderStatus.CANCELLED) {
			await flagOrderRefund(orderId, attempt.reference, charge.amountKobo);
			outcome = "REFUND_REQUIRED";
		} else if (credit.ok && credit.newlyPaid) {
			await safely("order-paid-email", () =>
				notifyOrderPaid(orderId, { method: "Card or bank transfer" }),
			);
			await safely("order-confirmed-email", () =>
				notifyOrderConfirmed(orderId),
			);
			await safely("order-customer-message", () =>
				notifyCustomerOrderStatus(orderId, OrderStatus.CONFIRMED),
			);
			await safely("order-new-notification", () => notifyNewOrder(orderId));
		}
	} else if (attempt.kind === "RESERVATION" && attempt.reservationId) {
		const settlement = await settleReservationPayment({
			reservationId: attempt.reservationId,
			gateway: attempt.gateway,
			reference: attempt.reference,
			paidMinorUnits: charge.amountKobo,
			currency: charge.currency,
			gatewayFeeMinorUnits: charge.feeKobo ?? null,
			subaccountCode: charge.subaccountCode ?? null,
			rawPayload: charge.raw,
		});
		outcome = settlement.outcome;
	} else if (
		attempt.kind === "SUBSCRIPTION" &&
		attempt.userId &&
		attempt.planId
	) {
		const raw = charge.raw as {
			customer?: { customer_code?: string };
			subscription?: { subscription_code?: string };
		} | null;
		const result = await applySubscriptionCharge({
			kind: "INITIAL",
			reference: attempt.reference,
			paidMinorUnits: charge.amountKobo,
			currency: charge.currency,
			userId: attempt.userId,
			planId: attempt.planId,
			billingInterval: parseBillingInterval(attempt.billingInterval),
			restaurantId: attempt.restaurantId,
			customerCode: raw?.customer?.customer_code ?? null,
			subscriptionCode: raw?.subscription?.subscription_code ?? null,
			rawPayload: charge.raw,
		});
		outcome = result.ok ? "APPLIED" : result.reason;
	} else {
		outcome = "INVALID_ATTEMPT";
	}

	// EXPIRED included: a bank transfer can land after we stopped chasing it,
	// and the customer's return page still checks.
	await db.paymentAttempt.updateMany({
		where: { id: attempt.id, status: { in: ["PENDING", "EXPIRED"] } },
		data: { status: "SETTLED", settledAt: new Date(), outcome },
	});
	return outcome;
}

/** Records, once per charge, that a cancelled order's payment must be returned. */
async function flagOrderRefund(
	orderId: string,
	reference: string,
	amountKobo: number,
) {
	const line = `Paid ₦${(amountKobo / 100).toLocaleString("en-NG")} after the order was cancelled (ref ${reference})`;
	const order = await db.order.findUnique({
		where: { id: orderId },
		select: {
			refundRequiredReason: true,
			restaurantId: true,
			customerName: true,
			restaurant: { select: { slug: true } },
		},
	});
	if (!order || order.refundRequiredReason?.includes(`ref ${reference})`)) {
		return;
	}

	const { count } = await db.order.updateMany({
		where: { id: orderId, refundRequiredReason: order.refundRequiredReason },
		data: {
			refundRequiredReason: order.refundRequiredReason
				? `${order.refundRequiredReason}\n${line}`
				: line,
		},
	});
	if (count === 0) return;

	Sentry.captureMessage("Order payment needs a refund", {
		level: "warning",
		extra: { orderId, reference },
	});
	await safely("order-refund-notification", () =>
		dispatchNotification({
			restaurantId: order.restaurantId,
			type: NotificationType.PAYMENT_RECEIVED,
			audience: NotificationAudience.ADMIN,
			title: "Refund needed for a cancelled order",
			body: `${order.customerName}: ${line}`,
			actionUrl: `/dashboard/${order.restaurant.slug}/orders?orderId=${orderId}`,
			metadata: { orderId, reference, refund: true },
		}),
	);
}

export type VerifyResult =
	| { state: "SETTLED"; outcome: string }
	| { state: "PENDING" }
	| { state: "EXPIRED" }
	| { state: "UNKNOWN" };

/**
 * Asks the provider whether an attempt has been paid, and settles it if so.
 *
 * A SETTLED attempt is answered from the database — a customer reloading the
 * return page must not cost a provider call each time.
 */
export async function verifyPaymentAttempt(
	attemptOrReference: PaymentAttempt | string,
): Promise<VerifyResult> {
	const attempt =
		typeof attemptOrReference === "string"
			? await db.paymentAttempt.findUnique({
					where: { reference: attemptOrReference },
				})
			: attemptOrReference;
	if (!attempt) return { state: "UNKNOWN" };
	if (attempt.status === "SETTLED") {
		return { state: "SETTLED", outcome: attempt.outcome ?? "SETTLED" };
	}

	const credentials = await credentialsForAttempt(attempt);
	if (!credentials) {
		Sentry.captureMessage("No credentials to verify a payment attempt", {
			level: "warning",
			extra: { reference: attempt.reference, gateway: attempt.gateway },
		});
		return { state: "PENDING" };
	}

	let verification: Awaited<
		ReturnType<ReturnType<typeof getGatewayAdapter>["verifyCharge"]>
	>;
	try {
		verification = await getGatewayAdapter(attempt.gateway).verifyCharge(
			credentials,
			attempt.providerReference ?? attempt.reference,
		);
	} catch (error) {
		// "Transaction not found" before the customer has finished checkout is
		// normal, so this is a retry-later, not an alarm.
		await db.paymentAttempt.update({
			where: { id: attempt.id },
			data: { checkCount: { increment: 1 }, lastCheckedAt: new Date() },
		});
		console.warn(`[payment-attempt] verify ${attempt.reference} failed`, error);
		return attempt.status === "EXPIRED"
			? { state: "EXPIRED" }
			: expireIfStale(attempt);
	}

	await db.paymentAttempt.update({
		where: { id: attempt.id },
		data: { checkCount: { increment: 1 }, lastCheckedAt: new Date() },
	});

	if (!verification.paid) {
		return attempt.status === "EXPIRED"
			? { state: "EXPIRED" }
			: expireIfStale(attempt);
	}

	const outcome = await settleAttempt(attempt, {
		amountKobo: verification.amountKobo,
		currency: verification.currency,
		feeKobo: verification.feeKobo,
		subaccountCode: verification.subaccountCode,
		raw: verification.raw,
	});
	return { state: "SETTLED", outcome };
}

async function expireIfStale(attempt: PaymentAttempt): Promise<VerifyResult> {
	if (Date.now() - attempt.createdAt.getTime() < VERIFY_WINDOW_MS) {
		return { state: "PENDING" };
	}
	await db.paymentAttempt.updateMany({
		where: { id: attempt.id, status: "PENDING" },
		data: { status: "EXPIRED" },
	});
	return { state: "EXPIRED" };
}

/**
 * How long to wait before asking about an attempt again.
 *
 * Backs off with age: a checkout a minute old is probably paid any second, one
 * twelve hours old is probably abandoned. Keeps provider calls — and function
 * time — roughly flat however many checkouts were abandoned.
 */
function recheckDelayMs(attempt: PaymentAttempt, now: number) {
	const age = now - attempt.createdAt.getTime();
	return Math.min(Math.max(age / 4, 2 * 60_000), 2 * 60 * 60_000);
}

/**
 * Verifies pending attempts that are due a check. Called by the payments cron.
 *
 * Bounded by count and wall time so a backlog drains over several runs instead
 * of one run outliving its function limit.
 */
export async function sweepPendingPaymentAttempts(
	options: { limit?: number; budgetMs?: number } = {},
) {
	const started = Date.now();
	const budgetMs = options.budgetMs ?? 40_000;

	const candidates = await db.paymentAttempt.findMany({
		where: {
			status: "PENDING",
			// Give the customer a moment at checkout before the first look.
			createdAt: { lte: new Date(started - 60_000) },
		},
		orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }],
		take: (options.limit ?? 40) * 3,
	});

	const due = candidates
		.filter(
			(attempt) =>
				!attempt.lastCheckedAt ||
				started - attempt.lastCheckedAt.getTime() >=
					recheckDelayMs(attempt, started),
		)
		.slice(0, options.limit ?? 40);

	const tally = { checked: 0, settled: 0, expired: 0, pending: 0 };
	for (const attempt of due) {
		if (Date.now() - started > budgetMs) break;
		const result = await verifyPaymentAttempt(attempt);
		tally.checked += 1;
		if (result.state === "SETTLED") tally.settled += 1;
		else if (result.state === "EXPIRED") tally.expired += 1;
		else tally.pending += 1;
	}
	return tally;
}
