import crypto from "node:crypto";
import type { PaymentGateway } from "@prisma/client";
import {
	OnboardingStatus,
	OrderStatus,
	PaymentStatus,
	ReservationStatus,
	SubscriptionStatus,
} from "@prisma/client";
import { env, requireEnv } from "@/env";
import {
	addBillingPeriod,
	type BillingIntervalValue,
	getPlanIntervalPrice,
	getPlanPaystackCode,
	parseBillingInterval,
} from "@/lib/billing";
import { db } from "@/lib/db";
import { notifyOrderConfirmed, notifyOrderPaid } from "@/lib/order-emails";
import { notifyCustomerOrderStatus } from "@/lib/order-messaging";
import { creditOrder } from "@/lib/payment-ledger";
import { scheduleReservationExpiry } from "@/lib/qstash";
import { notifyReservationConfirmed } from "@/lib/reservation-emails";

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

type PaystackOrderParams = {
	orderId: string;
	restaurantSlug: string;
	customerName: string;
	customerEmail?: string | null;
	amountKobo: number;
};

type PaystackReservationParams = {
	reservationId: string;
	restaurantSlug: string;
	customerName: string;
	customerEmail?: string | null;
	amountKobo: number;
};

type VerifySubscriptionPaymentParams = {
	reference: string;
	userId: string;
	planId: string;
	billingInterval?: BillingIntervalValue;
	restaurantId?: string;
};

type VerifyOrderPaymentParams = {
	reference: string;
	orderId: string;
};

type VerifyReservationPaymentParams = {
	reference: string;
	reservationId: string;
};

type PaystackVerifyResponse = {
	status?: boolean;
	data?: {
		status?: string;
		reference?: string;
		/** Kobo. Never assume it equals what the order was owed. */
		amount?: number;
		currency?: string;
		fees?: number;
		subaccount?: { subaccount_code?: string };
		metadata?: {
			type?: string;
			userId?: string;
			planId?: string;
			billingInterval?: string;
			restaurantId?: string;
			orderId?: string;
			reservationId?: string;
			customerName?: string;
		};
		customer?: {
			customer_code?: string;
		};
		subscription?: {
			subscription_code?: string;
		};
	};
};

