import { requireSuperAdmin } from "@/lib/auth-guards";
import { parseBillingInterval } from "@/lib/billing";
import {
	type BillingState,
	billingStateOf,
	isAutoRenewing,
	subscriptionPrice,
} from "@/lib/billing-state";
import { db } from "@/lib/db";
import {
	parseSubscriptionFilters,
	SUBSCRIPTION_SORTS,
	subscriptionRowSelect,
	subscriptionWhere,
} from "@/lib/subscription-admin";

const STATES: BillingState[] = [
	"ACTIVE",
	"EXPIRING_SOON",
	"GRACE",
	"LAPSED",
	"FREE",
];

/** Quotes a CSV cell; leading = + - @ are neutralised (spreadsheet formulas). */
function cell(value: string | number | null | undefined) {
	const text = value === null || value === undefined ? "" : String(value);
	const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
	return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/** Every subscription matching the page's filters (not just one page). */
export async function GET(request: Request) {
	await requireSuperAdmin();
	const params = Object.fromEntries(new URL(request.url).searchParams);
	const filters = parseSubscriptionFilters(params, STATES);
	const now = new Date();
	const rows = await db.subscription.findMany({
		where: subscriptionWhere(filters, now),
		orderBy: SUBSCRIPTION_SORTS[filters.sort].orderBy,
		select: subscriptionRowSelect,
	});

	const lines = [
		[
			"Restaurant",
			"Slug",
			"Owner",
			"Owner email",
			"Plan",
			"Billing",
			"Price (NGN)",
			"Period end",
			"State",
			"Auto-renew",
			"Suspended by admin",
			"Created",
		],
		...rows.map((s) => [
			s.restaurant?.name ?? "",
			s.restaurant?.slug ?? "",
			s.user.name ?? "",
			s.user.email,
			s.plan.name,
			parseBillingInterval(s.billingInterval).toLowerCase(),
			subscriptionPrice(s),
			s.currentPeriodEnd.toISOString().slice(0, 10),
			billingStateOf(s, now.getTime()),
			isAutoRenewing(s) ? "on" : "off",
			s.restaurant && !s.restaurant.isActive ? "yes" : "",
			s.createdAt.toISOString().slice(0, 10),
		]),
	];
	const csv = lines.map((row) => row.map(cell).join(",")).join("\n");
	return new Response(csv, {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="awamenu-subscriptions-${now.toISOString().slice(0, 10)}.csv"`,
			"Cache-Control": "no-store, private",
		},
	});
}
