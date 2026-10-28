import { SubscriptionStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { parseBillingInterval } from "@/lib/billing";
import { db } from "@/lib/db";
import {
	isAwamenuReference,
	verifyPaymentAttempt,
} from "@/lib/payment-attempts";
import { getGatewayAdapter } from "@/lib/payment-gateways";
import { getPlatformPaymentConfig } from "@/lib/payment-routing";
import { verifyPaystackWebhook } from "@/lib/payments";
import { applySubscriptionCharge } from "@/lib/subscription-payments";

/**
 * Paystack events — an optional, faster path.
 *
 * AwaMenu does not depend on this route: the Paystack account is shared and its
 * single webhook URL points at another project, so payments are confirmed by
 * the return page and the payments cron (lib/payment-attempts.ts). If the other
 * project forwards events tagged `metadata.app === "awamenu"` here — raw body
 * and `x-paystack-signature` header unchanged, which stays valid because both
 * use the same secret key — they are settled immediately.
 *
 * Every branch is idempotent: Paystack retries a delivery until it gets a 2xx
 * (for up to 72 hours), and the customer's return page settles the same charge
 * in parallel. Each charge is applied by a single claim on its reference, so a
 * replay is recognised and changes nothing.
 *
 * Status codes are chosen for what a retry can achieve. 5xx (an unexpected
 * error) asks Paystack to try again; a refused amount returns 200, because
 * retrying cannot make a wrong amount right — it is recorded for a human.
 */

type PaystackWebhook = {
	event?: string;
	data?: {
		reference?: string;
		/** Kobo. Never assume it equals what was owed. */
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
		};
		customer?: {
			customer_code?: string;
			email?: string;
		};
		subscription?: {
			subscription_code?: string;
		};
		subscription_code?: string;
	};
};

export async function POST(request: Request) {
	const body = await request.text();
	const signature = request.headers.get("x-paystack-signature");

	if (!signature || !verifyPaystackWebhook(body, signature)) {
		return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
	}

	let payload: PaystackWebhook;
	try {
		payload = JSON.parse(body) as PaystackWebhook;
	} catch {
		return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
	}

	if (payload.event === "invoice.payment_failed") {
		const subCode = payload.data?.subscription?.subscription_code;
		if (subCode) {
			await db.subscription.updateMany({
				where: { paystackSubscriptionCode: subCode },
				data: { status: SubscriptionStatus.PAST_DUE },
			});
		}
		return NextResponse.json({ ok: true });
	}

	if (payload.event === "subscription.disable") {
		const subCode = payload.data?.subscription_code;
		if (subCode) {
			await db.subscription.updateMany({
				where: { paystackSubscriptionCode: subCode },
				data: { status: SubscriptionStatus.CANCELLED },
			});
		}
		return NextResponse.json({ ok: true });
	}

	if (payload.event !== "charge.success") {
		return NextResponse.json({ ok: true });
	}

	const data = payload.data;
	const reference = data?.reference;
	if (!data || !reference) {
		// Every idempotency guarantee below is keyed on the reference.
		return NextResponse.json({ error: "Missing reference" }, { status: 400 });
	}

	// Only charges this app started are acted on. The Paystack account is
	// shared with another project, so a forwarded event may well be theirs —
	// and what a charge pays for comes from our attempt row, never from
	// metadata anyone holding the public key can set.
	const attempt = isAwamenuReference(reference)
		? await db.paymentAttempt.findUnique({ where: { reference } })
		: null;

	if (attempt) {
		// The event is a hint, never proof: ask Paystack whether this charge
		// really succeeded and for how much (the same check the return page and
		// the payments cron use), and settle from its answer. A forged or
		// replayed event can then change nothing.
		const result = await verifyPaymentAttempt(attempt);
		return NextResponse.json({ ok: true, state: result.state });
	}

	// A recurring charge Paystack makes on its own schedule carries no metadata
	// of ours, only the subscription code.
	const subCode = data.subscription?.subscription_code;
	if (subCode) {
		const sub = await db.subscription.findFirst({
			where: { paystackSubscriptionCode: subCode },
			select: {
				id: true,
				userId: true,
				planId: true,
				restaurantId: true,
				billingInterval: true,
			},
		});

		if (sub) {
			// Confirmed with Paystack before a period is granted, using what it
			// reports rather than what the event says.
			const credentials = (await getPlatformPaymentConfig()).credentialsFor(
				"PAYSTACK",
			);
			if (!credentials) {
				return NextResponse.json(
					{ error: "Paystack is not configured" },
					{ status: 503 },
				);
			}
			const verified = await getGatewayAdapter("PAYSTACK").verifyCharge(
				credentials,
				reference,
			);
			if (!verified.paid) {
				return NextResponse.json({ ok: true, state: "NOT_PAID" });
			}
			await applySubscriptionCharge({
				kind: "RENEWAL",
				subscriptionId: sub.id,
				reference,
				paidMinorUnits: verified.amountKobo,
				currency: verified.currency,
				userId: sub.userId,
				planId: sub.planId,
				billingInterval: parseBillingInterval(sub.billingInterval),
				restaurantId: sub.restaurantId,
				rawPayload: verified.raw,
			});
		}
	}

	return NextResponse.json({ ok: true });
}