/**
 * Starts an order payment through whichever channel the restaurant configured.
 *
 * Falls back to the platform Paystack account when no channel is set up, so
 * restaurants that predate the payments feature keep working unchanged.
 */
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
	const { resolveCheckoutGateway } = await import(
		"@/actions/payment-settings.actions"
	);
	const routed = await resolveCheckoutGateway(
		params.restaurantId,
		params.amountKobo,
		params.preferredGateway,
	);

	if (!routed) {
		// Deliberately refused rather than falling back to the platform's own
		// Paystack account. That fallback charged the customer into AwaMenu's
		// balance with no subaccount and no split — the money settled to AwaMenu's
		// bank with nothing tying it to the restaurant and no way to pay it on.
		// It also turns the product from "payments settle to the restaurant" into
		// "AwaMenu holds other people's money", which is a regulated activity.
		//
		// Cash, POS and bank transfer still work and need no setup, so a
		// restaurant that hasn't connected a payout account degrades to those.
		throw new Error(
			"This restaurant hasn't set up online payments yet. Please choose cash or bank transfer.",
		);
	}

	const { getGatewayAdapter } = await import("@/lib/payment-gateways");
	const result = await getGatewayAdapter(routed.gateway).initializeCharge(
		routed.credentials,
		{
			amountKobo: params.amountKobo,
			email: params.customerEmail || `${params.orderId}@orders.awamenu.com`,
			callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/${params.restaurantSlug}/order/${params.orderId}/paystack-return`,
			metadata: {
				type: "ORDER",
				orderId: params.orderId,
				customerName: params.customerName,
			},
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

	return result.authorizationUrl;
}

export async function initiateOrderPayment(params: PaystackOrderParams) {
	const paystackSecretKey = requireEnv("PAYSTACK_SECRET_KEY");
	const res = await fetch("https://api.paystack.co/transaction/initialize", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${paystackSecretKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			email: params.customerEmail || `${params.orderId}@orders.awamenu.com`,
			amount: params.amountKobo,
			callback_url: `${env.NEXT_PUBLIC_APP_URL}/${params.restaurantSlug}/order/${params.orderId}/paystack-return`,
			metadata: {
				type: "ORDER",
				orderId: params.orderId,
				customerName: params.customerName,
			},
		}),
	});
	const payload = await res.json();

	if (!res.ok || !payload?.data?.authorization_url) {
		throw new Error("Unable to initialize order payment.");
	}

	return payload.data.authorization_url as string;
}

export async function initiateReservationPayment(
	params: PaystackReservationParams,
) {
	const paystackSecretKey = requireEnv("PAYSTACK_SECRET_KEY");
	const res = await fetch("https://api.paystack.co/transaction/initialize", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${paystackSecretKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			email:
				params.customerEmail ||
				`${params.reservationId}@reservations.awamenu.com`,
			amount: params.amountKobo,
			callback_url: `${env.NEXT_PUBLIC_APP_URL}/${params.restaurantSlug}/reservation/${params.reservationId}`,
			metadata: {
				type: "RESERVATION_PAYMENT",
				reservationId: params.reservationId,
				customerName: params.customerName,
			},
		}),
	});
	const payload = await res.json();

	if (!res.ok || !payload?.data?.authorization_url) {
		throw new Error("Unable to initialize reservation payment.");
	}

	return payload.data.authorization_url as string;
}

export async function verifyOrderPaymentReference(
	params: VerifyOrderPaymentParams,
) {
	const paystackSecretKey = requireEnv("PAYSTACK_SECRET_KEY");
	const res = await fetch(
		`https://api.paystack.co/transaction/verify/${encodeURIComponent(params.reference)}`,
		{
			headers: {
				Authorization: `Bearer ${paystackSecretKey}`,
			},
			cache: "no-store",
		},
	);
	const payload = (await res.json()) as PaystackVerifyResponse;

	if (!res.ok || !payload.status || payload.data?.status !== "success") {
		return false;
	}

	const metadata = payload.data.metadata;

	if (metadata?.type !== "ORDER" || metadata.orderId !== params.orderId) {
		return false;
	}

	const credit = await creditOrder(params.orderId, {
		kind: "GATEWAY",
		gateway: "PAYSTACK",
		reference: payload.data.reference ?? params.reference,
		paidMinorUnits: payload.data.amount ?? 0,
		currency: payload.data.currency ?? "NGN",
		gatewayFeeMinorUnits: payload.data.fees ?? null,
		subaccountCode: payload.data.subaccount?.subaccount_code ?? null,
		rawPayload: payload.data,
	});

	if (!credit.ok) return false;

	// This runs on the customer's return from Paystack, racing the webhook for
	// the same reference. Only whichever call actually settled the order sends,
	// so the customer gets one receipt rather than two.
	if (credit.newlyPaid) {
		await notifyOrderPaid(params.orderId, { method: "Card or bank transfer" });
		await notifyOrderConfirmed(params.orderId);
		await notifyCustomerOrderStatus(params.orderId, OrderStatus.CONFIRMED);
	}

	return true;
}

