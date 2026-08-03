import { NextResponse } from "next/server";
import { env } from "@/env";
import { getPlanIntervalPrice, parseBillingInterval } from "@/lib/billing";
import { db } from "@/lib/db";
import { verifyQstashSignature } from "@/lib/qstash";

type PaystackSubscriptionStatus = {
	data?: {
		status?: string;
		next_payment_date?: string | null;
	};
};

/**
 * Renewal charges happen on Paystack's own schedule and are only reflected
 * here via webhook — if that webhook is ever missed (network blip, downtime,
 * a signature mismatch), a subscription can be left ACTIVE with a stale
 * `currentPeriodEnd` forever, since `isSubscriptionActive` trusts `status`
 * unconditionally. This actively asks Paystack for the truth once a period
 * has already ended without a renewal having come through, instead of
 * silently trusting a webhook that may never arrive.
 */
async function reconcileStaleActiveSubscription(sub: {
	id: string;
	paystackSubscriptionCode: string | null;
}) {
	if (!sub.paystackSubscriptionCode) {
		// No Paystack-managed auto-renewal at all — nothing to reconcile
		// against, so there's no charge to have possibly missed.
		await db.subscription.update({
			where: { id: sub.id },
			data: { status: "PAST_DUE" },
		});
		return;
	}

	try {
		const res = await fetch(
			`https://api.paystack.co/subscription/${sub.paystackSubscriptionCode}`,
			{ headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` } },
		);
		if (!res.ok) return;

		const payload = (await res.json()) as PaystackSubscriptionStatus;
		const paystackStatus = payload.data?.status;
		const nextPaymentDate = payload.data?.next_payment_date
			? new Date(payload.data.next_payment_date)
			: null;

		if (
			paystackStatus === "active" &&
			nextPaymentDate &&
			nextPaymentDate.getTime() > Date.now()
		) {
			// The charge actually went through — we just missed the webhook.
			// Self-heal instead of waiting for a webhook that already happened.
			const periodStart = new Date();
			await db.subscription.update({
				where: { id: sub.id },
				data: {
					currentPeriodStart: periodStart,
					currentPeriodEnd: nextPaymentDate,
				},
			});
			return;
		}

		// Paystack confirms it's not actually renewing (cancelled, non-renewing,
		// completed, or an attention/failed-charge state).
		await db.subscription.update({
			where: { id: sub.id },
			data: { status: "PAST_DUE" },
		});
	} catch {
		// Network/API hiccup reconciling — leave status as-is and let the next
		// cron run retry, rather than guessing.
	}
}

export async function POST(request: Request) {
	const body = await request.text();
	const isVerified = await verifyQstashSignature({
		signature: request.headers.get("upstash-signature"),
		body,
		url: request.url,
	});

	if (!isVerified) {
		return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
	}

	const now = new Date();
	now.setHours(0, 0, 0, 0);

	const subscriptions = await db.subscription.findMany({
		where: {
			status: { in: ["ACTIVE", "PAST_DUE", "CANCELLED"] },
		},
		select: {
			id: true,
			status: true,
			currentPeriodEnd: true,
			paystackSubscriptionCode: true,
			billingInterval: true,
			user: { select: { email: true } },
			restaurant: { select: { name: true, slug: true } },
			plan: {
				select: {
					monthlyPrice: true,
					quarterlyPrice: true,
					yearlyPrice: true,
				},
			},
		},
	});

	for (const sub of subscriptions) {
		if (!sub.restaurant) continue;
		// The Free plan has no real billing cycle (see freeTierPeriodEnd in
		// subscription-lifecycle.actions.ts) and was never meant to expire or
		// need a renewal charge — without this guard, a Free subscription
		// whose currentPeriodEnd happens to be in the past (e.g. one created
		// before that 100-year period-end existed) would get reconciled as
		// "stale" and marked PAST_DUE, incorrectly locking out a restaurant
		// that never had anything to renew.
		if (Number(sub.plan.monthlyPrice) <= 0) continue;
		// Captured in a local const so TS narrowing survives into the
		// `.then()` closures below (property narrowing doesn't persist
		// across closure boundaries).
		const restaurant = sub.restaurant;

		const expiryDate = new Date(sub.currentPeriodEnd);
		expiryDate.setHours(0, 0, 0, 0);

		if (sub.status === "ACTIVE" && expiryDate.getTime() < now.getTime()) {
			await reconcileStaleActiveSubscription(sub);
			// Re-check below against whatever reconciliation just decided,
			// rather than the stale in-memory status.
			continue;
		}

		const gracePeriodEnd = new Date(expiryDate);
		gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3);

		const diffExpiryTime = expiryDate.getTime() - now.getTime();
		const daysToExpiry = Math.ceil(diffExpiryTime / (1000 * 60 * 60 * 24));

		const diffCutOffTime = gracePeriodEnd.getTime() - now.getTime();
		const daysToCutOff = Math.ceil(diffCutOffTime / (1000 * 60 * 60 * 24));

		const manageBillingUrl = `${env.NEXT_PUBLIC_APP_URL}/dashboard/${restaurant.slug}/settings`;
		const amount = `₦${getPlanIntervalPrice(
			sub.plan,
			parseBillingInterval(sub.billingInterval),
		).toLocaleString()}`;

		if (sub.status === "ACTIVE") {
			// Auto-renewing plan: send upcoming charge reminder 7 days before expiry
			if (daysToExpiry === 7) {
				await import("@/lib/email").then((m) =>
					m.sendAutoRenewalUpcomingEmail({
						to: sub.user.email,
						restaurantName: restaurant.name,
						daysLeft: 7,
						amount,
						manageBillingUrl,
					}),
				);
			}
		} else {
			// CANCELLED or PAST_DUE: send manual renewal reminders
			if (daysToExpiry === 7 || daysToExpiry === 3 || daysToExpiry === 1) {
				await import("@/lib/email").then((m) =>
					m.sendUpcomingExpiryEmail({
						to: sub.user.email,
						restaurantName: restaurant.name,
						daysLeft: daysToExpiry,
						manageBillingUrl,
					}),
				);
			} else if (daysToExpiry === 0) {
				// Exact day of expiry - grace period begins
				await import("@/lib/email").then((m) =>
					m.sendGracePeriodEmail({
						to: sub.user.email,
						restaurantName: restaurant.name,
						manageBillingUrl,
					}),
				);
			} else if (daysToCutOff === 0) {
				// Grace period ended - completely offline
				await import("@/lib/email").then((m) =>
					m.sendCutOffEmail({
						to: sub.user.email,
						restaurantName: restaurant.name,
						manageBillingUrl,
					}),
				);
			}
		}
	}

	return NextResponse.json({ ok: true });
}
