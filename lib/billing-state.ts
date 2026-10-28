import { getPlanIntervalPrice, parseBillingInterval } from "@/lib/billing";

/**
 * The one answer to "can this restaurant trade?" — used by the owner
 * dashboard, staff terminal, public menu, server actions, the billing cron
 * and the Super Admin pages, so they can never disagree.
 *
 * Worked out from dates, not `Subscription.status`: a status can go stale (a
 * cron that didn't run left an expired subscription "ACTIVE" for weeks), the
 * period end can't.
 *
 * Billing is separate from an admin suspension (`Restaurant.isActive`, set
 * only by the Super Admin). A lapsed restaurant is "read-only": the owner can
 * sign in, see everything, finish what's in progress and pay; customers can
 * view the menu but not order.
 */

export type BillingState =
	/** Paid and in date. */
	| "ACTIVE"
	/** Paid, ends within EXPIRING_SOON_DAYS. */
	| "EXPIRING_SOON"
	/** Ended less than GRACE_DAYS ago: still fully working, renew now. */
	| "GRACE"
	/** Ended more than GRACE_DAYS ago: read-only until paid. */
	| "LAPSED"
	/** Free plan: never expires. */
	| "FREE"
	/** No subscription at all (onboarding never finished). */
	| "NONE";

export const BILLING_STATES: BillingState[] = [
	"ACTIVE",
	"EXPIRING_SOON",
	"GRACE",
	"LAPSED",
	"FREE",
	"NONE",
];

export const GRACE_DAYS = 3;
export const EXPIRING_SOON_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SubscriptionForBilling = {
	currentPeriodEnd: Date | string;
	billingInterval: string;
	plan: {
		monthlyPrice: unknown;
		quarterlyPrice: unknown;
		yearlyPrice: unknown;
	};
} | null;

export function subscriptionPrice(
	subscription: NonNullable<SubscriptionForBilling>,
) {
	return getPlanIntervalPrice(
		{
			monthlyPrice: Number(subscription.plan.monthlyPrice),
			quarterlyPrice: Number(subscription.plan.quarterlyPrice),
			yearlyPrice: Number(subscription.plan.yearlyPrice),
		},
		parseBillingInterval(subscription.billingInterval),
	);
}

/** Whole days until the period ends (negative once it has). */
export function daysLeft(periodEnd: Date | string, now: number = Date.now()) {
	return Math.ceil((new Date(periodEnd).getTime() - now) / DAY_MS);
}

export function billingStateOf(
	subscription: SubscriptionForBilling,
	now: number = Date.now(),
): BillingState {
	if (!subscription) return "NONE";
	if (subscriptionPrice(subscription) <= 0) return "FREE";
	const end = new Date(subscription.currentPeriodEnd).getTime();
	if (now > end + GRACE_DAYS * DAY_MS) return "LAPSED";
	if (now > end) return "GRACE";
	if (end - now <= EXPIRING_SOON_DAYS * DAY_MS) return "EXPIRING_SOON";
	return "ACTIVE";
}

/** May take orders and bookings, and be edited. */
export function canTrade(state: BillingState) {
	return state !== "LAPSED" && state !== "NONE";
}

/** Paying and in good standing: counted in MRR. */
export function isRevenueState(state: BillingState) {
	return state === "ACTIVE" || state === "EXPIRING_SOON";
}

/** When a lapsed restaurant went read-only (end of grace). */
export function lapsedAt(periodEnd: Date | string) {
	return new Date(new Date(periodEnd).getTime() + GRACE_DAYS * DAY_MS);
}

export function parseBillingState(value: unknown): BillingState | null {
	return BILLING_STATES.includes(value as BillingState)
		? (value as BillingState)
		: null;
}

export const BILLING_STATE_LABEL: Record<BillingState, string> = {
	ACTIVE: "Active",
	EXPIRING_SOON: "Expiring soon",
	GRACE: "In grace period",
	LAPSED: "Lapsed",
	FREE: "Free",
	NONE: "No plan",
};

/**
 * Whether the card on file will be charged at the period end: a Paystack
 * subscription exists and hasn't been cancelled. The code alone isn't enough;
 * cancelling auto-renew sets CANCELLED but keeps the code for reference.
 */
export function isAutoRenewing(
	subscription: {
		status: string;
		paystackSubscriptionCode: string | null;
	} | null,
) {
	return Boolean(
		subscription?.paystackSubscriptionCode && subscription.status === "ACTIVE",
	);
}
