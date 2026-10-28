import { type BillingState, billingStateOf } from "@/lib/billing-state";
import { effectiveCommission } from "@/lib/commission";
import { db } from "@/lib/db";

/**
 * The Super Admin's restaurant console: every restaurant with how it's
 * actually doing (orders, sales, last order, menu, payments) and a health
 * signal, so the list answers "who needs attention?" rather than only "who
 * exists?".
 *
 * Metrics come from a handful of grouped queries over all restaurants, then
 * filtering, sorting and paging happen in memory. Health and billing state
 * are derived values SQL can't sort by, and the restaurant count is small.
 */

const DAY = 86_400_000;

export type RestaurantHealth =
	| "ACTIVE"
	| "SLOWING"
	| "QUIET"
	| "INACTIVE"
	| "NO_ORDERS"
	| "NO_MENU"
	| "NEW";

export const HEALTH: Record<
	RestaurantHealth,
	{ label: string; hint: string; tone: "good" | "warn" | "bad" | "neutral" }
> = {
	ACTIVE: { label: "Active", hint: "Ordered in the last 7 days", tone: "good" },
	SLOWING: {
		label: "Slowing",
		hint: "Orders down by half on the previous 30 days",
		tone: "warn",
	},
	QUIET: { label: "Quiet", hint: "No order for 8–14 days", tone: "warn" },
	INACTIVE: {
		label: "Inactive",
		hint: "No order for over 14 days",
		tone: "bad",
	},
	NO_ORDERS: {
		label: "No orders yet",
		hint: "Has a menu but has never had an order",
		tone: "bad",
	},
	NO_MENU: { label: "No menu", hint: "No dishes added yet", tone: "bad" },
	NEW: {
		label: "Getting started",
		hint: "Joined in the last 14 days",
		tone: "neutral",
	},
};

export const RESTAURANT_SORTS = {
	newest: "Newest",
	sales: "Sales (30 days)",
	orders: "Orders (30 days)",
	lastOrder: "Last order",
	name: "Name A–Z",
} as const;
export type RestaurantSort = keyof typeof RESTAURANT_SORTS;

export type RestaurantFilters = {
	q: string | null;
	health: RestaurantHealth | null;
	state: BillingState | null;
	planId: string | null;
	suspended: boolean;
	commission: "custom" | "exempt" | null;
	sort: RestaurantSort;
};

export function parseRestaurantFilters(
	params: Record<string, string | undefined>,
): RestaurantFilters {
	const states: BillingState[] = [
		"ACTIVE",
		"EXPIRING_SOON",
		"GRACE",
		"LAPSED",
		"FREE",
		"NONE",
	];
	return {
		q: params.q?.trim() || null,
		health:
			params.health && params.health in HEALTH
				? (params.health as RestaurantHealth)
				: null,
		state: states.includes(params.state as BillingState)
			? (params.state as BillingState)
			: null,
		planId: params.plan || null,
		suspended: params.suspended === "1",
		commission:
			params.commission === "custom" || params.commission === "exempt"
				? params.commission
				: null,
		sort:
			params.sort && params.sort in RESTAURANT_SORTS
				? (params.sort as RestaurantSort)
				: "newest",
	};
}

