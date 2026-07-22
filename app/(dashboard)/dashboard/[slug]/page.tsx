import {
	OrderStatus,
	OrderType,
	PaymentStatus,
	ReservationStatus,
} from "@prisma/client";
import {
	Bike,
	CalendarDays,
	ClipboardList,
	ShoppingBag,
	Users,
	Utensils,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
	DashboardSalesChart,
	type SalesPoint,
} from "@/components/admin/DashboardSalesChart";
import { QRDownload } from "@/components/admin/QRDownload";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { getQrScanUrl } from "@/lib/qr";

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

function startOfDay(date: Date) {
	const copy = new Date(date);
	copy.setHours(0, 0, 0, 0);
	return copy;
}

function addDays(date: Date, days: number) {
	const copy = new Date(date);
	copy.setDate(copy.getDate() + days);
	return copy;
}

function dateKey(date: Date) {
	return date.toISOString().slice(0, 10);
}

function hourLabel(hour: number) {
	const period = hour < 12 ? "AM" : "PM";
	const displayHour = hour % 12 === 0 ? 12 : hour % 12;
	return `${displayHour} ${period}`;
}

function buildDayPoints(
	orders: { createdAt: Date; total: number }[],
	today: Date,
) {
	const hourly = new Array(24).fill(0) as number[];
	for (const order of orders) {
		if (order.createdAt < today) continue;
		hourly[order.createdAt.getHours()] += order.total;
	}
	return hourly.map(
		(value, hour): SalesPoint => ({ label: hourLabel(hour), value }),
	);
}

function buildDailyPoints(
	orders: { createdAt: Date; total: number }[],
	days: number,
	labelFormat: Intl.DateTimeFormatOptions,
) {
	const today = startOfDay(new Date());
	const buckets = new Map<string, SalesPoint>();
	for (let i = days - 1; i >= 0; i--) {
		const date = addDays(today, -i);
		buckets.set(dateKey(date), {
			label: date.toLocaleDateString("en-US", labelFormat),
			value: 0,
		});
	}
	for (const order of orders) {
		const bucket = buckets.get(dateKey(startOfDay(order.createdAt)));
		if (bucket) bucket.value += order.total;
	}
	return Array.from(buckets.values());
}

function orderTypeIcon(type: OrderType) {
	if (type === OrderType.DELIVERY) return Bike;
	if (type === OrderType.PICKUP) return ShoppingBag;
	if (type === OrderType.TABLE_RESERVATION) return CalendarDays;
	return Utensils;
}

