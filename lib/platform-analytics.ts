import { Prisma } from "@prisma/client";
import {
	BILLING_INTERVAL_DETAILS,
	getPlanIntervalPrice,
	parseBillingInterval,
} from "@/lib/billing";
import { db } from "@/lib/db";
import {
	addDaysToDateKey,
	dateKeyIn,
	startOfDateIn,
} from "@/lib/restaurant-day";

/**
 * Platform-wide business analytics for the Super Admin.
 *
 * Everything is in Lagos time and compared with the period of the same
 * length just before. Series are bucketed by day (up to ~3 months), week (up
 * to ~a year) or month (longer), with every bucket present so charts never
 * skip a gap. All aggregation happens in SQL; nothing loads every order.
 */

const TZ = "Africa/Lagos";
const DAY = 86_400_000;

export const PLATFORM_RANGES = [
	{ key: "7", label: "7D", days: 7 },
	{ key: "30", label: "30D", days: 30 },
	{ key: "90", label: "90D", days: 90 },
	{ key: "365", label: "12M", days: 365 },
	{ key: "all", label: "All", days: null },
] as const;

export type Granularity = "day" | "week" | "month";

export type PlatformRange = {
	key: string;
	fromKey: string;
	toKey: string;
	from: Date;
	/** Exclusive end (start of the day after `toKey`). */
	to: Date;
	prevFrom: Date;
	days: number;
	granularity: Granularity;
	custom: boolean;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function parsePlatformRange(params: {
	range?: string;
	from?: string;
	to?: string;
}): Promise<PlatformRange> {
	const today = dateKeyIn(TZ, new Date());
	let fromKey: string;
	let toKey = today;
	let key = params.range ?? "30";
	let custom = false;

	if (
		params.from &&
		DATE.test(params.from) &&
		(!params.to || DATE.test(params.to))
	) {
		fromKey = params.from;
		toKey = params.to && DATE.test(params.to) ? params.to : today;
		if (fromKey > toKey) [fromKey, toKey] = [toKey, fromKey];
		if (toKey > today) toKey = today;
		key = "custom";
		custom = true;
	} else if (key === "all") {
		const first = await db.restaurant.findFirst({
			orderBy: { createdAt: "asc" },
			select: { createdAt: true },
		});
		fromKey = first
			? dateKeyIn(TZ, first.createdAt)
			: addDaysToDateKey(today, -29);
	} else {
		const preset =
			PLATFORM_RANGES.find((r) => r.key === key && r.days) ??
			PLATFORM_RANGES[1];
		key = preset.key;
		fromKey = addDaysToDateKey(today, -((preset.days ?? 30) - 1));
	}

	const from = startOfDateIn(TZ, fromKey);
	const to = startOfDateIn(TZ, addDaysToDateKey(toKey, 1));
	const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY));
	return {
		key,
		fromKey,
		toKey,
		from,
		to,
		prevFrom: new Date(from.getTime() - days * DAY),
		days,
		granularity: days <= 92 ? "day" : days <= 400 ? "week" : "month",
		custom,
	};
}

/** Bucket keys covering the range: each day, each Monday, or each 1st. */
function bucketKeys(range: PlatformRange) {
	const keys: string[] = [];
	const start = new Date(`${range.fromKey}T12:00:00Z`);
	if (range.granularity === "week")
		start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
	if (range.granularity === "month") start.setUTCDate(1);
	const end = new Date(`${range.toKey}T12:00:00Z`);
	for (const d = start; d <= end; ) {
		keys.push(d.toISOString().slice(0, 10));
		if (range.granularity === "day") d.setUTCDate(d.getUTCDate() + 1);
		else if (range.granularity === "week") d.setUTCDate(d.getUTCDate() + 7);
		else d.setUTCMonth(d.getUTCMonth() + 1);
	}
	return keys;
}

function bucketLabel(key: string, g: Granularity) {
	const d = new Date(`${key}T12:00:00Z`);
	if (g === "month")
		return d.toLocaleDateString("en-GB", {
			month: "short",
			year: "2-digit",
			timeZone: "UTC",
		});
	const label = d.toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
	return g === "week" ? `w/c ${label}` : label;
}

