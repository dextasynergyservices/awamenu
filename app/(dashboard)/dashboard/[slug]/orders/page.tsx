import {
	OrderStatus,
	OrderType,
	PaymentStatus,
	type Prisma,
} from "@prisma/client";
import { ChevronRight, Filter, Search } from "lucide-react";
import Link from "next/link";
import { DesktopOrdersList } from "@/components/orders/DesktopOrdersList";
import { MobileOrdersView } from "@/components/orders/MobileOrdersView";
import { Pagination } from "@/components/ui/Pagination";
import { db } from "@/lib/db";
import { clampPage, pageInfo, parsePage } from "@/lib/pagination";
import { getRestaurantPlanFeatures } from "@/lib/plan-features";
import {
	addDaysToDateKey,
	formatChange,
	percentChange,
	restaurantCalendar,
	startOfDateIn,
} from "@/lib/restaurant-day";

type OrdersPageProps = {
	params: Promise<{ slug: string }>;
	searchParams?: Promise<{
		q?: string;
		orderCode?: string;
		status?: string;
		type?: string;
		dateFrom?: string;
		dateTo?: string;
		/** "1": only orders flagged as needing a refund. */
		refund?: string;
		page?: string;
		size?: string;
	}>;
};

export const dynamic = "force-dynamic";

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

function orderTypeLabel(type: string) {
	return type.replaceAll("_", " ");
}

/** A filter date ("YYYY-MM-DD") as the start of that day, or of the next day
 *  for an inclusive "to" date, in the restaurant's timezone. */
