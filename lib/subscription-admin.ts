import type { BillingInterval, Prisma } from "@prisma/client";
import { BILLING_INTERVAL_DETAILS, parseBillingInterval } from "@/lib/billing";
import {
	type BillingState,
	billingStateOf,
	EXPIRING_SOON_DAYS,
	GRACE_DAYS,
	isAutoRenewing,
	subscriptionPrice,
} from "@/lib/billing-state";
import { db } from "@/lib/db";

/**
 * Super Admin subscription data: metrics and a filtered, paginated list.
 *
 * Billing state is date-based (lib/billing-state.ts). The list filters by it
 * in SQL by translating each state into a period-end window, so filtering
 * works across every page, not just the rows loaded.
 */

const DAY = 86_400_000;

/** Paid = its price for the billing interval is above zero. */
const paidWhere: Prisma.SubscriptionWhereInput = {
	OR: [
		{ plan: { monthlyPrice: { gt: 0 } } },
		{ billingInterval: "QUARTERLY", plan: { quarterlyPrice: { gt: 0 } } },
		{ billingInterval: "YEARLY", plan: { yearlyPrice: { gt: 0 } } },
	],
};

export function stateWhere(
	state: BillingState,
	now = new Date(),
): Prisma.SubscriptionWhereInput {
	const t = now.getTime();
	switch (state) {
		case "FREE":
			return { NOT: paidWhere };
		case "ACTIVE":
			return {
				...paidWhere,
				currentPeriodEnd: { gt: new Date(t + EXPIRING_SOON_DAYS * DAY) },
			};
		case "EXPIRING_SOON":
			return {
				...paidWhere,
				currentPeriodEnd: {
					gt: now,
					lte: new Date(t + EXPIRING_SOON_DAYS * DAY),
				},
			};
		case "GRACE":
			return {
				...paidWhere,
				currentPeriodEnd: { gte: new Date(t - GRACE_DAYS * DAY), lte: now },
			};
		case "LAPSED":
			return {
				...paidWhere,
				currentPeriodEnd: { lt: new Date(t - GRACE_DAYS * DAY) },
			};
		case "NONE":
			return { id: "__none__" };
	}
}

export const SUBSCRIPTION_SORTS = {
	renewal: { label: "Renewal date", orderBy: { currentPeriodEnd: "asc" } },
	newest: { label: "Newest", orderBy: { createdAt: "desc" } },
	restaurant: {
		label: "Restaurant A–Z",
		orderBy: { restaurant: { name: "asc" } },
	},
} as const satisfies Record<
	string,
	{ label: string; orderBy: Prisma.SubscriptionOrderByWithRelationInput }
>;
export type SubscriptionSort = keyof typeof SUBSCRIPTION_SORTS;

export type SubscriptionFilters = {
	state: BillingState | null;
	planId: string | null;
	interval: BillingInterval | null;
	autoRenew: "on" | "off" | null;
	q: string | null;
	sort: SubscriptionSort;
};

export function parseSubscriptionFilters(
	params: Record<string, string | undefined>,
	states: readonly BillingState[],
): SubscriptionFilters {
	const interval = params.interval?.toUpperCase();
	return {
		state: states.includes(params.state as BillingState)
			? (params.state as BillingState)
			: null,
		planId: params.plan || null,
		interval:
			interval === "MONTHLY" ||
			interval === "QUARTERLY" ||
			interval === "YEARLY"
				? interval
				: null,
		autoRenew:
			params.autorenew === "on" || params.autorenew === "off"
				? params.autorenew
				: null,
		q: params.q?.trim() || null,
		sort:
			params.sort && params.sort in SUBSCRIPTION_SORTS
				? (params.sort as SubscriptionSort)
				: "renewal",
	};
}

export function subscriptionWhere(
	f: SubscriptionFilters,
	now = new Date(),
): Prisma.SubscriptionWhereInput {
	const and: Prisma.SubscriptionWhereInput[] = [];
	if (f.state) and.push(stateWhere(f.state, now));
	if (f.planId) and.push({ planId: f.planId });
	if (f.interval) and.push({ billingInterval: f.interval });
	const renewing: Prisma.SubscriptionWhereInput = {
		status: "ACTIVE",
		paystackSubscriptionCode: { not: null },
	};
	if (f.autoRenew === "on") and.push(renewing);
	if (f.autoRenew === "off") and.push({ NOT: renewing });
	if (f.q) {
		and.push({
			OR: [
				{ restaurant: { name: { contains: f.q, mode: "insensitive" } } },
				{ restaurant: { slug: { contains: f.q, mode: "insensitive" } } },
				{ user: { email: { contains: f.q, mode: "insensitive" } } },
				{ user: { name: { contains: f.q, mode: "insensitive" } } },
			],
		});
	}
	return and.length ? { AND: and } : {};
}