export async function verifyReservationPaymentReference(
	params: VerifyReservationPaymentParams,
) {
	const paystackSecretKey = requireEnv("PAYSTACK_SECRET_KEY");
	const res = await fetch(
		`https://api.paystack.co/transaction/verify/${encodeURIComponent(params.reference)}`,
		{
			headers: {
				Authorization: `Bearer ${paystackSecretKey}`,
			},
			cache: "no-store",
		},
	);
	const payload = (await res.json()) as PaystackVerifyResponse;

	if (!res.ok || !payload.status || payload.data?.status !== "success") {
		return false;
	}

	const metadata = payload.data.metadata;

	if (
		metadata?.type !== "RESERVATION_PAYMENT" ||
		metadata.reservationId !== params.reservationId
	) {
		return false;
	}

	const reservation = await db.reservation.findUnique({
		where: { id: params.reservationId },
		select: {
			id: true,
			status: true,
			expiresAt: true,
			reservationPaymentStatus: true,
			preOrderId: true,
		},
	});

	if (!reservation) return false;
	if (reservation.reservationPaymentStatus === PaymentStatus.PAID) return true;

	const qstashMessageId = await scheduleReservationExpiry({
		reservationId: reservation.id,
		expiresAt: reservation.expiresAt,
	});

	await db.reservation.update({
		where: { id: params.reservationId },
		data: {
			status: ReservationStatus.ACTIVE,
			reservationPaymentStatus: PaymentStatus.PAID,
			reservationPaymentRef: payload.data.reference ?? params.reference,
			qstashMessageId,
		},
	});

	// The table is paid for and held, so this is the moment it is genuinely
	// theirs. Claim-guarded, so the webhook confirming the same payment a
	// moment later cannot send a second one.
	await notifyReservationConfirmed(params.reservationId);

	if (reservation.preOrderId) {
		// A deposit, so the charge is expected to be a part payment — see the
		// matching branch in the Paystack webhook.
		const credit = await creditOrder(reservation.preOrderId, {
			kind: "GATEWAY",
			gateway: "PAYSTACK",
			reference: payload.data.reference ?? params.reference,
			paidMinorUnits: payload.data.amount ?? 0,
			expectedMinorUnits: payload.data.amount ?? 0,
			currency: payload.data.currency ?? "NGN",
			gatewayFeeMinorUnits: payload.data.fees ?? null,
			subaccountCode: payload.data.subaccount?.subaccount_code ?? null,
			rawPayload: payload.data,
		});

		if (credit.ok && credit.newlyPaid) {
			await notifyOrderPaid(reservation.preOrderId, {
				method: "Card or bank transfer",
			});
			await notifyOrderConfirmed(reservation.preOrderId);
		}
	}

	return true;
}

export async function initiateSubscriptionPayment(
	params: PaystackSubscriptionParams & { callbackUrl?: string },
) {
	const plan = await db.plan.findUniqueOrThrow({
		where: { id: params.planId },
	});
	const billingInterval = parseBillingInterval(params.billingInterval);
	const amount = getPlanIntervalPrice(plan, billingInterval);
	const paystackPlanCode = getPlanPaystackCode(plan, billingInterval);
	const paystackSecretKey = requireEnv("PAYSTACK_SECRET_KEY");
	const res = await fetch("https://api.paystack.co/transaction/initialize", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${paystackSecretKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			email: params.customerEmail,
			amount: amount * 100,
			plan: paystackPlanCode,
			callback_url:
				params.callbackUrl ||
				`${env.NEXT_PUBLIC_APP_URL}/onboarding/setup?planId=${params.planId}&billing=${billingInterval}`,
			metadata: {
				type: "SUBSCRIPTION",
				userId: params.userId,
				planId: params.planId,
				billingInterval,
				restaurantId: params.restaurantId,
			},
		}),
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
	const paystackSecretKey = requireEnv("PAYSTACK_SECRET_KEY");
	const res = await fetch("https://api.paystack.co/transaction/initialize", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${paystackSecretKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			email: params.customerEmail,
			amount: 5000,
			channels: ["card"],
			callback_url: params.callbackUrl,
			metadata: {
				type: "ADD_CARD",
				userId: params.userId,
			},
		}),
	});

	const payload = await res.json();

	if (!res.ok || !payload?.data?.authorization_url) {
		throw new Error("Unable to initialize card binding payment.");
	}

	return payload.data.authorization_url as string;
}

