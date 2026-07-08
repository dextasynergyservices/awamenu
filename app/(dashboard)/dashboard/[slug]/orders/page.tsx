import {
	OrderStatus,
	OrderType,
	PaymentStatus,
	type Prisma,
} from "@prisma/client";
import { ChevronLeft, ChevronRight, Filter, Search } from "lucide-react";
import Link from "next/link";
import { AdminOrdersPoller } from "@/components/orders/AdminOrdersPoller";
import { DesktopOrdersList } from "@/components/orders/DesktopOrdersList";
import { MobileOrdersView } from "@/components/orders/MobileOrdersView";
import { db } from "@/lib/db";

type OrdersPageProps = {
	params: Promise<{ slug: string }>;
	searchParams?: Promise<{
		q?: string;
		orderCode?: string;
		status?: string;
		type?: string;
		dateFrom?: string;
		dateTo?: string;
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

function startOfWeek(date: Date) {
	const copy = new Date(date);
	const day = copy.getDay();
	const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
	copy.setDate(diff);
	copy.setHours(0, 0, 0, 0);
	return copy;
}

function orderTypeLabel(type: string) {
	return type.replaceAll("_", " ");
}

function buildDate(value: string | undefined, endOfDay = false) {
	if (!value) return undefined;
	const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);
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
	const dateFrom = buildDate(query.dateFrom);
	const dateTo = buildDate(query.dateTo, true);

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug },
		select: {
			id: true,
			slug: true,
			name: true,
			currency: true,
		},
	});

	const orderWhere: Prisma.OrderWhereInput = {
		restaurantId: restaurant.id,
		...(selectedStatus ? { status: selectedStatus } : {}),
		...(selectedType ? { type: selectedType } : {}),
		...(dateFrom || dateTo
			? {
					createdAt: {
						...(dateFrom ? { gte: dateFrom } : {}),
						...(dateTo ? { lte: dateTo } : {}),
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

	const [orders, statsOrders] = await Promise.all([
		db.order.findMany({
			where: orderWhere,
			orderBy: { createdAt: "desc" },
			take: search ? 10 : 30,
			select: {
				id: true,
				customerName: true,
				customerPhone: true,
				customerEmail: true,
				type: true,
				status: true,
				statusNote: true,
				cancellationNote: true,
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
				events: {
					select: {
						id: true,
						description: true,
						isAutomatic: true,
						createdAt: true,
						staff: { select: { name: true, staffId: true } },
					},
					orderBy: { createdAt: "desc" },
				},
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
				createdAt: { gte: startOfWeek(new Date()) },
			},
			select: {
				id: true,
				total: true,
				status: true,
				paymentStatus: true,
			},
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
	const revenue = statsOrders
		.filter((order) => order.paymentStatus === PaymentStatus.PAID)
		.reduce((total, order) => total + Number(order.total), 0);

	return (
		<section className="grid gap-5">
			<AdminOrdersPoller />

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
						helper="This week"
						trend="+12%"
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
						helper="This week"
						trend="+8.2%"
						withArrow
					/>
				</div>
			</div>

			<div className="md:hidden">
				<p className="text-sm font-medium text-slate-500">{restaurant.name}</p>
				<h1 className="mt-1 text-xl font-black text-slate-950">Orders</h1>
				<p className="mt-1 text-xs font-medium text-slate-500">
					Live feed for new and active customer orders.
				</p>
			</div>

			<div className="grid gap-4">
				<div className="rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.04)] md:p-5">
					<div className="hidden md:block">
						<div>
							<h2 className="text-2xl font-black text-slate-950">Orders</h2>
						</div>
					</div>

					<form
						action={`/dashboard/${restaurant.slug}/orders`}
						className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_7rem_8rem]"
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
								className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-11 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 focus:border-emerald-700"
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
										className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none focus:border-emerald-700"
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
										className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none focus:border-emerald-700"
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
										className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none focus:border-emerald-700"
									/>
									<input
										name="dateTo"
										type="date"
										defaultValue={query.dateTo ?? ""}
										className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 outline-none focus:border-emerald-700"
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
						<div className="mt-3 flex flex-wrap items-center justify-between gap-2">
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

					<div className="mt-4 grid gap-3 md:hidden">
						<MobileOrdersView
							orders={serializedOrders}
							currency={restaurant.currency}
							slug={restaurant.slug}
							restaurantName={restaurant.name}
						/>
					</div>

					<div className="mt-4 hidden gap-3 md:grid">
						{orders.length > 0 ? (
							<DesktopOrdersList
								orders={serializedOrders}
								currency={restaurant.currency}
								slug={restaurant.slug}
								restaurantName={restaurant.name}
							/>
						) : (
							<div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
								<p className="text-lg font-black text-slate-950">
									{search ? "No matching order found" : "No orders yet"}
								</p>
							</div>
						)}
					</div>
					{orders.length > 0 ? (
						<div className="mt-6 hidden items-center justify-between gap-3 md:flex">
							<p className="text-sm font-semibold text-slate-500">
								Showing 1 to {orders.length} of {orders.length} orders
							</p>
							<div className="flex items-center gap-2">
								<button
									type="button"
									disabled
									className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 disabled:opacity-60"
								>
									<ChevronLeft className="size-4" aria-hidden="true" />
									<span className="sr-only">Previous page</span>
								</button>
								<span className="grid size-10 place-items-center rounded-full bg-emerald-700 text-sm font-black text-white shadow-[0_10px_24px_rgba(4,120,87,0.2)]">
									1
								</span>
								<button
									type="button"
									disabled
									className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-400 disabled:opacity-60"
								>
									<ChevronRight className="size-4" aria-hidden="true" />
									<span className="sr-only">Next page</span>
								</button>
							</div>
						</div>
					) : null}
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
	trend?: string;
	accent?: string;
	withArrow?: boolean;
}) {
	return (
		<div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_16px_50px_rgba(15,23,42,0.04)]">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-xs font-semibold text-slate-500">{label}</p>
					<p className={`mt-2 text-xl font-black ${accent}`}>{value}</p>
					<p className="mt-2 text-xs font-semibold text-slate-500">{helper}</p>
				</div>
				{trend ? (
					<span className="mt-8 text-xs font-black text-emerald-700">
						{trend}
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
