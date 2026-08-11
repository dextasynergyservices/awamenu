import { NextResponse } from "next/server";
import { env } from "@/env";
import { getPlanIntervalPrice, parseBillingInterval } from "@/lib/billing";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { db } from "@/lib/db";

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

/**
 * The expiry notice ladder, in order. Storing the furthest rung reached lets a
 * repeated (or more-frequent-than-daily) cron run skip notices already sent,
 * while still allowing a later rung to fire.
 */
const NOTICE_STAGES = ["T7", "T3", "T0", "SUSPENDED"] as const;
type NoticeStage = (typeof NOTICE_STAGES)[number];

function hasSentStage(current: string | null, stage: NoticeStage) {
	if (!current) return false;
	const currentIndex = NOTICE_STAGES.indexOf(current as NoticeStage);
	if (currentIndex < 0) return false;
	return currentIndex >= NOTICE_STAGES.indexOf(stage);
}

function recordStage(subscriptionId: string, stage: NoticeStage) {
	return db.subscription.update({
		where: { id: subscriptionId },
		data: { lastExpiryNoticeStage: stage },
	});
}

/**
 * Grace period has elapsed without payment: take the restaurant offline.
 *
 * Suspension reuses the existing `Restaurant.isActive` flag, which the public
 * menu, admin dashboard and staff dashboard already gate on — so nothing is
 * deleted and a later renewal restores everything by flipping it back.
 */
async function suspendRestaurant(input: {
	subscriptionId: string;
	restaurantId: string;
	restaurantName: string;
	email: string;
	manageBillingUrl: string;
}) {
	await db.$transaction([
		db.restaurant.update({
			where: { id: input.restaurantId },
			data: { isActive: false },
		}),
		db.subscription.update({
			where: { id: input.subscriptionId },
			data: { status: "PAST_DUE", lastExpiryNoticeStage: "SUSPENDED" },
		}),
	]);

	await import("@/lib/email").then((m) =>
		m.sendSuspensionEmail({
			to: input.email,
			restaurantName: input.restaurantName,
			manageBillingUrl: input.manageBillingUrl,
		}),
	);
}

export async function POST(request: Request) {
	const body = await request.text();

	if (!(await isAuthorizedCronRequest(request, body))) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
			lastExpiryNoticeStage: true,
			user: { select: { email: true } },
			restaurant: { select: { id: true, name: true, slug: true } },
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
			// Auto-renewing plan: warn about the upcoming charge, not expiry.
			if (daysToExpiry <= 7 && !hasSentStage(sub.lastExpiryNoticeStage, "T7")) {
				await import("@/lib/email").then((m) =>
					m.sendAutoRenewalUpcomingEmail({
						to: sub.user.email,
						restaurantName: restaurant.name,
						daysLeft: Math.max(daysToExpiry, 0),
						amount,
						manageBillingUrl,
					}),
				);
				await recordStage(sub.id, "T7");
			}
			continue;
		}

		// Not auto-renewing (CANCELLED or PAST_DUE): walk the notice ladder.
		//
		// Each rung uses `<=` rather than `===` so a cron run that is missed or
		// delayed still delivers the most relevant notice instead of skipping it
		// entirely, and `hasSentStage` keeps repeat runs from re-sending.
		if (daysToCutOff <= 0) {
			if (hasSentStage(sub.lastExpiryNoticeStage, "SUSPENDED")) continue;

			// Never suspend an owner who was never warned. Dates alone aren't
			// enough: a subscription that lapsed while this job wasn't running
			// (or before it existed) arrives here already past its cut-off, and
			// would otherwise be taken offline in the same run that first
			// noticed it — with none of the 7/3/0-day emails ever sent.
			//
			// Requiring the grace notice first guarantees at least one explicit
			// warning before anything goes dark. Normal flow is unaffected: T0
			// fires on the expiry day, so by the time the cut-off arrives three
			// days later this condition is already satisfied.
			if (!hasSentStage(sub.lastExpiryNoticeStage, "T0")) {
				await import("@/lib/email").then((m) =>
					m.sendGracePeriodEmail({
						to: sub.user.email,
						restaurantName: restaurant.name,
						manageBillingUrl,
					}),
				);
				await recordStage(sub.id, "T0");
				continue;
			}

			await suspendRestaurant({
				subscriptionId: sub.id,
				restaurantId: restaurant.id,
				restaurantName: restaurant.name,
				email: sub.user.email,
				manageBillingUrl,
			});
			continue;
		}

		if (daysToExpiry <= 0) {
			if (!hasSentStage(sub.lastExpiryNoticeStage, "T0")) {
				await import("@/lib/email").then((m) =>
					m.sendGracePeriodEmail({
						to: sub.user.email,
						restaurantName: restaurant.name,
						manageBillingUrl,
					}),
				);
				await recordStage(sub.id, "T0");
			}
			continue;
		}

		if (daysToExpiry <= 3) {
			if (!hasSentStage(sub.lastExpiryNoticeStage, "T3")) {
				await import("@/lib/email").then((m) =>
					m.sendUpcomingExpiryEmail({
						to: sub.user.email,
						restaurantName: restaurant.name,
						daysLeft: daysToExpiry,
						manageBillingUrl,
					}),
				);
				await recordStage(sub.id, "T3");
			}
			continue;
		}

		if (daysToExpiry <= 7) {
			if (!hasSentStage(sub.lastExpiryNoticeStage, "T7")) {
				await import("@/lib/email").then((m) =>
					m.sendUpcomingExpiryEmail({
						to: sub.user.email,
						restaurantName: restaurant.name,
						daysLeft: daysToExpiry,
						manageBillingUrl,
					}),
				);
				await recordStage(sub.id, "T7");
			}
		}
	}

	return NextResponse.json({ ok: true });
}

/**
 * Most external schedulers (cron-jobs.org included) issue a plain GET. The work
 * is identical — authorisation happens inside `POST` either way.
 */
export async function GET(request: Request) {
	return POST(request);
}
