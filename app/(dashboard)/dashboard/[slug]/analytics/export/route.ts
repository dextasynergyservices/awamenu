import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { getRestaurantPlanFeatures } from "@/lib/plan-features";
import {
	getRestaurantAnalytics,
	parsePeriod,
} from "@/lib/restaurant-analytics";

/** Quotes a CSV cell; leading = + - @ are neutralised (spreadsheet formulas). */
function cell(value: string | number | null | undefined) {
	const text = value === null || value === undefined ? "" : String(value);
	const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
	return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/**
 * Analytics for the selected range as CSV: summary figures, sales by day
 * (with the previous period alongside) and, on advanced plans, best sellers.
 * Owner-only, scoped by ownerId like the financials export.
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ slug: string }> },
) {
	const user = await requireUser();
	const { slug } = await params;
	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		select: { id: true, timezone: true },
	});
	if (!restaurant) return new Response("Not found", { status: 404 });

	const search = new URL(request.url).searchParams;
	const period = parsePeriod(
		{
			range: search.get("range"),
			from: search.get("from"),
			to: search.get("to"),
		},
		restaurant.timezone,
	);
	const { advancedAnalytics } = await getRestaurantPlanFeatures(restaurant.id);
	const data = await getRestaurantAnalytics({
		restaurantId: restaurant.id,
		timeZone: restaurant.timezone,
		period,
		advanced: advancedAnalytics,
	});

	const k = data.kpis;
	const lines: (string | number | null)[][] = [
		[`Analytics ${data.from} to ${data.to} (${period.days} days)`],
		[],
		["Metric", "This period", "Previous period", "Change %"],
		[
			"Sales (NGN)",
			k.sales.value,
			k.sales.previous,
			k.sales.change?.toFixed(1) ?? "",
		],
		[
			"Orders",
			k.orders.value,
			k.orders.previous,
			k.orders.change?.toFixed(1) ?? "",
		],
		[
			"Average order (NGN)",
			k.averageOrder.value.toFixed(2),
			k.averageOrder.previous.toFixed(2),
			k.averageOrder.change?.toFixed(1) ?? "",
		],
		[
			"Menu scans",
			k.scans.value,
			k.scans.previous,
			k.scans.change?.toFixed(1) ?? "",
		],
		[
			"Cancellation rate %",
			(k.cancellationRate.value * 100).toFixed(1),
			(k.cancellationRate.previous * 100).toFixed(1),
			"",
		],
		[
			"Average rating",
			k.rating.value?.toFixed(2) ?? "",
			k.rating.previous?.toFixed(2) ?? "",
			"",
		],
		[],
		[
			"Date",
			"Sales (NGN)",
			"Orders",
			"Previous period sales (NGN)",
			"Previous period orders",
		],
		...data.daily.map((d) => [
			d.date,
			d.sales,
			d.orders,
			d.prevSales,
			d.prevOrders,
		]),
	];
	if (data.advanced) {
		const t = data.advanced.timing;
		const mins = (s: number | null) => (s === null ? "" : (s / 60).toFixed(1));
		lines.push(
			[],
			[
				"Speed (median minutes)",
				"This period",
				"Previous period",
				"Orders timed",
			],
			[
				"Response (placed → accepted)",
				mins(t.response.median),
				mins(t.response.previous),
				t.response.count,
			],
			[
				"Prep (confirmed → ready)",
				mins(t.prep.median),
				mins(t.prep.previous),
				t.prep.count,
			],
			["Prep, 90th percentile", mins(t.prep.p90), "", ""],
			[
				"Delivery (ready → delivered)",
				mins(t.delivery.median),
				mins(t.delivery.previous),
				t.delivery.count,
			],
			[
				"Pickup wait (ready → collected)",
				mins(t.pickup.median),
				mins(t.pickup.previous),
				t.pickup.count,
			],
		);
		lines.push(
			[],
			["Best sellers", "Quantity", "Sales (NGN)", "Share %"],
			...data.advanced.topItems.map((i) => [
				i.name,
				i.qty,
				i.revenue,
				(i.share * 100).toFixed(1),
			]),
		);
	}

	const csv = lines.map((row) => row.map(cell).join(",")).join("\n");
	return new Response(csv, {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="${slug}-analytics-${data.from}-to-${data.to}.csv"`,
			"Cache-Control": "no-store, private",
		},
	});
}
