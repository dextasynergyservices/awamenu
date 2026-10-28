import { OrderStatus, PaymentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
	addDaysToDateKey,
	dateKeyIn,
	hourIn,
	percentChange,
	startOfDateIn,
} from "@/lib/restaurant-day";

/**
 * Owner analytics for a date range, compared with the period before it.
 *
 * Definitions match the dashboard home: **sales** are paid, non-cancelled
 * orders; **orders** exclude cancelled ones. Days and hours are the
 * restaurant's own (its timezone), and every day in the range is present,
 * even with no sales, so charts never skip a gap.
 *
 * Distributions (order values, basket sizes, party sizes…) are bucketed here
 * so the page receives a few dozen numbers, not every order.
 */

export const ANALYTICS_RANGES = [7, 30, 90, 365] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

/**
 * The period being looked at: a preset (last 7/30/90/365 days, ending today)
 * or a custom from–to range, in the restaurant's own days.
 */
export type AnalyticsPeriod = {
	/** "7", "30", "90", "365" or "custom". */
	key: string;
	custom: boolean;
	days: number;
	fromKey: string;
	toKey: string;
	/** Today in the restaurant's timezone (the latest date a range can reach). */
	today: string;
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
/** Two years of daily rows is plenty, and keeps every query quick. */
const MAX_CUSTOM_DAYS = 731;

const dayCount = (fromKey: string, toKey: string) =>
	Math.round(
		(Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) /
			86_400_000,
	) + 1;

export function parsePeriod(
	params: { range?: string | null; from?: string | null; to?: string | null },
	timeZone: string,
): AnalyticsPeriod {
	const today = dateKeyIn(timeZone, new Date());
	if (params.from && DATE_KEY.test(params.from)) {
		let fromKey = params.from;
		let toKey = params.to && DATE_KEY.test(params.to) ? params.to : today;
		// Reversed dates are swapped, the future is clipped to today.
		if (fromKey > toKey) [fromKey, toKey] = [toKey, fromKey];
		if (toKey > today) toKey = today;
		if (fromKey > today) fromKey = today;
		let days = dayCount(fromKey, toKey);
		if (days > MAX_CUSTOM_DAYS) {
			fromKey = addDaysToDateKey(toKey, -(MAX_CUSTOM_DAYS - 1));
			days = MAX_CUSTOM_DAYS;
		}
		return { key: "custom", custom: true, days, fromKey, toKey, today };
	}
	const n = Number(params.range);
	const days = (ANALYTICS_RANGES as readonly number[]).includes(n) ? n : 30;
	return {
		key: String(days),
		custom: false,
		days,
		fromKey: addDaysToDateKey(today, -(days - 1)),
		toKey: today,
		today,
	};
}

export const ANALYTICS_TABS = [
	"overview",
	"sales",
	"menu",
	"customers",
	"operations",
	"bookings",
] as const;
export type AnalyticsTab = (typeof ANALYTICS_TABS)[number];

export function parseTab(value: unknown): AnalyticsTab {
	return (ANALYTICS_TABS as readonly unknown[]).includes(value)
		? (value as AnalyticsTab)
		: "overview";
}

export type Metric = { value: number; previous: number; change: number | null };

const metric = (value: number, previous: number): Metric => ({
	value,
	previous,
	change: percentChange(value, previous),
});

export type Bucket = { label: string; count: number };

type DailyRow = { day: string; sales: number; orders: number };

/** A round step for money buckets: 500, 1,000, 2,000, 2,500, 5,000… */
function niceStep(raw: number) {
	const steps = [1, 2, 2.5, 5];
	const magnitude = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
	for (const s of steps) if (s * magnitude >= raw) return s * magnitude;
	return 10 * magnitude;
}

/**
 * Order values as a histogram: about eight even buckets up to the 95th
 * percentile, then one "and above" bucket, so a single large party order
 * doesn't squash everything else into the first bar.
 */
function moneyHistogram(
	values: number[],
	format: (n: number) => string,
): Bucket[] {
	if (values.length === 0) return [];
	const sorted = [...values].sort((a, b) => a - b);
	const p95 = sorted[Math.floor((sorted.length - 1) * 0.95)];
	const step = niceStep(p95 / 8);
	const top = Math.max(step, Math.ceil(p95 / step) * step);
	const buckets: Bucket[] = [];
	for (let lo = 0; lo < top; lo += step) {
		buckets.push({ label: `${format(lo)}–${format(lo + step)}`, count: 0 });
	}
	buckets.push({ label: `${format(top)}+`, count: 0 });
	for (const v of values) {
		buckets[Math.min(Math.floor(v / step), buckets.length - 1)].count += 1;
	}
	return buckets;
}

/** Counts into fixed labelled ranges, e.g. 1, 2, 3, 4–5, 6+. */
function rangeHistogram(
	pairs: Array<{ n: number; count: number }>,
	ranges: Array<[label: string, min: number, max: number]>,
): Bucket[] {
	return ranges.map(([label, min, max]) => ({
		label,
		count: pairs
			.filter((p) => p.n >= min && p.n <= max)
			.reduce((t, p) => t + p.count, 0),
	}));
}

const shortMoney = (n: number) =>
	n >= 1_000_000 ? `${n / 1_000_000}m` : n >= 1000 ? `${n / 1000}k` : String(n);

/**
 * How long orders take, from the stage times the database stamps on each
 * status change (migration 8_order_status_times).
 *
 * - **Response**: placed → accepted, for orders that waited for approval.
 * - **Prep**: confirmed → ready (ready is the kitchen's "done").
 * - **Delivery**: ready → delivered. **Pickup wait**: ready → collected.
 *
 * Medians, not averages: one order left on "preparing" overnight would drag
 * an average for days. Durations over 4 hours are left out for the same
 * reason (a forgotten status, not a slow kitchen).
 */
export async function getOrderTiming(input: {
	restaurantId: string;
	tz: string;
	from: Date;
	now: Date;
	prevFrom: Date;
	prevTo: Date;
}) {
	const { restaurantId, tz, from, now, prevFrom, prevTo } = input;
	const MAX = 4 * 3600;
	const secs = (a: string, b: string) =>
		Prisma.sql`extract(epoch FROM (${Prisma.raw(a)} - ${Prisma.raw(b)}))`;
	const response = secs('"acceptedAt"', '"createdAt"');
	const prep = secs('"readyAt"', '"confirmedAt"');
	const delivery = secs('"deliveredAt"', '"readyAt"');
	const pickup = secs('"completedAt"', '"readyAt"');
	const valid = (d: Prisma.Sql) => Prisma.sql`${d} >= 0 AND ${d} <= ${MAX}`;

	const summary = (gte: Date, lt: Date) =>
		db.$queryRaw<
			{
				response_median: number | null;
				response_p90: number | null;
				response_n: number;
				prep_median: number | null;
				prep_p90: number | null;
				prep_n: number;
				delivery_median: number | null;
				delivery_n: number;
				pickup_median: number | null;
				pickup_n: number;
			}[]
		>`
			SELECT
				percentile_cont(0.5) WITHIN GROUP (ORDER BY ${response}) FILTER (WHERE "acceptedAt" IS NOT NULL AND ${valid(response)}) AS response_median,
				percentile_cont(0.9) WITHIN GROUP (ORDER BY ${response}) FILTER (WHERE "acceptedAt" IS NOT NULL AND ${valid(response)}) AS response_p90,
				count(*) FILTER (WHERE "acceptedAt" IS NOT NULL AND ${valid(response)})::int AS response_n,
				percentile_cont(0.5) WITHIN GROUP (ORDER BY ${prep}) FILTER (WHERE "readyAt" IS NOT NULL AND "confirmedAt" IS NOT NULL AND ${valid(prep)}) AS prep_median,
				percentile_cont(0.9) WITHIN GROUP (ORDER BY ${prep}) FILTER (WHERE "readyAt" IS NOT NULL AND "confirmedAt" IS NOT NULL AND ${valid(prep)}) AS prep_p90,
				count(*) FILTER (WHERE "readyAt" IS NOT NULL AND "confirmedAt" IS NOT NULL AND ${valid(prep)})::int AS prep_n,
				percentile_cont(0.5) WITHIN GROUP (ORDER BY ${delivery}) FILTER (WHERE type = 'DELIVERY' AND "deliveredAt" IS NOT NULL AND "readyAt" IS NOT NULL AND ${valid(delivery)}) AS delivery_median,
				count(*) FILTER (WHERE type = 'DELIVERY' AND "deliveredAt" IS NOT NULL AND "readyAt" IS NOT NULL AND ${valid(delivery)})::int AS delivery_n,
				percentile_cont(0.5) WITHIN GROUP (ORDER BY ${pickup}) FILTER (WHERE type = 'PICKUP' AND "completedAt" IS NOT NULL AND "readyAt" IS NOT NULL AND ${valid(pickup)}) AS pickup_median,
				count(*) FILTER (WHERE type = 'PICKUP' AND "completedAt" IS NOT NULL AND "readyAt" IS NOT NULL AND ${valid(pickup)})::int AS pickup_n
			FROM "Order"
			WHERE "restaurantId" = ${restaurantId} AND "createdAt" >= ${gte} AND "createdAt" < ${lt}`;

	const prepRows = Prisma.sql`
		FROM "Order"
		WHERE "restaurantId" = ${restaurantId} AND "createdAt" >= ${from} AND "createdAt" < ${now}
			AND "readyAt" IS NOT NULL AND "confirmedAt" IS NOT NULL AND ${valid(prep)}`;
	const localConfirmed = Prisma.sql`("confirmedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}`;

	const [[current], [previous], prepValues, byHour, byDay, byType, since] =
		await Promise.all([
			summary(from, now),
			summary(prevFrom, prevTo),
			db.$queryRaw<{ s: number }[]>`SELECT ${prep}::float AS s ${prepRows}`,
			db.$queryRaw<{ hour: number; median: number; n: number }[]>`
				SELECT extract(hour FROM ${localConfirmed})::int AS hour,
					percentile_cont(0.5) WITHIN GROUP (ORDER BY ${prep})::float AS median,
					count(*)::int AS n
				${prepRows}
				GROUP BY 1`,
			db.$queryRaw<{ day: string; median: number; n: number }[]>`
				SELECT to_char(${localConfirmed}, 'YYYY-MM-DD') AS day,
					percentile_cont(0.5) WITHIN GROUP (ORDER BY ${prep})::float AS median,
					count(*)::int AS n
				${prepRows}
				GROUP BY 1`,
			db.$queryRaw<{ type: string; median: number; n: number }[]>`
				SELECT type::text AS type,
					percentile_cont(0.5) WITHIN GROUP (ORDER BY ${prep})::float AS median,
					count(*)::int AS n
				${prepRows}
				GROUP BY 1`,
			db.order.aggregate({
				where: { restaurantId, confirmedAt: { not: null } },
				_min: { confirmedAt: true },
			}),
		]);

	const n = (v: number | null | undefined) =>
		v === null || v === undefined ? null : Number(v);
	const minutes = prepValues.map((r) => r.s / 60);
	const ranges: Array<[string, number, number]> = [
		["0–5", 0, 5],
		["5–10", 5, 10],
		["10–15", 10, 15],
		["15–20", 15, 20],
		["20–30", 20, 30],
		["30–45", 30, 45],
		["45–60", 45, 60],
		["60+", 60, Number.POSITIVE_INFINITY],
	];

	return {
		trackedSince: since._min.confirmedAt
			? dateKeyIn(tz, since._min.confirmedAt)
			: null,
		response: {
			median: n(current?.response_median),
			p90: n(current?.response_p90),
			count: current?.response_n ?? 0,
			previous: n(previous?.response_median),
		},
		prep: {
			median: n(current?.prep_median),
			p90: n(current?.prep_p90),
			count: current?.prep_n ?? 0,
			previous: n(previous?.prep_median),
		},
		delivery: {
			median: n(current?.delivery_median),
			count: current?.delivery_n ?? 0,
			previous: n(previous?.delivery_median),
		},
		pickup: {
			median: n(current?.pickup_median),
			count: current?.pickup_n ?? 0,
			previous: n(previous?.pickup_median),
		},
		prepHistogram: ranges.map(([label, lo, hi]) => ({
			label,
			count: minutes.filter((m) => m >= lo && m < hi).length,
		})),
		prepByHour: byHour,
		prepByDay: byDay,
		prepByType: byType,
	};
}

export async function getRestaurantAnalytics(input: {
	restaurantId: string;
	timeZone: string;
	period: AnalyticsPeriod;
	advanced: boolean;
}) {
	const { restaurantId, timeZone: tz, period, advanced } = input;
	const range = period.days;
	const now = new Date();
	const firstDay = period.fromKey;
	const lastDay = period.toKey;
	const from = startOfDateIn(tz, firstDay);
	// The range's end: midnight after its last day, or now while it includes
	// today. Every query is bounded by it, so a past custom range is exact.
	const end = new Date(
		Math.min(
			now.getTime(),
			startOfDateIn(tz, addDaysToDateKey(lastDay, 1)).getTime(),
		),
	);
	const prevFrom = startOfDateIn(tz, addDaysToDateKey(firstDay, -range));
	// The same length just before, up to the same point, so a half-finished
	// today isn't compared with a whole day.
	const prevTo = new Date(
		prevFrom.getTime() + (end.getTime() - from.getTime()),
	);

	const local = (column: string) =>
		Prisma.sql`(${Prisma.raw(column)} AT TIME ZONE 'UTC') AT TIME ZONE ${tz}`;
	const localDay = Prisma.sql`to_char(${local('"createdAt"')}, 'YYYY-MM-DD')`;
	const notCancelled = { not: OrderStatus.CANCELLED };

	const periodStats = (gte: Date, lt: Date) =>
		Promise.all([
			db.order.aggregate({
				where: {
					restaurantId,
					status: notCancelled,
					paymentStatus: PaymentStatus.PAID,
					createdAt: { gte, lt },
				},
				_sum: { total: true },
				_count: true,
			}),
			db.order.count({
				where: { restaurantId, status: notCancelled, createdAt: { gte, lt } },
			}),
			db.order.count({
				where: {
					restaurantId,
					status: OrderStatus.CANCELLED,
					createdAt: { gte, lt },
				},
			}),
			db.scanEvent.count({
				where: { restaurantId, scannedAt: { gte, lt } },
			}),
			db.rating.aggregate({
				where: { restaurantId, isHidden: false, createdAt: { gte, lt } },
				_avg: { overallRating: true },
				_count: true,
			}),
		]);

	const [current, previous, dailyRows] = await Promise.all([
		periodStats(from, end),
		periodStats(prevFrom, prevTo),
		db.$queryRaw<DailyRow[]>`
			SELECT ${localDay} AS day,
				coalesce(sum(CASE WHEN "paymentStatus" = 'PAID' THEN total ELSE 0 END), 0)::float AS sales,
				count(*)::int AS orders
			FROM "Order"
			WHERE "restaurantId" = ${restaurantId}
				AND status <> 'CANCELLED'
				AND "createdAt" >= ${prevFrom}
				AND "createdAt" < ${end}
			GROUP BY 1`,
	]);

	const [cSales, cOrders, cCancelled, cScans, cRating] = current;
	const [pSales, pOrders, pCancelled, pScans, pRating] = previous;
	const salesNow = Number(cSales._sum.total ?? 0);
	const salesBefore = Number(pSales._sum.total ?? 0);
	const aov = (sum: number, n: number) => (n > 0 ? sum / n : 0);
	const rate = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

	const byDay = new Map(dailyRows.map((r) => [r.day, r]));
	const prevFirstDay = addDaysToDateKey(firstDay, -range);
	// Each day alongside the same day of the previous period (for the dashed
	// comparison line).
	const daily = Array.from({ length: range }, (_, i) => {
		const day = addDaysToDateKey(firstDay, i);
		const row = byDay.get(day);
		const prev = byDay.get(addDaysToDateKey(prevFirstDay, i));
		return {
			date: day,
			sales: row?.sales ?? 0,
			orders: row?.orders ?? 0,
			prevSales: prev?.sales ?? 0,
			prevOrders: prev?.orders ?? 0,
		};
	});

	const kpis = {
		sales: metric(salesNow, salesBefore),
		orders: metric(cOrders, pOrders),
		averageOrder: metric(
			aov(salesNow, cSales._count),
			aov(salesBefore, pSales._count),
		),
		scans: metric(cScans, pScans),
		conversion: metric(rate(cOrders, cScans), rate(pOrders, pScans)),
		cancellationRate: metric(
			rate(cCancelled, cOrders + cCancelled),
			rate(pCancelled, pOrders + pCancelled),
		),
		rating: {
			value: cRating._avg.overallRating ?? null,
			previous: pRating._avg.overallRating ?? null,
			count: cRating._count,
		},
	};

	if (!advanced)
		return {
			range,
			period,
			from: firstDay,
			to: lastDay,
			kpis,
			daily,
			advanced: null,
		};

	const inPeriod = Prisma.sql`"restaurantId" = ${restaurantId} AND "createdAt" >= ${from} AND "createdAt" < ${end}`;
	const live = Prisma.sql`${inPeriod} AND status <> 'CANCELLED'`;

	const timingPromise = getOrderTiming({
		restaurantId,
		tz,
		from,
		now: end,
		prevFrom,
		prevTo,
	});

	const [
		heatRows,
		itemRows,
		menuItems,
		typeDailyRows,
		paymentRows,
		ratingDist,
		ratingAvg,
		staffRows,
		customerRows,
		orderTotals,
		basketRows,
		newReturningRows,
		frequencyRows,
		topCustomerRows,
		funnelRows,
		cancelReasonRows,
		bookingRows,
		upcomingBookings,
	] = await Promise.all([
		// Orders and sales by local weekday (0 = Sunday) and hour.
		db.$queryRaw<{ dow: number; hour: number; n: number; sales: number }[]>`
			SELECT extract(dow FROM ${local('"createdAt"')})::int AS dow,
				extract(hour FROM ${local('"createdAt"')})::int AS hour,
				count(*)::int AS n,
				coalesce(sum(CASE WHEN "paymentStatus" = 'PAID' THEN total ELSE 0 END), 0)::float AS sales
			FROM "Order"
			WHERE ${live}
			GROUP BY 1, 2`,
		// Every dish sold, with its category and average selling price.
		db.$queryRaw<
			{
				menuItemId: string;
				name: string;
				category: string | null;
				qty: number;
				revenue: number;
			}[]
		>`
			SELECT oi."menuItemId", max(oi.name) AS name, max(c.name) AS category,
				sum(oi.qty)::int AS qty, sum(oi.qty * oi."unitPrice")::float AS revenue
			FROM "OrderItem" oi
			JOIN "Order" o ON o.id = oi."orderId"
			LEFT JOIN "MenuItem" mi ON mi.id = oi."menuItemId"
			LEFT JOIN "MenuCategory" c ON c.id = mi."categoryId"
			WHERE o."restaurantId" = ${restaurantId} AND o.status <> 'CANCELLED' AND o."createdAt" >= ${from} AND o."createdAt" < ${end}
			GROUP BY oi."menuItemId"
			ORDER BY revenue DESC`,
		db.menuItem.findMany({
			where: { isAvailable: true, category: { restaurantId, isActive: true } },
			select: { id: true, name: true, imageUrl: true },
		}),
		db.$queryRaw<
			{ day: string; type: string; orders: number; sales: number }[]
		>`
			SELECT ${localDay} AS day, type::text AS type, count(*)::int AS orders,
				coalesce(sum(CASE WHEN "paymentStatus" = 'PAID' THEN total ELSE 0 END), 0)::float AS sales
			FROM "Order"
			WHERE ${live}
			GROUP BY 1, 2`,
		db.orderPayment.groupBy({
			by: ["method"],
			where: {
				restaurantId,
				direction: "CREDIT",
				status: "SUCCESS",
				createdAt: { gte: from, lt: end },
			},
			_sum: { amount: true },
			_count: true,
		}),
		db.rating.groupBy({
			by: ["overallRating"],
			where: {
				restaurantId,
				isHidden: false,
				createdAt: { gte: from, lt: end },
			},
			_count: { _all: true },
		}),
		db.rating.aggregate({
			where: {
				restaurantId,
				isHidden: false,
				createdAt: { gte: from, lt: end },
			},
			_avg: {
				foodQuality: true,
				serviceQuality: true,
				deliverySpeed: true,
				packaging: true,
				ambiance: true,
				valueForMoney: true,
			},
		}),
		db.$queryRaw<
			{
				id: string;
				name: string;
				orders: number;
				sales: number;
				rating: number | null;
			}[]
		>`
			SELECT s.id, s.name, count(o.id)::int AS orders,
				coalesce(sum(CASE WHEN o."paymentStatus" = 'PAID' THEN o.total ELSE 0 END), 0)::float AS sales,
				avg(r."overallRating")::float AS rating
			FROM "StaffMember" s
			LEFT JOIN "Order" o ON o."attendingStaffId" = s.id AND o.status <> 'CANCELLED' AND o."createdAt" >= ${from} AND o."createdAt" < ${end}
			LEFT JOIN "Rating" r ON r."orderId" = o.id AND r."isHidden" = false
			WHERE s."restaurantId" = ${restaurantId}
			GROUP BY s.id, s.name
			ORDER BY orders DESC`,
		// Customers in the period, and whether they'd ordered before it.
		db.$queryRaw<{ customers: number; returning: number }[]>`
			SELECT count(DISTINCT o."customerPhone")::int AS customers,
				count(DISTINCT o."customerPhone") FILTER (WHERE EXISTS (
					SELECT 1 FROM "Order" p
					WHERE p."restaurantId" = o."restaurantId"
						AND p."customerPhone" = o."customerPhone"
						AND p."createdAt" < ${from}
						AND p.status <> 'CANCELLED'
				))::int AS returning
			FROM "Order" o
			WHERE o."restaurantId" = ${restaurantId} AND o.status <> 'CANCELLED'
				AND o."createdAt" >= ${from} AND o."createdAt" < ${end} AND o."customerPhone" <> ''`,
		db.$queryRaw<{ total: number }[]>`
			SELECT total::float AS total FROM "Order"
			WHERE ${live} AND "paymentStatus" = 'PAID'`,
		// Items per order.
		db.$queryRaw<{ n: number; count: number }[]>`
			SELECT n::int AS n, count(*)::int AS count FROM (
				SELECT sum(oi.qty) AS n
				FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId"
				WHERE o."restaurantId" = ${restaurantId} AND o.status <> 'CANCELLED' AND o."createdAt" >= ${from} AND o."createdAt" < ${end}
				GROUP BY o.id
			) t GROUP BY 1`,
		// Each day's customers: first-ever order that day (new) or before (returning).
		db.$queryRaw<{ day: string; new: number; returning: number }[]>`
			WITH firsts AS (
				SELECT "customerPhone" AS phone,
					to_char(min(${local('"createdAt"')}), 'YYYY-MM-DD') AS first_day
				FROM "Order"
				WHERE "restaurantId" = ${restaurantId} AND status <> 'CANCELLED' AND "customerPhone" <> ''
				GROUP BY 1
			)
			SELECT to_char(${local('o."createdAt"')}, 'YYYY-MM-DD') AS day,
				count(DISTINCT o."customerPhone") FILTER (WHERE f.first_day = to_char(${local('o."createdAt"')}, 'YYYY-MM-DD'))::int AS new,
				count(DISTINCT o."customerPhone") FILTER (WHERE f.first_day < to_char(${local('o."createdAt"')}, 'YYYY-MM-DD'))::int AS returning
			FROM "Order" o JOIN firsts f ON f.phone = o."customerPhone"
			WHERE o."restaurantId" = ${restaurantId} AND o.status <> 'CANCELLED' AND o."createdAt" >= ${from} AND o."createdAt" < ${end}
			GROUP BY 1`,
		// How many times each customer ordered in the period.
		db.$queryRaw<{ n: number; count: number }[]>`
			SELECT n::int AS n, count(*)::int AS count FROM (
				SELECT count(*) AS n FROM "Order"
				WHERE ${live} AND "customerPhone" <> ''
				GROUP BY "customerPhone"
			) t GROUP BY 1`,
		db.$queryRaw<
			{
				phone: string;
				name: string;
				orders: number;
				spent: number;
				last: Date;
			}[]
		>`
			SELECT "customerPhone" AS phone, max("customerName") AS name, count(*)::int AS orders,
				coalesce(sum(CASE WHEN "paymentStatus" = 'PAID' THEN total ELSE 0 END), 0)::float AS spent,
				max("createdAt") AS last
			FROM "Order"
			WHERE ${live} AND "customerPhone" <> ''
			GROUP BY 1
			ORDER BY spent DESC, orders DESC
			LIMIT 10`,
		// From a scan to a finished order.
		db.$queryRaw<
			{ placed: number; accepted: number; paid: number; completed: number }[]
		>`
			SELECT count(*)::int AS placed,
				count(*) FILTER (WHERE status IN ('CONFIRMED','PREPARING','READY','DELIVERED','COMPLETED'))::int AS accepted,
				count(*) FILTER (WHERE status <> 'CANCELLED' AND "paymentStatus" = 'PAID')::int AS paid,
				count(*) FILTER (WHERE status IN ('DELIVERED','COMPLETED'))::int AS completed
			FROM "Order"
			WHERE ${inPeriod}`,
		db.$queryRaw<{ reason: string | null; count: number }[]>`
			SELECT nullif(trim(coalesce("cancellationNote", "statusNote")), '') AS reason, count(*)::int AS count
			FROM "Order"
			WHERE ${inPeriod} AND status = 'CANCELLED'
			GROUP BY 1
			ORDER BY 2 DESC
			LIMIT 6`,
		// Bookings whose table time falls in the period.
		db.reservation.findMany({
			where: { restaurantId, startsAt: { gte: from, lt: end } },
			select: {
				status: true,
				partySize: true,
				startsAt: true,
				createdAt: true,
				reservationPaymentStatus: true,
				reservationAmountPaid: true,
				table: { select: { label: true } },
			},
		}),
		db.reservation.count({
			where: {
				restaurantId,
				startsAt: { gte: now, lt: new Date(now.getTime() + 7 * 86_400_000) },
				status: { in: ["ACTIVE", "APPROVED", "PENDING_APPROVAL"] },
			},
		}),
	]);

	const heatmap = Array.from(
		{ length: 7 },
		() => new Array(24).fill(0) as number[],
	);
	const hourly = Array.from({ length: 24 }, (_, hour) => ({
		hour,
		orders: 0,
		sales: 0,
	}));
	for (const r of heatRows) {
		heatmap[r.dow][r.hour] = r.n;
		hourly[r.hour].orders += r.n;
		hourly[r.hour].sales += r.sales;
	}

	const orderedIds = new Set(itemRows.map((r) => r.menuItemId));
	const imageById = new Map(menuItems.map((m) => [m.id, m.imageUrl]));
	const itemsTotal = itemRows.reduce((t, r) => t + r.revenue, 0);

	const categoryMap = new Map<string, { qty: number; revenue: number }>();
	for (const r of itemRows) {
		const key = r.category ?? "Uncategorised";
		const c = categoryMap.get(key) ?? { qty: 0, revenue: 0 };
		c.qty += r.qty;
		c.revenue += r.revenue;
		categoryMap.set(key, c);
	}

	const typeTotals = new Map<string, { orders: number; sales: number }>();
	for (const r of typeDailyRows) {
		const t = typeTotals.get(r.type) ?? { orders: 0, sales: 0 };
		t.orders += r.orders;
		t.sales += r.sales;
		typeTotals.set(r.type, t);
	}

	const funnel = funnelRows[0] ?? {
		placed: 0,
		accepted: 0,
		paid: 0,
		completed: 0,
	};

	// Bookings: worked out here in the restaurant's timezone.
	const seated = ["CHECKED_IN", "COMPLETED"];
	const kept = [...seated, "ACTIVE"];
	const bookingStatus = new Map<string, number>();
	const bookingWeekday = new Array(7).fill(0) as number[];
	const bookingHour = new Array(24).fill(0) as number[];
	const bookingTables = new Map<string, { bookings: number; covers: number }>();
	const bookingDaily = new Map<string, number>();
	const leadDays: number[] = [];
	let covers = 0;
	let deposits = 0;
	for (const b of bookingRows) {
		bookingStatus.set(b.status, (bookingStatus.get(b.status) ?? 0) + 1);
		const day = dateKeyIn(tz, b.startsAt);
		bookingDaily.set(day, (bookingDaily.get(day) ?? 0) + 1);
		// Money kept: cancelled and declined bookings are owed back.
		if (
			b.reservationPaymentStatus === "PAID" &&
			b.status !== "CANCELLED" &&
			b.status !== "DECLINED"
		) {
			deposits += Number(b.reservationAmountPaid ?? 0);
		}
		if (!kept.includes(b.status)) continue;
		covers += b.partySize;
		bookingWeekday[new Date(`${day}T12:00:00Z`).getUTCDay()] += 1;
		bookingHour[hourIn(tz, b.startsAt)] += 1;
		const t = bookingTables.get(b.table.label) ?? { bookings: 0, covers: 0 };
		t.bookings += 1;
		t.covers += b.partySize;
		bookingTables.set(b.table.label, t);
		leadDays.push(
			Math.max(
				0,
				Math.round(
					(startOfDateIn(tz, day).getTime() -
						startOfDateIn(tz, dateKeyIn(tz, b.createdAt)).getTime()) /
						86_400_000,
				),
			),
		);
	}
	const keptBookings = bookingRows.filter((b) => kept.includes(b.status));
	const noShows = bookingStatus.get("EXPIRED") ?? 0;
	const attended = seated.reduce((t, s) => t + (bookingStatus.get(s) ?? 0), 0);

	return {
		range,
		period,
		from: firstDay,
		to: lastDay,
		kpis,
		daily,
		advanced: {
			heatmap,
			hourly,
			topItems: itemRows.slice(0, 10).map((r) => ({
				id: r.menuItemId,
				name: r.name,
				qty: r.qty,
				revenue: r.revenue,
				share: itemsTotal > 0 ? r.revenue / itemsTotal : 0,
				imageUrl: imageById.get(r.menuItemId) ?? null,
			})),
			// Popularity vs price for the menu-engineering chart.
			dishes: itemRows.slice(0, 60).map((r) => ({
				id: r.menuItemId,
				name: r.name,
				category: r.category ?? "Uncategorised",
				qty: r.qty,
				revenue: r.revenue,
				avgPrice: r.qty > 0 ? r.revenue / r.qty : 0,
			})),
			categories: [...categoryMap.entries()]
				.map(([name, c]) => ({ name, ...c }))
				.sort((a, b) => b.revenue - a.revenue),
			notOrdered: menuItems
				.filter((m) => !orderedIds.has(m.id))
				.map((m) => ({ id: m.id, name: m.name })),
			publishedItems: menuItems.length,
			orderTypes: [...typeTotals.entries()].map(([type, t]) => ({
				type,
				...t,
			})),
			typeDaily: typeDailyRows,
			payments: paymentRows.map((r) => ({
				method: r.method,
				amount: Number(r._sum.amount ?? 0),
				count: r._count,
			})),
			orderValues: moneyHistogram(
				orderTotals.map((r) => r.total),
				shortMoney,
			),
			basketSizes: rangeHistogram(basketRows, [
				["1", 1, 1],
				["2", 2, 2],
				["3", 3, 3],
				["4", 4, 4],
				["5–6", 5, 6],
				["7–9", 7, 9],
				["10+", 10, Number.POSITIVE_INFINITY],
			]),
			ratings: {
				distribution: [5, 4, 3, 2, 1].map((stars) => ({
					stars,
					count:
						ratingDist.find((d) => d.overallRating === stars)?._count._all ?? 0,
				})),
				averages: [
					["Food", ratingAvg._avg.foodQuality],
					["Service", ratingAvg._avg.serviceQuality],
					["Speed", ratingAvg._avg.deliverySpeed],
					["Packaging", ratingAvg._avg.packaging],
					["Ambience", ratingAvg._avg.ambiance],
					["Value", ratingAvg._avg.valueForMoney],
				]
					.filter(
						(entry): entry is [string, number] => typeof entry[1] === "number",
					)
					.map(([label, value]) => ({ label, value })),
			},
			staff: staffRows,
			customers: {
				total: customerRows[0]?.customers ?? 0,
				returning: customerRows[0]?.returning ?? 0,
				daily: newReturningRows,
				frequency: rangeHistogram(frequencyRows, [
					["1", 1, 1],
					["2", 2, 2],
					["3", 3, 3],
					["4–5", 4, 5],
					["6–9", 6, 9],
					["10+", 10, Number.POSITIVE_INFINITY],
				]),
				top: topCustomerRows.map((c) => ({
					name: c.name,
					// Enough to tell regulars apart, not a contact list.
					phone: c.phone.length > 4 ? `•••• ${c.phone.slice(-4)}` : c.phone,
					orders: c.orders,
					spent: c.spent,
					last: dateKeyIn(tz, c.last),
				})),
			},
			funnel: { scans: kpis.scans.value, ...funnel },
			timing: await timingPromise,
			cancelReasons: cancelReasonRows.map((r) => ({
				reason: r.reason ?? "No reason given",
				count: r.count,
			})),
			bookings: {
				total: bookingRows.length,
				kept: keptBookings.length,
				covers,
				averageParty: keptBookings.length ? covers / keptBookings.length : 0,
				noShowRate: attended + noShows > 0 ? noShows / (attended + noShows) : 0,
				deposits,
				upcoming: upcomingBookings,
				status: [...bookingStatus.entries()].map(([status, count]) => ({
					status,
					count,
				})),
				daily: [...bookingDaily.entries()].map(([day, count]) => ({
					day,
					count,
				})),
				weekday: bookingWeekday,
				hour: bookingHour,
				partySizes: rangeHistogram(
					keptBookings.map((b) => ({ n: b.partySize, count: 1 })),
					[
						["1", 1, 1],
						["2", 2, 2],
						["3", 3, 3],
						["4", 4, 4],
						["5–6", 5, 6],
						["7–10", 7, 10],
						["11+", 11, Number.POSITIVE_INFINITY],
					],
				),
				leadTime: rangeHistogram(
					leadDays.map((n) => ({ n, count: 1 })),
					[
						["0d", 0, 0],
						["1d", 1, 1],
						["2–3d", 2, 3],
						["4–7d", 4, 7],
						["8–14d", 8, 14],
						["15d+", 15, Number.POSITIVE_INFINITY],
					],
				),
				tables: [...bookingTables.entries()]
					.map(([label, t]) => ({ label, ...t }))
					.sort((a, b) => b.bookings - a.bookings),
			},
		},
	};
}

export type RestaurantAnalytics = Awaited<
	ReturnType<typeof getRestaurantAnalytics>
>;
export type AdvancedAnalytics = NonNullable<RestaurantAnalytics["advanced"]>;
