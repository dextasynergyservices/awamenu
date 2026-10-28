import { type Prisma, UserRole } from "@prisma/client";
import { BILLING_INTERVAL_DETAILS, parseBillingInterval } from "@/lib/billing";
import {
	type BillingState,
	billingStateOf,
	isAutoRenewing,
	subscriptionPrice,
} from "@/lib/billing-state";
import { db } from "@/lib/db";

/**
 * One row per restaurant owner, joining what used to live on separate pages
 * and disagree: the account (can they sign in), each restaurant (suspended by
 * the Super Admin or not), its billing state (lib/billing-state.ts — the same
 * rule the owner and customers see), onboarding and recent activity. Plus the
 * data problems worth fixing.
 */

export type AccountFilter =
	| "all"
	| "paying"
	| "attention"
	| "lapsed"
	| "free"
	| "onboarding"
	| "suspended";

export const ACCOUNT_FILTERS: { key: AccountFilter; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "paying", label: "Paying" },
	{ key: "attention", label: "Expiring / grace" },
	{ key: "lapsed", label: "Lapsed" },
	{ key: "free", label: "Free" },
	{ key: "onboarding", label: "Not set up" },
	{ key: "suspended", label: "Suspended" },
];

export function parseAccountFilter(value: unknown): AccountFilter {
	return ACCOUNT_FILTERS.some((f) => f.key === value)
		? (value as AccountFilter)
		: "all";
}

export type AccountRestaurant = {
	id: string;
	name: string;
	slug: string;
	adminSuspended: boolean;
	suspensionReason: string | null;
	billing: {
		state: BillingState;
		planName: string | null;
		price: number;
		intervalLabel: string | null;
		periodEnd: string | null;
		autoRenew: boolean;
		/** The stored status disagrees with the dates (a missed renewal sync). */
		staleStatus: boolean;
	};
};

export type AccountRow = {
	id: string;
	name: string | null;
	email: string;
	emailVerified: boolean;
	accountActive: boolean;
	accountSuspensionReason: string | null;
	onboardingStatus: string;
	createdAt: string;
	lastActiveAt: string | null;
	restaurants: AccountRestaurant[];
	issues: string[];
};

const ONBOARDING_LABEL: Record<string, string> = {
	PENDING_PLAN: "Choosing a plan",
	PENDING_PAYMENT: "Paying for plan",
	PENDING_SETUP: "Setting up restaurant",
	COMPLETE: "Set up",
};

export function onboardingLabel(status: string) {
	return ONBOARDING_LABEL[status] ?? status;
}

const subscriptionSelect = {
	status: true,
	currentPeriodEnd: true,
	billingInterval: true,
	paystackSubscriptionCode: true,
	plan: {
		select: {
			name: true,
			monthlyPrice: true,
			quarterlyPrice: true,
			yearlyPrice: true,
		},
	},
} satisfies Prisma.SubscriptionSelect;

/**
 * Every matching owner, filtered and counted, then one page of them.
 *
 * Filters come from date-based billing state (lib/billing-state.ts), which
 * SQL can't express, so the light rows for all owners are filtered in memory
 * and only the page's rows get their last sign-in looked up.
 */
