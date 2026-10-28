import { requireSuperAdmin } from "@/lib/auth-guards";
import {
	getPlatformAnalytics,
	parsePlatformRange,
} from "@/lib/platform-analytics";

/** Quotes a CSV cell; leading = + - @ are neutralised (spreadsheet formulas). */
function cell(value: string | number | null | undefined) {
	const text = value === null || value === undefined ? "" : String(value);
	const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
	return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** The platform analytics for the selected range: KPIs and the time series. */
export async function GET(request: Request) {
	await requireSuperAdmin();
	const params = Object.fromEntries(new URL(request.url).searchParams);
	const range = await parsePlatformRange(params);
	const data = await getPlatformAnalytics(range);
	const k = data.kpis;
	const pct = (v: number | null) => (v === null ? "" : v.toFixed(1));
	const lines: (string | number | null)[][] = [
		[
			`AwaMenu platform analytics ${range.fromKey} to ${range.toKey} (Lagos time)`,
		],
		[],
		["Metric", "Value", "Change vs previous period %"],
		[
			"Platform revenue (NGN)",
			Math.round(k.revenue.value),
			pct(k.revenue.change),
		],
		[
			"Subscription revenue (NGN)",
			Math.round(k.subscriptions.value),
			pct(k.subscriptions.change),
		],
		[
			"Commission revenue (NGN)",
			Math.round(k.commission.value),
			pct(k.commission.change),
		],
		["MRR (NGN)", Math.round(k.mrr.value), pct(k.mrr.change)],
		["GMV (NGN)", Math.round(k.gmv.value), pct(k.gmv.change)],
		["Orders", k.orders.value, pct(k.orders.change)],
		["Average order (NGN)", Math.round(k.aov.value), pct(k.aov.change)],
		[
			"Active restaurants",
			k.activeRestaurants.value,
			pct(k.activeRestaurants.change),
		],
		["New restaurants", k.newRestaurants.value, pct(k.newRestaurants.change)],
		["New owner accounts", k.newOwners.value, pct(k.newOwners.change)],
		["Menu scans", k.scans.value, pct(k.scans.change)],
		["Table bookings", k.bookings.value, ""],
		["Effective take rate %", k.takeRate.value.toFixed(2), ""],
		[],
		[
			"Period starting",
			"Platform revenue",
			"New subscriptions",
			"Renewals",
			"Commission",
			"MRR",
			"GMV",
			"Orders",
			"Active restaurants",
			"New restaurants",
			"New owners",
		],
		...data.series.map((s) => [
			s.key,
			Math.round(s.revenue),
			Math.round(s.newSubscriptions),
			Math.round(s.renewals),
			Math.round(s.commission),
			Math.round(s.mrr),
			Math.round(s.gmv),
			s.orders,
			s.activeRestaurants,
			s.restaurantsJoined,
			s.ownersJoined,
		]),
	];
	const csv = lines.map((row) => row.map(cell).join(",")).join("\n");
	return new Response(csv, {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="awamenu-analytics-${range.fromKey}-to-${range.toKey}.csv"`,
			"Cache-Control": "no-store, private",
		},
	});
}