const bucket = (column: string, g: Granularity) =>
	Prisma.sql`to_char(date_trunc(${g}, (${Prisma.raw(column)} AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}), 'YYYY-MM-DD')`;

const pct = (now: number, before: number) =>
	before > 0 ? ((now - before) / before) * 100 : null;

export async function getPlatformAnalytics(range: PlatformRange) {
	const { from, to, prevFrom, granularity: g } = range;
	const live = Prisma.sql`status <> 'CANCELLED'`;
	const paidAwamenu = Prisma.sql`direction = 'CREDIT' AND status = 'SUCCESS' AND "subaccountCode" IS NOT NULL`;

	const [
		orderSeries,
		subSeries,
		commissionSeries,
		signupSeries,
		ownerSeries,
		periodTotals,
		prevTotals,
		heatRows,
		typeRows,
		methodRows,
		topRows,
		funnelRows,
		cohortRows,
		ledger,
		bookings,
		scans,
		prevScans,
	] = await Promise.all([
		db.$queryRaw<
			{ key: string; orders: number; gmv: number; active: number }[]
		>`
			SELECT ${bucket('"createdAt"', g)} AS key, count(*)::int AS orders,
				coalesce(sum(total) FILTER (WHERE "paymentStatus" = 'PAID'), 0)::float AS gmv,
				count(DISTINCT "restaurantId")::int AS active
			FROM "Order" WHERE ${live} AND "createdAt" >= ${from} AND "createdAt" < ${to}
			GROUP BY 1`,
		db.$queryRaw<
			{ key: string; revenue: number; initial: number; renewal: number }[]
		>`
			SELECT ${bucket('"createdAt"', g)} AS key, coalesce(sum(amount), 0)::float AS revenue,
				coalesce(sum(amount) FILTER (WHERE kind = 'INITIAL'), 0)::float AS initial,
				coalesce(sum(amount) FILTER (WHERE kind <> 'INITIAL'), 0)::float AS renewal
			FROM "SubscriptionPayment" WHERE status = 'SUCCESS' AND "createdAt" >= ${from} AND "createdAt" < ${to}
			GROUP BY 1`,
		db.$queryRaw<{ key: string; commission: number; volume: number }[]>`
			SELECT ${bucket('"createdAt"', g)} AS key, coalesce(sum("platformFee"), 0)::float AS commission,
				coalesce(sum(amount), 0)::float AS volume
			FROM "OrderPayment" WHERE ${paidAwamenu} AND "createdAt" >= ${from} AND "createdAt" < ${to}
			GROUP BY 1`,
		db.$queryRaw<{ key: string; n: number }[]>`
			SELECT ${bucket('"createdAt"', g)} AS key, count(*)::int AS n
			FROM "Restaurant" WHERE "createdAt" >= ${from} AND "createdAt" < ${to} GROUP BY 1`,
		db.$queryRaw<{ key: string; n: number }[]>`
			SELECT ${bucket('"createdAt"', g)} AS key, count(*)::int AS n
			FROM "User" WHERE role = 'RESTAURANT_OWNER' AND "createdAt" >= ${from} AND "createdAt" < ${to} GROUP BY 1`,
		totalsFor(from, to),
		totalsFor(prevFrom, from),
		db.$queryRaw<{ dow: number; hour: number; n: number }[]>`
			SELECT extract(dow FROM ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ})::int AS dow,
				extract(hour FROM ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ})::int AS hour, count(*)::int AS n
			FROM "Order" WHERE ${live} AND "createdAt" >= ${from} AND "createdAt" < ${to} GROUP BY 1, 2`,
		db.$queryRaw<{ type: string; orders: number; gmv: number }[]>`
			SELECT type::text AS type, count(*)::int AS orders,
				coalesce(sum(total) FILTER (WHERE "paymentStatus" = 'PAID'), 0)::float AS gmv
			FROM "Order" WHERE ${live} AND "createdAt" >= ${from} AND "createdAt" < ${to} GROUP BY 1`,
		db.$queryRaw<
			{ method: string; amount: number; n: number; awamenuPay: boolean }[]
		>`
			SELECT method::text AS method, ("subaccountCode" IS NOT NULL) AS "awamenuPay",
				coalesce(sum(amount), 0)::float AS amount, count(*)::int AS n
			FROM "OrderPayment" WHERE direction = 'CREDIT' AND status = 'SUCCESS' AND "createdAt" >= ${from} AND "createdAt" < ${to}
			GROUP BY 1, 2`,
		db.$queryRaw<
			{ restaurantId: string; gmv: number; orders: number; prevGmv: number }[]
		>`
			SELECT "restaurantId",
				coalesce(sum(total) FILTER (WHERE "createdAt" >= ${from} AND "paymentStatus" = 'PAID'), 0)::float AS gmv,
				count(*) FILTER (WHERE "createdAt" >= ${from})::int AS orders,
				coalesce(sum(total) FILTER (WHERE "createdAt" < ${from} AND "paymentStatus" = 'PAID'), 0)::float AS "prevGmv"
			FROM "Order" WHERE ${live} AND "createdAt" >= ${prevFrom} AND "createdAt" < ${to}
			GROUP BY 1 ORDER BY gmv DESC LIMIT 10`,
		// Owners who signed up in the range, and how far each got.
		db.$queryRaw<
			{
				signedUp: number;
				verified: number;
				restaurant: number;
				menu: number;
				ordered: number;
				paying: number;
			}[]
		>`
			WITH owners AS (
				SELECT id, "emailVerified" FROM "User"
				WHERE role = 'RESTAURANT_OWNER' AND "createdAt" >= ${from} AND "createdAt" < ${to}
			), rest AS (
				SELECT r.id, r."ownerId" FROM "Restaurant" r JOIN owners o ON o.id = r."ownerId"
			)
			SELECT
				(SELECT count(*) FROM owners)::int AS "signedUp",
				(SELECT count(*) FROM owners WHERE "emailVerified")::int AS verified,
				(SELECT count(DISTINCT "ownerId") FROM rest)::int AS restaurant,
				(SELECT count(DISTINCT r."ownerId") FROM rest r WHERE EXISTS (
					SELECT 1 FROM "MenuItem" mi JOIN "MenuCategory" c ON c.id = mi."categoryId" WHERE c."restaurantId" = r.id
				))::int AS menu,
				(SELECT count(DISTINCT r."ownerId") FROM rest r WHERE EXISTS (
					SELECT 1 FROM "Order" o WHERE o."restaurantId" = r.id AND o.status <> 'CANCELLED'
				))::int AS ordered,
				-- Paid at least once, or on a paid plan now (subscriptions set up
				-- before the payment ledger existed have no payment rows).
				(SELECT count(*) FROM owners o WHERE EXISTS (
					SELECT 1 FROM "SubscriptionPayment" p WHERE p."userId" = o.id AND p.status = 'SUCCESS' AND p.amount > 0
				) OR EXISTS (
					SELECT 1 FROM "Subscription" s JOIN "Plan" pl ON pl.id = s."planId"
					WHERE s."userId" = o.id AND (pl."monthlyPrice" > 0 OR pl."quarterlyPrice" > 0 OR pl."yearlyPrice" > 0)
				))::int AS paying`,
		// Monthly cohorts (last 6 signup months): restaurants with an order in
		// each month after joining.
		db.$queryRaw<
			{ cohort: string; size: number; offset: number; active: number }[]
		>`
			WITH cohorts AS (
				SELECT id, date_trunc('month', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}) AS m
				FROM "Restaurant"
				WHERE "createdAt" >= date_trunc('month', (now() AT TIME ZONE ${TZ})) - interval '5 months'
			), activity AS (
				SELECT DISTINCT "restaurantId", date_trunc('month', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${TZ}) AS m
				FROM "Order" WHERE status <> 'CANCELLED'
			), sizes AS (SELECT m, count(*)::int AS size FROM cohorts GROUP BY m)
			SELECT to_char(c.m, 'YYYY-MM') AS cohort, s.size,
				((extract(year FROM a.m) - extract(year FROM c.m)) * 12 + extract(month FROM a.m) - extract(month FROM c.m))::int AS "offset",
				count(DISTINCT c.id)::int AS active
			FROM cohorts c JOIN sizes s ON s.m = c.m
			LEFT JOIN activity a ON a."restaurantId" = c.id AND a.m >= c.m
			GROUP BY 1, 2, 3
			ORDER BY 1, 3`,
		// Every paid subscription payment, to rebuild MRR at any date.
		db.subscriptionPayment.findMany({
			where: { status: "SUCCESS", amount: { gt: 0 } },
			select: {
				createdAt: true,
				amount: true,
				billingInterval: true,
				subscriptionId: true,
				userId: true,
			},
		}),
		db.reservation.aggregate({
			where: {
				startsAt: { gte: from, lt: to },
				status: { in: ["ACTIVE", "CHECKED_IN", "COMPLETED"] },
			},
			_count: true,
			_sum: { partySize: true },
		}),
		db.scanEvent.count({ where: { scannedAt: { gte: from, lt: to } } }),
		db.scanEvent.count({ where: { scannedAt: { gte: prevFrom, lt: from } } }),
	]);

	// ── Series ──
	const keys = bucketKeys(range);
	const pick = <T extends { key: string }>(rows: T[]) =>
		new Map(rows.map((r) => [r.key, r]));
	const o = pick(orderSeries);
	const s = pick(subSeries);
	const c = pick(commissionSeries);
	const r = new Map(signupSeries.map((x) => [x.key, x.n]));
	const u = new Map(ownerSeries.map((x) => [x.key, x.n]));

	// MRR at the end of each bucket: every paid period covering that moment,
	// at its monthly equivalent. Periods come from the payment ledger and from
	// each subscription's current period (subscriptions that predate the
	// ledger, or were set up by an admin, have no payment rows). One period
	// per subscription counts at a time: the latest to start.
	const subscriptions = await db.subscription.findMany({
		select: {
			id: true,
			billingInterval: true,
			currentPeriodStart: true,
			currentPeriodEnd: true,
			plan: {
				select: { monthlyPrice: true, quarterlyPrice: true, yearlyPrice: true },
			},
		},
	});
	const covering = [
		...ledger.map((p) => {
			const months =
				BILLING_INTERVAL_DETAILS[parseBillingInterval(p.billingInterval)]
					.months;
			const end = new Date(p.createdAt);
			end.setMonth(end.getMonth() + months);
			return {
				start: p.createdAt.getTime(),
				end: end.getTime(),
				monthly: Number(p.amount) / months,
				who: p.subscriptionId ?? p.userId,
			};
		}),
		...subscriptions.flatMap((sub) => {
			const interval = parseBillingInterval(sub.billingInterval);
			const price = getPlanIntervalPrice(sub.plan, interval);
			if (price <= 0) return [];
			return [
				{
					start: sub.currentPeriodStart.getTime(),
					end: sub.currentPeriodEnd.getTime(),
					monthly: price / BILLING_INTERVAL_DETAILS[interval].months,
					who: sub.id,
				},
			];
		}),
	];
	const mrrAt = (t: number) => {
		// One payment per subscription at a time: the latest that covers t.
		const best = new Map<string, { start: number; monthly: number }>();
		for (const p of covering) {
			if (p.start <= t && t < p.end) {
				const cur = best.get(p.who);
				if (!cur || p.start > cur.start)
					best.set(p.who, { start: p.start, monthly: p.monthly });
			}
		}
		let sum = 0;
		for (const v of best.values()) sum += v.monthly;
		return sum;
	};

	const series = keys.map((key, i) => {
		const next = keys[i + 1];
		const endMs = next
			? startOfDateIn(TZ, next).getTime()
			: Math.min(to.getTime(), Date.now());
		const subs = s.get(key);
		const com = c.get(key);
		return {
			key,
			label: bucketLabel(key, g),
			orders: o.get(key)?.orders ?? 0,
			gmv: o.get(key)?.gmv ?? 0,
			activeRestaurants: o.get(key)?.active ?? 0,
			subscriptions: subs?.revenue ?? 0,
			newSubscriptions: subs?.initial ?? 0,
			renewals: subs?.renewal ?? 0,
			commission: com?.commission ?? 0,
			awamenuPayVolume: com?.volume ?? 0,
			revenue: (subs?.revenue ?? 0) + (com?.commission ?? 0),
			restaurantsJoined: r.get(key) ?? 0,
			ownersJoined: u.get(key) ?? 0,
			mrr: mrrAt(endMs - 1),
		};
	});

	// ── KPIs ──
	const k = periodTotals;
	const p = prevTotals;
	const mrrNow = mrrAt(Math.min(to.getTime(), Date.now()) - 1);
	const mrrBefore = mrrAt(from.getTime() - 1);
	const kpis = {
		revenue: {
			value: k.subscriptions + k.commission,
			change: pct(
				k.subscriptions + k.commission,
				p.subscriptions + p.commission,
			),
		},
		subscriptions: {
			value: k.subscriptions,
			change: pct(k.subscriptions, p.subscriptions),
		},
		commission: {
			value: k.commission,
			change: pct(k.commission, p.commission),
		},
		mrr: { value: mrrNow, change: pct(mrrNow, mrrBefore) },
		gmv: { value: k.gmv, change: pct(k.gmv, p.gmv) },
		orders: { value: k.orders, change: pct(k.orders, p.orders) },
		aov: {
			value: k.paidOrders ? k.gmv / k.paidOrders : 0,
			change: pct(
				k.paidOrders ? k.gmv / k.paidOrders : 0,
				p.paidOrders ? p.gmv / p.paidOrders : 0,
			),
		},
		activeRestaurants: {
			value: k.activeRestaurants,
			change: pct(k.activeRestaurants, p.activeRestaurants),
		},
		newRestaurants: {
			value: k.newRestaurants,
			change: pct(k.newRestaurants, p.newRestaurants),
		},
		newOwners: { value: k.newOwners, change: pct(k.newOwners, p.newOwners) },
		takeRate: {
			value:
				k.awamenuPayVolume > 0 ? (k.commission / k.awamenuPayVolume) * 100 : 0,
		},
		awamenuPayShare: {
			value: k.onlineGmv > 0 ? (k.awamenuPayVolume / k.onlineGmv) * 100 : 0,
		},
		scans: { value: scans, change: pct(scans, prevScans) },
		bookings: { value: bookings._count, covers: bookings._sum.partySize ?? 0 },
	};

	// ── Heatmap / mixes ──
	const heatmap = Array.from(
		{ length: 7 },
		() => new Array(24).fill(0) as number[],
	);
	for (const row of heatRows) heatmap[row.dow][row.hour] = row.n;

	const methodTotals = new Map<string, { amount: number; n: number }>();
	for (const m of methodRows) {
		const key = m.awamenuPay ? "AWAMENU_PAY" : m.method;
		const cur = methodTotals.get(key) ?? { amount: 0, n: 0 };
		cur.amount += m.amount;
		cur.n += m.n;
		methodTotals.set(key, cur);
	}

	const topNames = await db.restaurant.findMany({
		where: { id: { in: topRows.map((t) => t.restaurantId) } },
		select: { id: true, name: true, slug: true },
	});
	const names = new Map(topNames.map((t) => [t.id, t]));

	// ── Cohorts ──
	const cohortMap = new Map<string, { size: number; active: number[] }>();
	for (const row of cohortRows) {
		const entry = cohortMap.get(row.cohort) ?? {
			size: row.size,
			active: new Array(6).fill(0) as number[],
		};
		if (row.offset !== null && row.offset >= 0 && row.offset < 6)
			entry.active[row.offset] = row.active;
		cohortMap.set(row.cohort, entry);
	}
	const currentMonth = dateKeyIn(TZ, new Date()).slice(0, 7);
	const monthsBetween = (a: string, b: string) =>
		(Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 +
		Number(b.slice(5, 7)) -
		Number(a.slice(5, 7));

	return {
		range,
		kpis,
		series,
		heatmap,
		orderTypes: typeRows,
		paymentMethods: [...methodTotals.entries()].map(([method, v]) => ({
			method,
			...v,
		})),
		topRestaurants: topRows
			.filter((t) => t.gmv > 0 || t.orders > 0)
			.map((t) => ({
				...t,
				name: names.get(t.restaurantId)?.name ?? "Deleted",
				slug: names.get(t.restaurantId)?.slug ?? "",
				change: pct(t.gmv, t.prevGmv),
			})),
		funnel: funnelRows[0] ?? {
			signedUp: 0,
			verified: 0,
			restaurant: 0,
			menu: 0,
			ordered: 0,
			paying: 0,
		},
		cohorts: [...cohortMap.entries()].map(([cohort, v]) => ({
			cohort,
			size: v.size,
			// Months that haven't happened yet are null, not 0%.
			retention: v.active.map((n, i) =>
				i <= monthsBetween(cohort, currentMonth)
					? v.size
						? n / v.size
						: 0
					: null,
			),
		})),
	};
}

async function totalsFor(from: Date, to: Date) {
	const [[orders], [subs], [com], restaurants, owners, [online]] =
		await Promise.all([
			db.$queryRaw<
				{ orders: number; paidOrders: number; gmv: number; active: number }[]
			>`
			SELECT count(*)::int AS orders, count(*) FILTER (WHERE "paymentStatus" = 'PAID')::int AS "paidOrders",
				coalesce(sum(total) FILTER (WHERE "paymentStatus" = 'PAID'), 0)::float AS gmv,
				count(DISTINCT "restaurantId")::int AS active
			FROM "Order" WHERE status <> 'CANCELLED' AND "createdAt" >= ${from} AND "createdAt" < ${to}`,
			db.$queryRaw<{ amount: number }[]>`
			SELECT coalesce(sum(amount), 0)::float AS amount FROM "SubscriptionPayment"
			WHERE status = 'SUCCESS' AND "createdAt" >= ${from} AND "createdAt" < ${to}`,
			db.$queryRaw<{ commission: number; volume: number }[]>`
			SELECT coalesce(sum("platformFee"), 0)::float AS commission, coalesce(sum(amount), 0)::float AS volume
			FROM "OrderPayment" WHERE direction = 'CREDIT' AND status = 'SUCCESS' AND "subaccountCode" IS NOT NULL
				AND "createdAt" >= ${from} AND "createdAt" < ${to}`,
			db.restaurant.count({ where: { createdAt: { gte: from, lt: to } } }),
			db.user.count({
				where: { role: "RESTAURANT_OWNER", createdAt: { gte: from, lt: to } },
			}),
			db.$queryRaw<{ amount: number }[]>`
			SELECT coalesce(sum(amount), 0)::float AS amount FROM "OrderPayment"
			WHERE direction = 'CREDIT' AND status = 'SUCCESS' AND gateway IS NOT NULL
				AND "createdAt" >= ${from} AND "createdAt" < ${to}`,
		]);
	return {
		orders: orders?.orders ?? 0,
		paidOrders: orders?.paidOrders ?? 0,
		gmv: orders?.gmv ?? 0,
		activeRestaurants: orders?.active ?? 0,
		subscriptions: subs?.amount ?? 0,
		commission: com?.commission ?? 0,
		awamenuPayVolume: com?.volume ?? 0,
		onlineGmv: online?.amount ?? 0,
		newRestaurants: restaurants,
		newOwners: owners,
	};
}

export type PlatformAnalytics = Awaited<
	ReturnType<typeof getPlatformAnalytics>
>;