export async function getAccounts(input: {
	q?: string;
	filter: AccountFilter;
	skip: number;
	take: number;
}) {
	const query = input.q?.trim();
	const users = await db.user.findMany({
		where: {
			role: UserRole.RESTAURANT_OWNER,
			...(query
				? {
						OR: [
							{ email: { contains: query, mode: "insensitive" } },
							{ name: { contains: query, mode: "insensitive" } },
							{
								restaurants: {
									some: {
										OR: [
											{ name: { contains: query, mode: "insensitive" } },
											{ slug: { contains: query, mode: "insensitive" } },
										],
									},
								},
							},
						],
					}
				: {}),
		},
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			name: true,
			email: true,
			emailVerified: true,
			isActive: true,
			suspensionReason: true,
			onboardingStatus: true,
			createdAt: true,
			restaurants: {
				orderBy: { createdAt: "asc" },
				select: {
					id: true,
					name: true,
					slug: true,
					isActive: true,
					suspensionReason: true,
					subscription: { select: subscriptionSelect },
				},
			},
			// Subscriptions not attached to any restaurant: normal mid-onboarding,
			// orphaned afterwards.
			subscriptions: {
				where: { restaurantId: null },
				select: { id: true },
			},
		},
	});

	const now = Date.now();
	const rows: AccountRow[] = users.map((user) => {
		const restaurants: AccountRestaurant[] = user.restaurants.map((r) => {
			const sub = r.subscription;
			const state = billingStateOf(sub, now);
			const interval = sub ? parseBillingInterval(sub.billingInterval) : null;
			const paidPlan = sub ? subscriptionPrice(sub) > 0 : false;
			return {
				id: r.id,
				name: r.name,
				slug: r.slug,
				adminSuspended: !r.isActive,
				suspensionReason: r.suspensionReason,
				billing: {
					state,
					planName: sub?.plan.name ?? null,
					price: sub ? subscriptionPrice(sub) : 0,
					intervalLabel: interval
						? BILLING_INTERVAL_DETAILS[interval].label
						: null,
					periodEnd:
						paidPlan && sub ? sub.currentPeriodEnd.toISOString() : null,
					autoRenew: isAutoRenewing(sub),
					staleStatus:
						paidPlan &&
						sub?.status === "ACTIVE" &&
						(state === "LAPSED" || state === "GRACE"),
				},
			};
		});

		const issues: string[] = [];
		const ageDays = (now - user.createdAt.getTime()) / 86_400_000;
		if (user.onboardingStatus === "COMPLETE" && restaurants.length === 0) {
			issues.push("Set up, but has no restaurant");
		}
		if (user.subscriptions.length > 0 && user.onboardingStatus === "COMPLETE") {
			issues.push("Subscription not linked to any restaurant");
		}
		if (user.onboardingStatus !== "COMPLETE" && ageDays > 1) {
			issues.push(`Stuck at "${onboardingLabel(user.onboardingStatus)}"`);
		}
		if (!user.emailVerified && ageDays > 1) issues.push("Email not verified");
		for (const r of restaurants) {
			if (r.billing.state === "NONE")
				issues.push(`${r.name} has no subscription`);
			if (r.billing.staleStatus) {
				issues.push(`${r.name}: billing record still says active (cron sync)`);
			}
		}

		return {
			id: user.id,
			name: user.name,
			email: user.email,
			emailVerified: user.emailVerified,
			accountActive: user.isActive,
			accountSuspensionReason: user.suspensionReason,
			onboardingStatus: user.onboardingStatus,
			createdAt: user.createdAt.toISOString(),
			lastActiveAt: null as string | null,
			restaurants,
			issues,
		};
	});

	const matches = (row: AccountRow, filter: AccountFilter) => {
		const states = row.restaurants.map((r) => r.billing.state);
		switch (filter) {
			case "all":
				return true;
			case "paying":
				return states.some((s) => s === "ACTIVE" || s === "EXPIRING_SOON");
			case "attention":
				return states.some((s) => s === "EXPIRING_SOON" || s === "GRACE");
			case "lapsed":
				return states.includes("LAPSED");
			case "free":
				return states.includes("FREE");
			case "onboarding":
				return (
					row.onboardingStatus !== "COMPLETE" || row.restaurants.length === 0
				);
			case "suspended":
				return (
					!row.accountActive || row.restaurants.some((r) => r.adminSuspended)
				);
		}
	};

	const counts = Object.fromEntries(
		(
			[
				"all",
				"paying",
				"attention",
				"lapsed",
				"free",
				"onboarding",
				"suspended",
			] as const
		).map((f) => [f, rows.filter((row) => matches(row, f)).length]),
	) as Record<AccountFilter, number>;

	const filtered = rows.filter((row) => matches(row, input.filter));
	const pageRows = filtered.slice(input.skip, input.skip + input.take);
	const lastSeen = await db.session.groupBy({
		by: ["userId"],
		where: { userId: { in: pageRows.map((r) => r.id) } },
		_max: { updatedAt: true },
	});
	const seen = new Map(lastSeen.map((s) => [s.userId, s._max.updatedAt]));
	for (const row of pageRows) {
		row.lastActiveAt = seen.get(row.id)?.toISOString() ?? null;
	}

	return {
		rows: pageRows,
		total: filtered.length,
		counts,
		issueCount: rows.filter((row) => row.issues.length > 0).length,
	};
}