export async function verifySubscriptionPaymentReference(
	params: VerifySubscriptionPaymentParams,
) {
	const paystackSecretKey = requireEnv("PAYSTACK_SECRET_KEY");
	const res = await fetch(
		`https://api.paystack.co/transaction/verify/${encodeURIComponent(params.reference)}`,
		{
			headers: {
				Authorization: `Bearer ${paystackSecretKey}`,
			},
		},
	);
	const payload = (await res.json()) as PaystackVerifyResponse;

	if (!res.ok || !payload.status || payload.data?.status !== "success") {
		return false;
	}

	const metadata = payload.data.metadata;
	const billingInterval = parseBillingInterval(
		params.billingInterval ?? metadata?.billingInterval,
	);

	if (
		metadata?.type !== "SUBSCRIPTION" ||
		metadata.userId !== params.userId ||
		metadata.planId !== params.planId ||
		(params.billingInterval &&
			parseBillingInterval(metadata.billingInterval) !== params.billingInterval)
	) {
		return false;
	}

	const now = new Date();
	const periodEnd = addBillingPeriod(now, billingInterval);

	// Deliberately not filtered by planId — that's what's changing on an
	// upgrade/downgrade, so filtering on it would never match the existing
	// row and would silently create an orphaned duplicate instead of
	// updating the restaurant's actual subscription.
	const existingSubscription = await db.subscription.findFirst({
		where: params.restaurantId
			? { restaurantId: params.restaurantId }
			: { userId: params.userId, restaurantId: null },
		orderBy: { createdAt: "desc" },
	});

	if (existingSubscription) {
		await db.subscription.update({
			where: { id: existingSubscription.id },
			data: {
				planId: params.planId,
				status: SubscriptionStatus.ACTIVE,
				billingInterval,
				currentPeriodStart: now,
				currentPeriodEnd: periodEnd,
				paymentRef: payload.data.reference ?? params.reference,
				paystackCustomerCode: payload.data.customer?.customer_code,
				paystackSubscriptionCode: payload.data.subscription?.subscription_code,
				originalPlanId: params.planId,
				// New period, so the previous period's notice ladder no longer
				// applies — otherwise the next expiry would send no warnings.
				lastExpiryNoticeStage: null,
			},
		});

		// Undo an automatic non-payment suspension now that they've paid.
		// Gated on the notice stage so this can only reverse *our* suspension:
		// a restaurant a super-admin deliberately suspended stays suspended.
		if (
			existingSubscription.lastExpiryNoticeStage === "SUSPENDED" &&
			existingSubscription.restaurantId
		) {
			await db.restaurant.update({
				where: { id: existingSubscription.restaurantId },
				data: { isActive: true },
			});
		}
	} else {
		await db.subscription.create({
			data: {
				userId: params.userId,
				restaurantId: params.restaurantId,
				planId: params.planId,
				status: SubscriptionStatus.ACTIVE,
				billingInterval,
				currentPeriodStart: now,
				currentPeriodEnd: periodEnd,
				paymentRef: payload.data.reference ?? params.reference,
				paystackCustomerCode: payload.data.customer?.customer_code,
				paystackSubscriptionCode: payload.data.subscription?.subscription_code,
				originalPlanId: params.planId,
			},
		});
	}

	// Only the onboarding flow (no restaurantId yet) needs this — an existing
	// restaurant owner upgrading their plan has already finished onboarding,
	// and resetting their status here would bounce them back into the setup
	// wizard.
	if (!params.restaurantId) {
		await db.user.update({
			where: { id: params.userId },
			data: { onboardingStatus: OnboardingStatus.PENDING_SETUP },
		});
	} else {
		// A confirmed payment means they're renewing or upgrading out of a
		// forced Free downgrade — restore exactly the categories the system
		// hid, not ones the owner had already hidden themselves.
		await db.menuCategory.updateMany({
			where: { restaurantId: params.restaurantId, hiddenByDowngrade: true },
			data: { isActive: true, hiddenByDowngrade: false },
		});
	}

	return true;
}

export function verifyPaystackWebhook(body: string, sig: string): boolean {
	const paystackWebhookSecret = requireEnv("PAYSTACK_WEBHOOK_SECRET");
	const hash = crypto
		.createHmac("sha512", paystackWebhookSecret)
		.update(body)
		.digest("hex");
	const hashBuffer = Buffer.from(hash, "hex");
	const sigBuffer = Buffer.from(sig, "hex");
	if (hashBuffer.length !== sigBuffer.length) return false;
	return crypto.timingSafeEqual(hashBuffer, sigBuffer);
}