function buildDate(
	value: string | undefined,
	timeZone: string,
	endOfDay = false,
) {
	if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
	const date = startOfDateIn(
		timeZone,
		endOfDay ? addDaysToDateKey(value, 1) : value,
	);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function OrdersPage({
	params,
	searchParams,
}: OrdersPageProps) {
	const { slug } = await params;
	const query = (await searchParams) ?? {};
	const rawSearch = query.q ?? query.orderCode ?? "";
	const search = rawSearch.replace(/^#/, "").trim();
	const selectedStatus = Object.values(OrderStatus).includes(
		query.status as OrderStatus,
	)
		? (query.status as OrderStatus)
		: "";
	const selectedType = Object.values(OrderType).includes(
		query.type as OrderType,
	)
		? (query.type as OrderType)
		: "";
	const refundOnly = query.refund === "1";

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug },
		select: {
			id: true,
			slug: true,
			name: true,
			currency: true,
			timezone: true,
		},
	});
	const dateFrom = buildDate(query.dateFrom, restaurant.timezone);
	const dateTo = buildDate(query.dateTo, restaurant.timezone, true);
	const calendar = restaurantCalendar(restaurant.timezone);

	const planFeatures = await getRestaurantPlanFeatures(restaurant.id);

	const orderWhere: Prisma.OrderWhereInput = {
		restaurantId: restaurant.id,
		...(selectedStatus ? { status: selectedStatus } : {}),
		...(selectedType ? { type: selectedType } : {}),
		...(refundOnly ? { refundRequiredReason: { not: null } } : {}),
		...(dateFrom || dateTo
			? {
					createdAt: {
						...(dateFrom ? { gte: dateFrom } : {}),
						...(dateTo ? { lt: dateTo } : {}),
					},
				}
			: {}),
	};

	if (search) {
		orderWhere.OR = [
			{ id: search.toLowerCase() },
			{ id: { endsWith: search.toLowerCase() } },
			{ customerName: { contains: search, mode: "insensitive" } },
			{ customerPhone: { contains: search } },
			{ customerEmail: { contains: search, mode: "insensitive" } },
		];
	}

	const totalOrders = await db.order.count({ where: orderWhere });
	const page = clampPage(parsePage(query), totalOrders);

	const [orders, statsOrders, lastWeekOrders] = await Promise.all([
		db.order.findMany({
			where: orderWhere,
			orderBy: { createdAt: "desc" },
			skip: page.skip,
			take: page.take,
			select: {
				id: true,
				customerName: true,
				customerPhone: true,
				customerEmail: true,
				type: true,
				status: true,
				statusNote: true,
				cancellationNote: true,
				refundRequiredReason: true,
				paymentStatus: true,
				tableNumber: true,
				tableLabel: true,
				deliveryAddress: true,
				deliveryNotes: true,
				dineInPaymentPolicy: true,
				dineInPaymentMethod: true,
				dineInServiceMode: true,
				waiterName: true,
				total: true,
				createdAt: true,
				items: {
					select: {
						id: true,
						name: true,
						qty: true,
						unitPrice: true,
						notes: true,
					},
				},
				payments: {
					select: {
						amount: true,
						method: true,
					},
				},
				confirmedAt: true,
				acceptedAt: true,
				preparingAt: true,
				readyAt: true,
				deliveredAt: true,
				completedAt: true,
				cancelledAt: true,
				attendingStaff: {
					select: {
						name: true,
						staffId: true,
					},
				},
			},
		}),
		db.order.findMany({
			where: {
				restaurantId: restaurant.id,
				createdAt: { gte: calendar.weekStart },
			},
			select: {
				id: true,
				total: true,
				status: true,
				paymentStatus: true,
			},
		}),
		// Last week up to the same point, so the trend compares like with like.
		db.order.findMany({
			where: {
				restaurantId: restaurant.id,
				createdAt: {
					gte: calendar.lastWeekStart,
					lt: calendar.lastWeekSameTime,
				},
			},
			select: { total: true, status: true, paymentStatus: true },
		}),
	]);

	const serializedOrders = orders.map((order) => ({
		...order,
		total: order.total.toString(),
		createdAt: order.createdAt.toISOString(),
		items: order.items.map((item) => ({
			...item,
			unitPrice: item.unitPrice.toString(),
		})),
		payments: order.payments.map((p) => ({
			method: p.method,
			amount: p.amount.toString(),
		})),
	}));
	const pendingCount = statsOrders.filter(
		(order) => order.paymentStatus === PaymentStatus.PENDING,
	).length;
	const paidRevenue = (list: typeof lastWeekOrders) =>
		list
			.filter((order) => order.paymentStatus === PaymentStatus.PAID)
			.reduce((total, order) => total + Number(order.total), 0);
	const revenue = paidRevenue(statsOrders);
	const ordersTrend = percentChange(statsOrders.length, lastWeekOrders.length);
	const revenueTrend = percentChange(revenue, paidRevenue(lastWeekOrders));

	return (
		<section className="grid min-w-0 max-w-full gap-5 overflow-hidden">
			<div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_auto] md:gap-6">
				<div>
					<p className="mt-2 text-sm font-semibold text-slate-500">
						Manage and track all customer orders in real-time.
					</p>
				</div>
				<div className="grid min-w-2xl grid-cols-3 gap-4">
					<MetricCard
						label="Total Orders"
						value={String(statsOrders.length)}
						helper="This week, vs last week"
						trend={ordersTrend}
					/>
					<MetricCard
						label="Pending"
						value={String(pendingCount)}
						helper="View orders"
						accent="text-yellow-600"
					/>
					<MetricCard
						label="Revenue"
						value={formatMoney(revenue, restaurant.currency)}
						helper="Paid this week, vs last week"
						trend={revenueTrend}
					/>
				</div>
			</div>

			<div className="grid min-w-0 gap-4">
				<div className="min-w-0 rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.04)] md:p-5">
					<div className="hidden md:block">
						<div>
							<h2 className="text-2xl font-black text-slate-950">Orders</h2>
						</div>
					</div>

					<form
						action={`/dashboard/${restaurant.slug}/orders`}
						className="mt-4 hidden gap-3 md:grid md:grid-cols-[minmax(0,1fr)_7rem_8rem]"
					>
						<label className="relative">
							<span className="sr-only">
								Search by order code, customer name, phone, or email
							</span>
							<Search
								className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-slate-400"
								aria-hidden="true"
							/>
							<input
								name="q"
								defaultValue={rawSearch}
								placeholder="Search by order code, customer name, phone, or email..."
								className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-11 text-base font-semibold text-slate-700 outline-none placeholder:text-slate-400 focus:border-emerald-700 md:text-sm"
							/>
						</label>
						<details className="group relative">
							<summary className="inline-flex min-h-12 w-full cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 [&::-webkit-details-marker]:hidden">
								<Filter className="size-4" aria-hidden="true" />
								Filter
							</summary>
							<div className="absolute right-0 z-20 mt-2 grid w-80 gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.12)]">
								<label className="grid gap-2 text-xs font-black text-slate-700">
									Status
									<select
										name="status"
										defaultValue={selectedStatus}
										className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-semibold text-slate-600 outline-none focus:border-emerald-700 md:text-sm"
									>
										<option value="">All statuses</option>
										{Object.values(OrderStatus).map((status) => (
											<option key={status} value={status}>
												{status.replaceAll("_", " ")}
											</option>
										))}
									</select>
								</label>
								<label className="grid gap-2 text-xs font-black text-slate-700">
									Order type
									<select
										name="type"
										defaultValue={selectedType}
										className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-semibold text-slate-600 outline-none focus:border-emerald-700 md:text-sm"
									>
										<option value="">All types</option>
										{Object.values(OrderType).map((type) => (
											<option key={type} value={type}>
												{orderTypeLabel(type)}
											</option>
										))}
									</select>
								</label>
								<div className="grid gap-2 text-xs font-black text-slate-700">
									Date range
									<input
										name="dateFrom"
										type="date"
										defaultValue={query.dateFrom ?? ""}
										className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-semibold text-slate-600 outline-none focus:border-emerald-700 md:text-sm"
									/>
									<input
										name="dateTo"
										type="date"
										defaultValue={query.dateTo ?? ""}
										className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-semibold text-slate-600 outline-none focus:border-emerald-700 md:text-sm"
									/>
								</div>
							</div>
						</details>
						<button
							type="submit"
							className="min-h-12 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white shadow-[0_10px_24px_rgba(4,120,87,0.2)]"
						>
							Find order
						</button>
					</form>

					{search ? (
						<div className="mt-3 hidden flex-wrap items-center justify-between gap-2 md:flex">
							<p className="text-xs font-semibold text-slate-500">
								Showing orders matching #{search.toUpperCase()}.
							</p>
							<Link
								href={`/dashboard/${restaurant.slug}/orders`}
								className="text-xs font-black text-emerald-700"
							>
								Clear search
							</Link>
						</div>
					) : null}

					{refundOnly || selectedStatus ? (
						<div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2">
							<p className="text-xs font-bold text-amber-900">
								Showing{" "}
								{refundOnly
									? "orders that need a refund"
									: `${selectedStatus.replaceAll("_", " ").toLowerCase()} orders`}
								.
							</p>
							<Link
								href={`/dashboard/${restaurant.slug}/orders`}
								className="text-xs font-black text-emerald-700"
							>
								Show all orders
							</Link>
						</div>
					) : null}

					<div className="mt-4 grid min-w-0 gap-3 md:hidden">
						<MobileOrdersView
							orders={serializedOrders}
							currency={restaurant.currency}
							slug={restaurant.slug}
							restaurantName={restaurant.name}
							whatsappEnabled={planFeatures.whatsappIntegration}
						/>
					</div>

					<div className="mt-4 hidden gap-3 md:grid">
						{orders.length > 0 ? (
							<DesktopOrdersList
								orders={serializedOrders}
								currency={restaurant.currency}
								slug={restaurant.slug}
								restaurantName={restaurant.name}
								whatsappEnabled={planFeatures.whatsappIntegration}
							/>
						) : (
							<div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
								<p className="text-lg font-black text-slate-950">
									{search ? "No matching order found" : "No orders yet"}
								</p>
							</div>
						)}
					</div>
					<Pagination
						className="mt-6"
						info={pageInfo(page, totalOrders)}
						basePath={`/dashboard/${restaurant.slug}/orders`}
						query={query}
						noun="orders"
					/>
				</div>
			</div>
		</section>
	);
}

function MetricCard({
	label,
	value,
	helper,
	trend,
	accent = "text-slate-950",
	withArrow = false,
}: {
	label: string;
	value: string;
	helper: string;
	/** Percentage change; null when there's nothing to compare with. */
	trend?: number | null;
	accent?: string;
	withArrow?: boolean;
}) {
	const trendText = trend === undefined ? null : formatChange(trend);
	return (
		<div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.04)]">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-xs font-semibold text-slate-500">{label}</p>
					<p className={`mt-2 text-xl font-black ${accent}`}>{value}</p>
					<p className="mt-2 text-xs font-semibold text-slate-500">{helper}</p>
				</div>
				{trendText ? (
					<span
						className={`mt-8 text-xs font-black ${
							(trend ?? 0) > 0
								? "text-emerald-700"
								: (trend ?? 0) < 0
									? "text-red-600"
									: "text-slate-500"
						}`}
					>
						{trendText}
					</span>
				) : null}
				{withArrow ? (
					<span className="mt-9 grid size-7 place-items-center rounded-full text-slate-700">
						<ChevronRight className="size-5" aria-hidden="true" />
					</span>
				) : null}
			</div>
		</div>
	);
}