export async function getRestaurantConsole(
	filters: RestaurantFilters,
	page: { skip: number; take: number },
) {
	const now = Date.now();
	const from30 = new Date(now - 30 * DAY);
	const from60 = new Date(now - 60 * DAY);

	const [
		restaurants,
		orderRows,
		itemRows,
		scanRows,
		ratingRows,
		methods,
		payouts,
		platform,
	] = await Promise.all([
		db.restaurant.findMany({
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				name: true,
				slug: true,
				logoUrl: true,
				address: true,
				isActive: true,
				suspensionReason: true,
				createdAt: true,
				commissionPercentOverride: true,
				commissionNote: true,
				owner: { select: { id: true, name: true, email: true } },
				subscription: {
					select: {
						planId: true,
						currentPeriodEnd: true,
						billingInterval: true,
						plan: {
							select: {
								name: true,
								monthlyPrice: true,
								quarterlyPrice: true,
								yearlyPrice: true,
							},
						},
					},
				},
			},
		}),
		db.$queryRaw<
			{
				restaurantId: string;
				orders30: number;
				sales30: number;
				ordersPrev: number;
				last: Date | null;
			}[]
		>`
				SELECT "restaurantId",
					count(*) FILTER (WHERE "createdAt" >= ${from30} AND status <> 'CANCELLED')::int AS orders30,
					coalesce(sum(total) FILTER (WHERE "createdAt" >= ${from30} AND status <> 'CANCELLED' AND "paymentStatus" = 'PAID'), 0)::float AS sales30,
					count(*) FILTER (WHERE "createdAt" >= ${from60} AND "createdAt" < ${from30} AND status <> 'CANCELLED')::int AS "ordersPrev",
					max("createdAt") FILTER (WHERE status <> 'CANCELLED') AS last
				FROM "Order"
				GROUP BY 1`,
		db.$queryRaw<{ restaurantId: string; items: number }[]>`
				SELECT c."restaurantId", count(mi.id)::int AS items
				FROM "MenuItem" mi JOIN "MenuCategory" c ON c.id = mi."categoryId"
				GROUP BY 1`,
		db.scanEvent.groupBy({
			by: ["restaurantId"],
			where: { scannedAt: { gte: from30 } },
			_count: true,
		}),
		db.rating.groupBy({
			by: ["restaurantId"],
			where: { isHidden: false },
			_avg: { overallRating: true },
			_count: true,
		}),
		db.restaurantPaymentMethod.findMany({
			where: { isEnabled: true },
			select: { restaurantId: true, channel: true, secretKeyEncrypted: true },
		}),
		db.restaurantPayoutAccount.groupBy({
			by: ["restaurantId"],
			where: { isEnabled: true },
			_count: true,
		}),
		db.platformSetting.findFirst({
			select: { awamenuPayCommissionPercent: true },
		}),
	]);

	const orders = new Map(orderRows.map((r) => [r.restaurantId, r]));
	const items = new Map(itemRows.map((r) => [r.restaurantId, r.items]));
	const scans = new Map(scanRows.map((r) => [r.restaurantId, r._count]));
	const ratings = new Map(ratingRows.map((r) => [r.restaurantId, r]));
	const withPayout = new Set(payouts.map((p) => p.restaurantId));
	const platformRate = Number(platform?.awamenuPayCommissionPercent ?? 0);

	const rows = restaurants.map((r) => {
		const o = orders.get(r.id);
		const menuItems = items.get(r.id) ?? 0;
		const last = o?.last ?? null;
		const sinceLast = last ? (now - last.getTime()) / DAY : null;
		const ageDays = (now - r.createdAt.getTime()) / DAY;

		let health: RestaurantHealth;
		if (menuItems === 0) health = ageDays <= 14 ? "NEW" : "NO_MENU";
		else if (!last) health = ageDays <= 14 ? "NEW" : "NO_ORDERS";
		else if (sinceLast !== null && sinceLast > 14) health = "INACTIVE";
		else if (
			(o?.ordersPrev ?? 0) >= 4 &&
			(o?.orders30 ?? 0) < (o?.ordersPrev ?? 0) * 0.5
		)
			health = "SLOWING";
		else if (sinceLast !== null && sinceLast > 7) health = "QUIET";
		else health = "ACTIVE";

		const own = methods.filter((m) => m.restaurantId === r.id);
		const online =
			(own.some((m) => m.channel === "AWAMENU_PAY") && withPayout.has(r.id)) ||
			own.some((m) => m.channel === "OWN_GATEWAY" && m.secretKeyEncrypted);
		const offline = own.some(
			(m) => m.channel === "BANK_TRANSFER" || m.channel === "CASH",
		);
		const rating = ratings.get(r.id);
		const commission = effectiveCommission(
			r.commissionPercentOverride,
			platformRate,
		);

		return {
			id: r.id,
			name: r.name,
			slug: r.slug,
			logoUrl: r.logoUrl,
			address: r.address,
			isActive: r.isActive,
			suspensionReason: r.suspensionReason,
			createdAt: r.createdAt,
			owner: r.owner,
			planId: r.subscription?.planId ?? null,
			planName: r.subscription?.plan.name ?? "No plan",
			billingState: billingStateOf(r.subscription, now),
			periodEnd: r.subscription?.currentPeriodEnd ?? null,
			orders30: o?.orders30 ?? 0,
			ordersPrev: o?.ordersPrev ?? 0,
			sales30: o?.sales30 ?? 0,
			lastOrderAt: last,
			menuItems,
			scans30: scans.get(r.id) ?? 0,
			rating: rating?._avg.overallRating ?? null,
			ratingCount: rating?._count ?? 0,
			payments: online
				? ("online" as const)
				: offline
					? ("offline" as const)
					: ("none" as const),
			health,
			commission,
			commissionNote: r.commissionNote,
		};
	});

	const q = filters.q?.toLowerCase();
	const matches = (row: (typeof rows)[number]) =>
		(!q ||
			row.name.toLowerCase().includes(q) ||
			row.slug.includes(q) ||
			row.owner.email.toLowerCase().includes(q) ||
			(row.address ?? "").toLowerCase().includes(q)) &&
		(!filters.state || row.billingState === filters.state) &&
		(!filters.planId || row.planId === filters.planId) &&
		(!filters.suspended || !row.isActive) &&
		(!filters.commission || row.commission.kind === filters.commission);

	const base = rows.filter(matches);
	const healthCounts = Object.fromEntries(
		(Object.keys(HEALTH) as RestaurantHealth[]).map((h) => [
			h,
			base.filter((r) => r.health === h).length,
		]),
	) as Record<RestaurantHealth, number>;
	const filtered = filters.health
		? base.filter((r) => r.health === filters.health)
		: base;

	const by: Record<
		RestaurantSort,
		(a: (typeof rows)[number], b: (typeof rows)[number]) => number
	> = {
		newest: (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
		sales: (a, b) => b.sales30 - a.sales30,
		orders: (a, b) => b.orders30 - a.orders30,
		lastOrder: (a, b) =>
			(b.lastOrderAt?.getTime() ?? 0) - (a.lastOrderAt?.getTime() ?? 0),
		name: (a, b) => a.name.localeCompare(b.name),
	};
	filtered.sort(by[filters.sort]);

	return {
		rows: filtered.slice(page.skip, page.skip + page.take),
		total: filtered.length,
		allRows: filtered,
		healthCounts,
		summary: {
			restaurants: rows.length,
			suspended: rows.filter((r) => !r.isActive).length,
			active7: rows.filter((r) => r.health === "ACTIVE").length,
			needsAttention: rows.filter((r) =>
				["SLOWING", "INACTIVE", "NO_ORDERS", "NO_MENU"].includes(r.health),
			).length,
			sales30: rows.reduce((t, r) => t + r.sales30, 0),
			orders30: rows.reduce((t, r) => t + r.orders30, 0),
			noOnlinePayments: rows.filter((r) => r.payments !== "online").length,
		},
		platformRate,
	};
}

export type ConsoleRow = Awaited<
	ReturnType<typeof getRestaurantConsole>
>["rows"][number];