export const subscriptionRowSelect = {
	id: true,
	status: true,
	billingInterval: true,
	currentPeriodStart: true,
	currentPeriodEnd: true,
	paystackSubscriptionCode: true,
	lastExpiryNoticeStage: true,
	createdAt: true,
	planId: true,
	user: { select: { id: true, name: true, email: true } },
	restaurant: { select: { id: true, name: true, slug: true, isActive: true } },
	plan: {
		select: {
			id: true,
			name: true,
			tier: true,
			monthlyPrice: true,
			quarterlyPrice: true,
			yearlyPrice: true,
		},
	},
} satisfies Prisma.SubscriptionSelect;

/** Price per month for this subscription's interval (₦30,000 a quarter → ₦10,000). */
function monthlyValue(sub: Parameters<typeof subscriptionPrice>[0]) {
	const interval = parseBillingInterval(sub.billingInterval);
	return subscriptionPrice(sub) / BILLING_INTERVAL_DETAILS[interval].months;
}

/**
 * Headline numbers. MRR counts paying subscriptions in date (active or
 * expiring soon) at their monthly equivalent; GRACE is excluded because it
 * isn't paid for yet.
 */
export async function getSubscriptionMetrics(now = new Date()) {
	const t = now.getTime();
	const month = new Date(t - 30 * DAY);
	const [subs, collected, collectedPrev, newPaid] = await Promise.all([
		db.subscription.findMany({
			select: {
				id: true,
				status: true,
				billingInterval: true,
				currentPeriodEnd: true,
				paystackSubscriptionCode: true,
				planId: true,
				plan: {
					select: {
						name: true,
						monthlyPrice: true,
						quarterlyPrice: true,
						yearlyPrice: true,
					},
				},
			},
		}),
		db.subscriptionPayment.aggregate({
			where: { status: "SUCCESS", createdAt: { gte: month } },
			_sum: { amount: true },
			_count: true,
		}),
		db.subscriptionPayment.aggregate({
			where: {
				status: "SUCCESS",
				createdAt: { gte: new Date(t - 60 * DAY), lt: month },
			},
			_sum: { amount: true },
		}),
		db.subscriptionPayment.count({
			where: { status: "SUCCESS", kind: "INITIAL", createdAt: { gte: month } },
		}),
	]);

	const byState: Record<BillingState, number> = {
		ACTIVE: 0,
		EXPIRING_SOON: 0,
		GRACE: 0,
		LAPSED: 0,
		FREE: 0,
		NONE: 0,
	};
	let mrr = 0;
	let paying = 0;
	let autoRenewing = 0;
	let dueCount = 0;
	let dueAmount = 0;
	let churned = 0;
	let atRisk = 0;
	const plans = new Map<string, { name: string; count: number; mrr: number }>();

	for (const sub of subs) {
		const state = billingStateOf(sub, t);
		byState[state] += 1;
		const end = sub.currentPeriodEnd.getTime();
		if (state === "ACTIVE" || state === "EXPIRING_SOON") {
			const value = monthlyValue(sub);
			mrr += value;
			paying += 1;
			if (isAutoRenewing(sub)) autoRenewing += 1;
			const p = plans.get(sub.planId) ?? {
				name: sub.plan.name,
				count: 0,
				mrr: 0,
			};
			p.count += 1;
			p.mrr += value;
			plans.set(sub.planId, p);
			if (end <= t + 30 * DAY) {
				dueCount += 1;
				dueAmount += subscriptionPrice(sub);
			}
		}
		// Lost in the last 30 days: lapsed (grace ended) within the window.
		if (state === "LAPSED" && end + GRACE_DAYS * DAY >= month.getTime()) {
			churned += 1;
		}
		// Will lapse without action: in grace, or expiring with no card on file.
		if (
			state === "GRACE" ||
			(state === "EXPIRING_SOON" && !isAutoRenewing(sub))
		) {
			atRisk += 1;
		}
	}

	const collectedNow = Number(collected._sum.amount ?? 0);
	const collectedBefore = Number(collectedPrev._sum.amount ?? 0);
	return {
		total: subs.length,
		byState,
		mrr,
		arr: mrr * 12,
		paying,
		autoRenewRate: paying ? autoRenewing / paying : 0,
		renewalsDue: { count: dueCount, amount: dueAmount },
		churned,
		churnRate: paying + churned > 0 ? churned / (paying + churned) : 0,
		atRisk,
		newPaid,
		collected: {
			amount: collectedNow,
			count: collected._count,
			change:
				collectedBefore > 0
					? ((collectedNow - collectedBefore) / collectedBefore) * 100
					: null,
		},
		planMix: [...plans.entries()]
			.map(([id, p]) => ({ id, ...p }))
			.sort((a, b) => b.mrr - a.mrr),
	};
}