export default async function DashboardPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const user = await requireUser();
	const { slug } = await params;
	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		select: { id: true, name: true, currency: true },
	});

	if (!restaurant) redirect("/onboarding/choose-plan");

	const qrUrl = getQrScanUrl(slug);
	const today = startOfDay(new Date());
	const tomorrow = addDays(today, 1);
	const thirtyDaysAgo = addDays(today, -29);

	const [
		totalMenuItems,
		publishedMenuItems,
		ordersTodayCount,
		pendingOrdersTodayCount,
		reservationsTodayCount,
		pendingReservationsTodayCount,
		activeStaffCount,
		totalStaffCount,
		recentOrders,
		last30DaysOrders,
		topSellingRaw,
	] = await Promise.all([
		db.menuItem.count({ where: { category: { restaurantId: restaurant.id } } }),
		db.menuItem.count({
			where: { category: { restaurantId: restaurant.id }, isAvailable: true },
		}),
		db.order.count({
			where: {
				restaurantId: restaurant.id,
				createdAt: { gte: today, lt: tomorrow },
				status: { not: OrderStatus.CANCELLED },
			},
		}),
		db.order.count({
			where: {
				restaurantId: restaurant.id,
				createdAt: { gte: today, lt: tomorrow },
				status: {
					in: [OrderStatus.PENDING_APPROVAL, OrderStatus.PENDING_PAYMENT],
				},
			},
		}),
		db.reservation.count({
			where: {
				restaurantId: restaurant.id,
				startsAt: { gte: today, lt: tomorrow },
				status: {
					notIn: [
						ReservationStatus.CANCELLED,
						ReservationStatus.DECLINED,
						ReservationStatus.EXPIRED,
					],
				},
			},
		}),
		db.reservation.count({
			where: {
				restaurantId: restaurant.id,
				startsAt: { gte: today, lt: tomorrow },
				status: ReservationStatus.PENDING_APPROVAL,
			},
		}),
		db.staffMember.count({
			where: { restaurantId: restaurant.id, isActive: true },
		}),
		db.staffMember.count({ where: { restaurantId: restaurant.id } }),
		db.order.findMany({
			where: { restaurantId: restaurant.id },
			orderBy: { createdAt: "desc" },
			take: 3,
			select: {
				id: true,
				customerName: true,
				total: true,
				status: true,
				type: true,
			},
		}),
		db.order.findMany({
			where: {
				restaurantId: restaurant.id,
				createdAt: { gte: thirtyDaysAgo },
				paymentStatus: PaymentStatus.PAID,
				status: { not: OrderStatus.CANCELLED },
			},
			select: { createdAt: true, total: true },
		}),
		db.orderItem.groupBy({
			by: ["menuItemId"],
			where: {
				order: {
					restaurantId: restaurant.id,
					status: { not: OrderStatus.CANCELLED },
				},
			},
			_sum: { qty: true },
			orderBy: { _sum: { qty: "desc" } },
			take: 5,
		}),
	]);

	const topSellingIds = topSellingRaw.map((entry) => entry.menuItemId);
	const topSellingMenuItems =
		topSellingIds.length > 0
			? await db.menuItem.findMany({
					where: { id: { in: topSellingIds } },
					select: { id: true, name: true, price: true },
				})
			: [];
	const topSellingItems = topSellingRaw
		.map((entry) => {
			const item = topSellingMenuItems.find(
				(menuItem) => menuItem.id === entry.menuItemId,
			);
			if (!item) return null;
			return {
				id: item.id,
				name: item.name,
				price: Number(item.price),
				qtySold: entry._sum.qty ?? 0,
			};
		})
		.filter((entry): entry is NonNullable<typeof entry> => entry !== null);

	const chartOrders = last30DaysOrders.map((order) => ({
		createdAt: order.createdAt,
		total: Number(order.total),
	}));
	const dayPoints = buildDayPoints(chartOrders, today);
	const weekPoints = buildDailyPoints(chartOrders, 7, { weekday: "short" });
	const monthPoints = buildDailyPoints(chartOrders, 30, {
		month: "short",
		day: "numeric",
	});

	const statCards = [
		{
			label: "Menu Items",
			value: String(totalMenuItems),
			helper: "Across all categories",
			change: `${publishedMenuItems} published`,
			icon: ShoppingBag,
			tone: "bg-emerald-100 text-emerald-700",
		},
		{
			label: "Orders Today",
			value: String(ordersTodayCount),
			helper: "Since midnight",
			change:
				pendingOrdersTodayCount > 0
					? `${pendingOrdersTodayCount} need action`
					: "All handled",
			icon: ClipboardList,
			tone: "bg-yellow-100 text-yellow-600",
		},
		{
			label: "Reservations",
			value: String(reservationsTodayCount),
			helper: "Upcoming today",
			change:
				pendingReservationsTodayCount > 0
					? `${pendingReservationsTodayCount} need approval`
					: "All confirmed",
			icon: CalendarDays,
			tone: "bg-purple-100 text-purple-600",
		},
		{
			label: "Staff Members",
			value: String(activeStaffCount),
			helper: "Active on your team",
			change:
				totalStaffCount > activeStaffCount
					? `${totalStaffCount - activeStaffCount} suspended`
					: "All active",
			icon: Users,
			tone: "bg-blue-100 text-blue-600",
		},
	];

	return (
		<section className="grid min-w-0 max-w-full overflow-hidden gap-4 md:gap-5">
			<div className="min-w-0 md:hidden">
				<p className="text-xs font-medium text-slate-500">Welcome back,</p>
				<h2 className="mt-1 truncate text-sm font-black text-slate-950">
					{restaurant.name}
				</h2>
				<p className="mt-1 truncate text-xs font-medium text-slate-500">
					Here&apos;s what&apos;s happening today.
				</p>
			</div>
			<div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 min-[390px]:gap-3 sm:gap-4 xl:grid-cols-4 xl:gap-5">
				{statCards.map((card) => {
					const Icon = card.icon;

					return (
						<div
							key={card.label}
							className="min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white p-2.5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] min-[390px]:p-3 sm:rounded-3xl sm:p-5 xl:p-6"
						>
							<div className="flex min-w-0 items-center gap-2 min-[390px]:gap-3 sm:gap-4">
								<div
									className={`grid size-10 shrink-0 place-items-center rounded-full min-[390px]:size-12 sm:size-16 xl:size-14 ${card.tone}`}
								>
									<Icon
										className="size-5 min-[390px]:size-6 sm:size-8 xl:size-7"
										aria-hidden="true"
									/>
								</div>
								<div className="min-w-0">
									<p className="truncate text-xs font-medium text-slate-500 sm:text-base">
										{card.label}
									</p>
									<p className="mt-0.5 text-xl font-black text-slate-950 sm:text-2xl xl:text-3xl">
										{card.value}
									</p>
									<p className="truncate text-xs font-medium text-slate-500 sm:text-sm">
										{card.helper}
									</p>
								</div>
							</div>
							<p className="mt-3 inline-flex min-h-8 max-w-full items-center rounded-xl bg-emerald-50 px-2 text-xs font-bold text-emerald-700 sm:mt-5 sm:min-h-9 sm:px-3 sm:text-sm">
								<span className="truncate">{card.change}</span>
							</p>
						</div>
					);
				})}
			</div>

			<div className="grid min-w-0 gap-5 xl:grid-cols-[1.7fr_1fr]">
				<DashboardSalesChart
					currency={restaurant.currency}
					day={dayPoints}
					week={weekPoints}
					month={monthPoints}
				/>

				<div className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-5 xl:p-6">
					<div className="flex min-w-0 items-center justify-between gap-3">
						<h3 className="text-sm font-black text-slate-950 sm:text-xl">
							Top Selling Items
						</h3>
						<Link
							href={`/dashboard/${slug}/menu`}
							className="text-xs font-black text-emerald-700 sm:text-sm"
						>
							View all
						</Link>
					</div>
					{topSellingItems.length > 0 ? (
						<div className="mt-5 flex max-w-full gap-4 overflow-x-auto pb-2 xl:grid xl:gap-3 xl:overflow-visible xl:pb-0">
							{topSellingItems.map((item, index) => (
								<div
									key={item.id}
									className="min-w-24 text-center min-[390px]:min-w-28 xl:grid xl:min-w-0 xl:grid-cols-[auto_auto_minmax(0,1fr)_auto] xl:items-center xl:gap-3 xl:rounded-2xl xl:p-2 xl:text-left xl:hover:bg-slate-50"
								>
									<span className="grid size-7 place-items-center rounded-lg bg-yellow-300 text-sm font-black text-emerald-950">
										{index + 1}
									</span>
									<div className="mx-auto mt-2 grid size-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 xl:mx-0 xl:mt-0 xl:size-12 xl:rounded-xl">
										<Utensils className="size-5" aria-hidden="true" />
									</div>
									<div className="mt-2 min-w-0 flex-1 xl:mt-0">
										<p className="truncate text-sm font-black text-slate-950">
											{item.name}
										</p>
										<p className="text-xs font-medium text-slate-500">
											{item.qtySold} sold
										</p>
									</div>
									<p className="mt-1 text-sm font-black text-slate-950 xl:mt-0 xl:text-right">
										{formatMoney(item.price, restaurant.currency)}
									</p>
								</div>
							))}
						</div>
					) : (
						<div className="mt-5 grid place-items-center rounded-2xl border border-dashed border-slate-200 p-6 text-center">
							<p className="text-xs font-bold text-slate-500 sm:text-sm">
								No orders yet. Your best-selling items will show up here.
							</p>
						</div>
					)}
				</div>
			</div>

			<div className="grid min-w-0 gap-5 xl:grid-cols-[1.1fr_1fr_1fr]">
				<div className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] xl:col-span-2 xl:p-6">
					<div className="flex min-w-0 items-center justify-between gap-3">
						<h3 className="text-sm font-black text-slate-950 sm:text-xl">
							Recent Orders
						</h3>
						<Link
							href={`/dashboard/${slug}/orders`}
							className="text-xs font-black text-emerald-700 sm:text-sm"
						>
							View all
						</Link>
					</div>
					{recentOrders.length > 0 ? (
						<div className="mt-5 grid divide-y divide-slate-100">
							{recentOrders.map((order) => {
								const Icon = orderTypeIcon(order.type);
								return (
									<Link
										key={order.id}
										href={`/dashboard/${slug}/orders?q=${order.id.slice(-6).toUpperCase()}`}
										className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 py-4"
									>
										<div className="flex min-w-0 items-center gap-3">
											<div className="grid size-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
												<Icon className="size-5" aria-hidden="true" />
											</div>
											<div className="min-w-0">
												<p className="truncate font-black text-slate-950">
													#{order.id.slice(-6).toUpperCase()}
												</p>
												<p className="truncate text-sm font-medium text-slate-500">
													{order.customerName}
												</p>
											</div>
										</div>
										<div className="min-w-0 text-right">
											<p className="font-black text-slate-950">
												{formatMoney(Number(order.total), restaurant.currency)}
											</p>
											<p className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
												{order.status.replaceAll("_", " ")}
											</p>
										</div>
									</Link>
								);
							})}
						</div>
					) : (
						<div className="mt-5 grid place-items-center rounded-2xl border border-dashed border-slate-200 p-6 text-center">
							<p className="text-xs font-bold text-slate-500 sm:text-sm">
								No orders yet. Share your QR code to start receiving orders.
							</p>
						</div>
					)}
				</div>

				<div className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] xl:p-6">
					<h3 className="text-sm font-black text-slate-950 sm:text-xl">
						Quick Actions
					</h3>
					<div className="mt-5 grid grid-cols-2 gap-3">
						{[
							{
								label: "Add Menu Item",
								icon: Utensils,
								href: `/dashboard/${slug}/menu`,
							},
							{
								label: "View Orders",
								icon: ClipboardList,
								href: `/dashboard/${slug}/orders`,
							},
							{
								label: "Reservations",
								icon: CalendarDays,
								href: `/dashboard/${slug}/reservations`,
							},
							{
								label: "Add Staff",
								icon: Users,
								href: `/dashboard/${slug}/staff`,
							},
						].map((action) => {
							const Icon = action.icon;

							return (
								<Link
									key={action.label}
									href={action.href}
									className="grid min-h-24 min-w-0 place-items-center rounded-2xl border border-slate-200 bg-white p-3 text-xs font-black text-slate-700 sm:text-sm"
								>
									<Icon
										className="size-6 text-emerald-700"
										aria-hidden="true"
									/>
									<span className="text-center">{action.label}</span>
								</Link>
							);
						})}
					</div>
					<div className="mt-4">
						<QRDownload restaurantName={restaurant.name} qrUrl={qrUrl} />
					</div>
				</div>
			</div>
		</section>
	);
}
