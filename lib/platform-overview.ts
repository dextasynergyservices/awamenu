import { OrderStatus, PaymentStatus, Prisma, UserRole } from "@prisma/client";
import { BILLING_INTERVAL_DETAILS, parseBillingInterval } from "@/lib/billing";
import {
	type BillingState,
	billingStateOf,
	isRevenueState,
	subscriptionPrice,
} from "@/lib/billing-state";
import { getCronRuns } from "@/lib/cron-heartbeat";
import { db } from "@/lib/db";
import {
	addDaysToDateKey,
	dateKeyIn,
	percentChange,
} from "@/lib/restaurant-day";

/**
 * Everything the Super Admin overview shows, in one place. Platform figures
 * are grouped by day on Lagos time (the platform's home timezone).
 */

const PLATFORM_TZ = "Africa/Lagos";
const DAY = 24 * 60 * 60 * 1000;

export type DailyPoint = { date: string; value: number };

export type Kpi = {
	label: string;
	value: number;
	previous: number;
	change: number | null;
	format: "money" | "count";
	series: DailyPoint[];
	href?: string;
};

export type AttentionItem = {
	key: string;
	count: number;
	title: string;
	detail: string;
	href: string;
	severity: "critical" | "warning" | "info";
};

type DailyRow = { day: string; n: number; amount: number };

/** One row per Lagos calendar day in the window, zero-filled. */
function fillSeries(
	rows: DailyRow[],
	days: number,
	pick: (row: DailyRow) => number,
): DailyPoint[] {
	const today = dateKeyIn(PLATFORM_TZ, new Date());
	const byDay = new Map(rows.map((row) => [row.day, pick(row)]));
	return Array.from({ length: days }, (_, i) => {
		const date = addDaysToDateKey(today, i - days + 1);
		return { date, value: byDay.get(date) ?? 0 };
	});
}

const sum = (points: DailyPoint[]) => points.reduce((t, p) => t + p.value, 0);

