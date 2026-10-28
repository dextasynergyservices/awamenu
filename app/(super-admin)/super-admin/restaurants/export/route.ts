import { requireSuperAdmin } from "@/lib/auth-guards";
import { commissionLabel } from "@/lib/commission";
import {
	getRestaurantConsole,
	HEALTH,
	parseRestaurantFilters,
} from "@/lib/restaurant-admin";

/** Quotes a CSV cell; leading = + - @ are neutralised (spreadsheet formulas). */
function cell(value: string | number | null | undefined) {
	const text = value === null || value === undefined ? "" : String(value);
	const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
	return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Every restaurant matching the console's filters, with its metrics. */
export async function GET(request: Request) {
	await requireSuperAdmin();
	const params = Object.fromEntries(new URL(request.url).searchParams);
	const data = await getRestaurantConsole(parseRestaurantFilters(params), {
		skip: 0,
		take: Number.MAX_SAFE_INTEGER,
	});
	const date = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
	const lines = [
		[
			"Restaurant",
			"Slug",
			"Owner",
			"Owner email",
			"Health",
			"Sales 30d (NGN)",
			"Orders 30d",
			"Orders previous 30d",
			"Last order",
			"Menu items",
			"Menu scans 30d",
			"Rating",
			"Payments",
			"Plan",
			"Billing",
			"Commission",
			"Suspended",
			"Joined",
		],
		...data.allRows.map((r) => [
			r.name,
			r.slug,
			r.owner.name ?? "",
			r.owner.email,
			HEALTH[r.health].label,
			Math.round(r.sales30),
			r.orders30,
			r.ordersPrev,
			date(r.lastOrderAt),
			r.menuItems,
			r.scans30,
			r.rating ? r.rating.toFixed(2) : "",
			r.payments,
			r.planName,
			r.billingState,
			commissionLabel(r.commission),
			r.isActive ? "" : (r.suspensionReason ?? "yes"),
			date(r.createdAt),
		]),
	];
	const csv = lines.map((row) => row.map(cell).join(",")).join("\n");
	return new Response(csv, {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="awamenu-restaurants-${new Date().toISOString().slice(0, 10)}.csv"`,
			"Cache-Control": "no-store, private",
		},
	});
}