export async function getPlatformOverview() {
	const now = new Date();
	const ago = (ms: number) => new Date(now.getTime() - ms);
	const since60 = ago(60 * DAY);
	const since90 = ago(90 * DAY);

	// Daily series over 60 days: the last 30 are "now", the 30 before are the
	// comparison. Grouped in SQL so this stays cheap as order volume grows.
	const lagosDay = (column: string) =>
		Prisma.raw(
			`to_char(("${column}" AT TIME ZONE 'UTC') AT TIME ZONE '${PLATFORM_TZ}', 'YYYY-MM-DD')`,
		);

	const [
		orderDaily,
		subscriptionDaily,
		restaurantDaily,
		signupDaily,
		subscriptions,
		settings,
		attentionCounts,
		funnel,
		topRaw,
		recentRaw,
		cronRuns,
		activity,
	] = await Promise.all([
		db.$queryRaw<DailyRow[]>`
			SELECT ${lagosDay("createdAt")} AS day,
				count(*)::int AS n,
				coalesce(sum(CASE WHEN "paymentStatus" = 'PAID' THEN total ELSE 0 END), 0)::float AS amount
			FROM "Order"
			WHERE "createdAt" >= ${since60} AND status <> 'CANCELLED'
			GROUP BY 1`,
		db.$queryRaw<DailyRow[]>`
			SELECT ${lagosDay("createdAt")} AS day, count(*)::int AS n,
				coalesce(sum(amount), 0)::float AS amount
			FROM "SubscriptionPayment"
			WHERE "createdAt" >= ${since60} AND status = 'SUCCESS'
			GROUP BY 1`,
		db.$queryRaw<DailyRow[]>`
			SELECT ${lagosDay("createdAt")} AS day, count(*)::int AS n, 0::float AS amount
			FROM "Restaurant"
			WHERE "createdAt" >= ${since60}
			GROUP BY 1`,
		db.$queryRaw<DailyRow[]>`
			SELECT ${lagosDay("createdAt")} AS day, count(*)::int AS n, 0::float AS amount
			FROM "User"
			WHERE "createdAt" >= ${since60} AND role = 'RESTAURANT_OWNER'
			GROUP BY 1`,
		db.subscription.findMany({
			select: {
				status: true,
				restaurantId: true,
				user: { select: { onboardingStatus: true } },
				billingInterval: true,
				currentPeriodEnd: true,
				restaurant: { select: { isActive: true } },
				plan: {
					select: {
						name: true,
						tier: true,
						monthlyPrice: true,
						quarterlyPrice: true,
						yearlyPrice: true,
					},
				},
			},
		}),
		db.platformSetting.findFirst({
			select: { maintenanceMode: true, legalCompanyName: true },
		}),
		Promise.all([
			// Paid but refused for a wrong amount: needs a human.
			db.subscriptionPayment.count({ where: { status: "MISMATCH" } }),
			db.orderPayment.count({ where: { status: "MISMATCH" } }),
			// Customer refunds a restaurant still owes after 3 days.
			db.order.count({
				where: {
					refundRequiredReason: { not: null },
					updatedAt: { lt: ago(3 * DAY) },
				},
			}),
			db.reservation.count({
				where: {
					refundRequiredReason: { not: null },
					updatedAt: { lt: ago(3 * DAY) },
				},
			}),
			// AwaMenu Pay switched on with nowhere to settle the money.
			db.restaurant.count({
				where: {
					isActive: true,
					paymentMethods: { some: { channel: "AWAMENU_PAY", isEnabled: true } },
					payoutAccounts: { none: { isEnabled: true } },
				},
			}),
			// Signed up 1–30 days ago and still not trading.
			db.user.count({
				where: {
					role: UserRole.RESTAURANT_OWNER,
					onboardingStatus: { not: "COMPLETE" },
					createdAt: { lt: ago(DAY), gte: ago(30 * DAY) },
				},
			}),
			db.outboxJob.count({
				where: { status: "DEAD", updatedAt: { gte: ago(7 * DAY) } },
			}),
			// Overdue by 15 minutes: the payments cron isn't draining the queue.
			db.outboxJob.count({
				where: {
					status: { in: ["PENDING", "FAILED"] },
					runAfter: { lt: ago(15 * 60 * 1000) },
				},
			}),
			// Past the 24h verification window: the sweep should have closed these.
			db.paymentAttempt.count({
				where: {
					status: "PENDING",
					createdAt: { lt: ago(25 * 60 * 60 * 1000) },
				},
			}),
			db.outboxJob.aggregate({ _max: { sentAt: true } }),
		]),
		// Owners who signed up in the last 90 days, step by step.
		(() => {
			const cohort = {
				role: UserRole.RESTAURANT_OWNER,
				createdAt: { gte: since90 },
			};
			return Promise.all([
				db.user.count({ where: cohort }),
				db.user.count({ where: { ...cohort, emailVerified: true } }),
				db.user.count({
					where: { ...cohort, onboardingStatus: { not: "PENDING_PLAN" } },
				}),
				db.user.count({ where: { ...cohort, restaurants: { some: {} } } }),
				db.user.count({
					where: {
						...cohort,
						restaurants: {
							some: {
								categories: {
									some: {
										isActive: true,
										items: { some: { isAvailable: true } },
									},
								},
							},
						},
					},
				}),
				db.user.count({
					where: { ...cohort, restaurants: { some: { orders: { some: {} } } } },
				}),
			]);
		})(),
		db.order.groupBy({
			by: ["restaurantId"],
			where: {
				createdAt: { gte: ago(30 * DAY) },
				paymentStatus: PaymentStatus.PAID,
				status: { not: OrderStatus.CANCELLED },
			},
			_sum: { total: true },
			_count: true,
			orderBy: { _sum: { total: "desc" } },
			take: 5,
		}),
		// Last order per restaurant over 60 days, for "going quiet".
		db.order.groupBy({
			by: ["restaurantId"],
			where: {
				createdAt: { gte: since60 },
				status: { not: OrderStatus.CANCELLED },
			},
			_max: { createdAt: true },
			_count: true,
		}),
		getCronRuns(),
		Promise.all([
			db.restaurant.findMany({
				orderBy: { createdAt: "desc" },
				take: 6,
				select: { id: true, name: true, createdAt: true },
			}),
			db.subscriptionPayment.findMany({
				where: { status: "SUCCESS" },
				orderBy: { createdAt: "desc" },
				take: 6,
				select: {
					amount: true,
					kind: true,
					createdAt: true,
					restaurantId: true,
				},
			}),
			db.auditLog.findMany({
				orderBy: { createdAt: "desc" },
				take: 6,
				select: {
					action: true,
					target: true,
					adminName: true,
					createdAt: true,
				},
			}),
		]),
	]);

	// ── Subscriptions now ──
	const stateCounts: Record<BillingState, number> = {
		ACTIVE: 0,
		EXPIRING_SOON: 0,
		GRACE: 0,
		LAPSED: 0,
		FREE: 0,
		NONE: 0,
	};
	let adminSuspended = 0;
	// Data problems: a billing record that still says ACTIVE after its dates
	// ran out (the subscriptions cron hasn't synced it), and subscriptions not
	// linked to any restaurant once onboarding is done.
	let staleStatus = 0;
	let orphanSubscriptions = 0;
	let mrr = 0;
	const planMix = new Map<
		string,
		{ name: string; tier: string; count: number }
	>();
	for (const sub of subscriptions) {
		const state = billingStateOf(sub, now.getTime());
		stateCounts[state]++;
		if (sub.restaurant?.isActive === false) adminSuspended++;
		if (
			sub.status === "ACTIVE" &&
			subscriptionPrice(sub) > 0 &&
			(state === "LAPSED" || state === "GRACE")
		) {
			staleStatus++;
		}
		if (!sub.restaurantId && sub.user.onboardingStatus === "COMPLETE") {
			orphanSubscriptions++;
		}
		// Monthly equivalent: a ₦30,000 quarterly plan is ₦10,000 of MRR.
		if (isRevenueState(state)) {
			mrr +=
				subscriptionPrice(sub) /
				BILLING_INTERVAL_DETAILS[parseBillingInterval(sub.billingInterval)]
					.months;
		}
		if (state !== "LAPSED" && sub.restaurant?.isActive !== false) {
			const entry = planMix.get(sub.plan.name) ?? {
				name: sub.plan.name,
				tier: sub.plan.tier,
				count: 0,
			};
			entry.count++;
			planMix.set(sub.plan.name, entry);
		}
	}
	const payingRestaurants = stateCounts.ACTIVE + stateCounts.EXPIRING_SOON;

	// ── KPIs: last 30 days vs the 30 before ──
	const kpi = (
		label: string,
		rows: DailyRow[],
		pick: (row: DailyRow) => number,
		format: Kpi["format"],
		href?: string,
	): Kpi => {
		const all = fillSeries(rows, 60, pick);
		const series = all.slice(30);
		const value = sum(series);
		const previous = sum(all.slice(0, 30));
		return {
			label,
			value,
			previous,
			change: percentChange(value, previous),
			format,
			series,
			href,
		};
	};
	const kpis: Kpi[] = [
		kpi(
			"Subscription revenue",
			subscriptionDaily,
			(r) => r.amount,
			"money",
			"/super-admin/payments",
		),
		kpi("Order value (GMV)", orderDaily, (r) => r.amount, "money"),
		kpi("Orders", orderDaily, (r) => r.n, "count"),
		kpi(
			"New restaurants",
			restaurantDaily,
			(r) => r.n,
			"count",
			"/super-admin/restaurants",
		),
		kpi(
			"Owner sign-ups",
			signupDaily,
			(r) => r.n,
			"count",
			"/super-admin/users",
		),
	];

	// ── Needs attention ──
	const [
		subscriptionMismatches,
		orderMismatches,
		overdueOrderRefunds,
		overdueReservationRefunds,
		payoutMissing,
		stuckOnboarding,
		deadMessages,
		overdueMessages,
		stuckAttempts,
		lastSent,
	] = attentionCounts;
	const lateCrons = cronRuns.filter((run) => run.late);

	const attention: AttentionItem[] = [
		{
			key: "mismatch",
			count: subscriptionMismatches + orderMismatches,
			title: "Payments with the wrong amount",
			detail:
				"Paid, but the amount or currency didn't match, so nothing was credited. Check each with the provider and refund or credit it.",
			href: "/super-admin/payments",
			severity: "critical",
		},
		{
			key: "cron",
			count: lateCrons.length,
			title: "Scheduled jobs not reporting",
			detail: `No recent run from: ${lateCrons.map((c) => c.label).join(", ")}. Right after a deploy this clears as each job runs; otherwise check cron-job.org and CRON_SECRET.`,
			href: "/super-admin#system-health",
			severity: "critical",
		},
		{
			key: "stuck-payments",
			count: stuckAttempts,
			title: "Payment checks stuck",
			detail:
				"Checkouts older than 24 hours still waiting to be verified. The payments cron closes these; if it's late, fix that first.",
			href: "/super-admin#system-health",
			severity: "warning",
		},
		{
			key: "messages-overdue",
			count: overdueMessages,
			title: "Messages waiting to send",
			detail:
				"Emails or WhatsApp/SMS updates overdue by 15+ minutes. Usually the payments cron isn't running.",
			href: "/super-admin#system-health",
			severity: "warning",
		},
		{
			key: "messages-dead",
			count: deadMessages,
			title: "Messages that failed for good (7 days)",
			detail:
				"Gave up after 6 attempts and were reported to Sentry. Check the provider (Resend, Twilio) and their logs.",
			href: "/super-admin#system-health",
			severity: "warning",
		},
		{
			key: "refunds",
			count: overdueOrderRefunds + overdueReservationRefunds,
			title: "Customer refunds overdue",
			detail:
				"Restaurants were told to refund these more than 3 days ago and haven't marked them done.",
			href: "/super-admin/restaurants",
			severity: "warning",
		},
		{
			key: "lapsed",
			count: stateCounts.LAPSED,
			title: "Restaurants lapsed (read-only)",
			detail:
				"Unpaid past grace: customers can view the menu but not order. They reactivate the moment they pay.",
			href: "/super-admin/subscriptions?state=LAPSED",
			severity: "info",
		},
		{
			key: "data",
			count: staleStatus + orphanSubscriptions,
			title: "Account data out of sync",
			detail: [
				staleStatus
					? `${staleStatus} billing record${staleStatus === 1 ? "" : "s"} still marked active after expiry (check the subscriptions cron)`
					: null,
				orphanSubscriptions
					? `${orphanSubscriptions} subscription${orphanSubscriptions === 1 ? "" : "s"} not linked to a restaurant`
					: null,
			]
				.filter(Boolean)
				.join("; "),
			href: "/super-admin/users",
			severity: "warning",
		},
		{
			key: "grace",
			count: stateCounts.GRACE,
			title: "Subscriptions in their grace period",
			detail: "Renewal failed or wasn't paid. They're suspended after 3 days.",
			href: "/super-admin/subscriptions?state=GRACE",
			severity: "warning",
		},
		{
			key: "payout",
			count: payoutMissing,
			title: "AwaMenu Pay with no payout account",
			detail:
				"These restaurants offer AwaMenu Pay but have no account to settle to, so customers can't pay online.",
			href: "/super-admin/restaurants",
			severity: "warning",
		},
		{
			key: "onboarding",
			count: stuckOnboarding,
			title: "Sign-ups stuck in onboarding",
			detail:
				"Signed up in the last 30 days but never finished setting up. A nudge often helps.",
			href: "/super-admin/users",
			severity: "info",
		},
		{
			key: "expiring",
			count: stateCounts.EXPIRING_SOON,
			title: "Subscriptions expiring within 7 days",
			detail: "Owners get reminders automatically.",
			href: "/super-admin/subscriptions?state=EXPIRING_SOON",
			severity: "info",
		},
		{
			key: "legal",
			count: settings?.legalCompanyName ? 0 : 1,
			title: "Legal pages missing company details",
			detail: "The Privacy, Terms and Refund pages show placeholders.",
			href: "/super-admin/legal",
			severity: "warning",
		},
		{
			key: "maintenance",
			count: settings?.maintenanceMode ? 1 : 0,
			title: "Maintenance mode is on",
			detail: "Customers and owners can't use the app.",
			href: "/super-admin/settings",
			severity: "critical",
		},
	].filter((item): item is AttentionItem => item.count > 0);
	const severityRank = { critical: 0, warning: 1, info: 2 } as const;
	attention.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

	// ── Restaurants worth knowing about ──
	const quietCutoff = ago(14 * DAY);
	const quietRaw = recentRaw
		.filter((r) => r._max.createdAt && r._max.createdAt < quietCutoff)
		.sort(
			(a, b) =>
				(b._max.createdAt?.getTime() ?? 0) - (a._max.createdAt?.getTime() ?? 0),
		);
	const nameIds = [
		...new Set([
			...topRaw.map((r) => r.restaurantId),
			...quietRaw.map((r) => r.restaurantId),
			...activity[1]
				.map((p) => p.restaurantId)
				.filter((id): id is string => !!id),
		]),
	];
	const restaurants = nameIds.length
		? await db.restaurant.findMany({
				where: { id: { in: nameIds } },
				select: { id: true, name: true, slug: true, isActive: true },
			})
		: [];
	const byId = new Map(restaurants.map((r) => [r.id, r]));

	const topRestaurants = topRaw.flatMap((row) => {
		const r = byId.get(row.restaurantId);
		return r
			? [
					{
						id: r.id,
						name: r.name,
						gmv: Number(row._sum.total ?? 0),
						orders: row._count,
					},
				]
			: [];
	});
	const quietRestaurants = quietRaw
		.flatMap((row) => {
			const r = byId.get(row.restaurantId);
			return r?.isActive && row._max.createdAt
				? [
						{
							id: r.id,
							name: r.name,
							lastOrderAt: row._max.createdAt,
							ordersBefore: row._count,
						},
					]
				: [];
		})
		.slice(0, 5);

	// ── Activity ──
	const [newRestaurants, payments, adminActions] = activity;
	const recentActivity = [
		...newRestaurants.map((r) => ({
			kind: "restaurant" as const,
			label: `${r.name} joined`,
			at: r.createdAt,
			href: `/super-admin/restaurants/${r.id}`,
		})),
		...payments.map((p) => ({
			kind: "payment" as const,
			label: `₦${Number(p.amount).toLocaleString()} ${p.kind === "RENEWAL" ? "renewal" : "subscription"}${
				p.restaurantId && byId.get(p.restaurantId)
					? ` from ${byId.get(p.restaurantId)?.name}`
					: ""
			}`,
			at: p.createdAt,
			href: "/super-admin/payments",
		})),
		...adminActions.map((a) => ({
			kind: "admin" as const,
			label: `${a.adminName}: ${a.action} · ${a.target}`,
			at: a.createdAt,
			href: "/super-admin/audit-logs",
		})),
	]
		.sort((a, b) => b.at.getTime() - a.at.getTime())
		.slice(0, 10);

	const [signedUp, verified, choseplan, created, published, firstOrder] =
		funnel;

	return {
		attention,
		kpis,
		mrr,
		payingRestaurants,
		stateCounts,
		adminSuspended,
		planMix: [...planMix.values()].sort((a, b) => b.count - a.count),
		funnel: [
			{ label: "Signed up", count: signedUp },
			{ label: "Verified email", count: verified },
			{ label: "Chose a plan", count: choseplan },
			{ label: "Created restaurant", count: created },
			{ label: "Published menu", count: published },
			{ label: "First order", count: firstOrder },
		],
		topRestaurants,
		quietRestaurants,
		health: {
			cronRuns,
			overdueMessages,
			deadMessages,
			stuckAttempts,
			lastMessageSentAt: lastSent._max.sentAt,
			maintenanceMode: settings?.maintenanceMode ?? false,
		},
		recentActivity,
	};
}

export type PlatformOverview = Awaited<ReturnType<typeof getPlatformOverview>>;
