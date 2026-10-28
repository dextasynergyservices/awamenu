import {
	OrderStatus,
	OrderType,
	PaymentStatus,
	ReservationStatus,
} from "@prisma/client";
import {
	AlertTriangle,
	Bike,
	CalendarDays,
	ChevronRight,
	ClipboardList,
	CreditCard,
	KeyRound,
	type LucideIcon,
	Receipt,
	RotateCcw,
	ShoppingBag,
	TrendingUp,
	Users,
	Utensils,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
	LatestReviewsPanel,
	MenuHealthPanel,
	RightNowPanel,
	TodaysBookingsPanel,
} from "@/components/admin/DashboardLivePanels";
import {
	DashboardSalesChart,
	type SalesPoint,
} from "@/components/admin/DashboardSalesChart";
import { QRDownload } from "@/components/admin/QRDownload";
import { SetupChecklist } from "@/components/admin/SetupChecklist";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { getOpenState } from "@/lib/opening-hours";
import { getStatusLabel } from "@/lib/order-status-flow";
import { getQrScanUrl } from "@/lib/qr";
import {
	addDaysToDateKey,
	dateKeyIn,
	formatChange,
	hourIn,
	percentChange,
	restaurantCalendar,
} from "@/lib/restaurant-day";
import { getSetupTasks } from "@/lib/setup-checklist";
import { formatInTimeZone } from "@/lib/zoned-time";

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

function hourLabel(hour: number) {
	const period = hour < 12 ? "AM" : "PM";
	const displayHour = hour % 12 === 0 ? 12 : hour % 12;
	return `${displayHour} ${period}`;
}

type ChartOrder = { createdAt: Date; total: number };

/** Today's sales by hour, on the restaurant's clock. */
function buildDayPoints(
	orders: ChartOrder[],
	timeZone: string,
	todayStart: Date,
): SalesPoint[] {
	const hourly = new Array(24).fill(0) as number[];
	for (const order of orders) {
		if (order.createdAt < todayStart) continue;
		hourly[hourIn(timeZone, order.createdAt)] += order.total;
	}
	return hourly.map((value, hour) => ({ label: hourLabel(hour), value }));
}

/** The last `days` days' sales, bucketed by the restaurant's calendar date. */
function buildDailyPoints(
	orders: ChartOrder[],
	timeZone: string,
	today: string,
	days: number,
	labelFormat: Intl.DateTimeFormatOptions,
): SalesPoint[] {
	const buckets = new Map<string, SalesPoint>();
	for (let i = days - 1; i >= 0; i--) {
		const key = addDaysToDateKey(today, -i);
		buckets.set(key, {
			label: new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", {
				...labelFormat,
				timeZone: "UTC",
			}),
			value: 0,
		});
	}
	for (const order of orders) {
		const bucket = buckets.get(dateKeyIn(timeZone, order.createdAt));
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

function statusTone(status: OrderStatus) {
	if (status === OrderStatus.CANCELLED) return "bg-red-50 text-red-700";
	if (status === OrderStatus.COMPLETED || status === OrderStatus.DELIVERED)
		return "bg-emerald-50 text-emerald-700";
	if (
		status === OrderStatus.PENDING_APPROVAL ||
		status === OrderStatus.PENDING_PAYMENT
	)
		return "bg-amber-50 text-amber-800";
	return "bg-blue-50 text-blue-700";
}

/** Orders that count as sales: paid and not cancelled. */
const salesWhere = {
	paymentStatus: PaymentStatus.PAID,
	status: { not: OrderStatus.CANCELLED },
};

export default async function DashboardPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const user = await requireUser();
	const { slug } = await params;
	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		select: {
			id: true,
			name: true,
			currency: true,
			timezone: true,
			setupChecklistDismissedAt: true,
			tableReservationEnabled: true,
			openingHours: {
				select: { dayOfWeek: true, opensAt: true, closesAt: true },
			},
		},
	});

	if (!restaurant) redirect("/onboarding/choose-plan");

	const setupTasks = await getSetupTasks(slug);
	const qrUrl = getQrScanUrl(slug);
	const tz = restaurant.timezone;
	const now = new Date();
	const cal = restaurantCalendar(tz, now);
	const rid = restaurant.id;

	const [
		todaySales,
		yesterdaySales,
		ordersTodayCount,
		ordersYesterdayCount,
		reservationsToday,
		awaitingAcceptance,
		ordersNeedingRefund,
		reservationsToApprove,
		reservationsAwaitingPayment,
		reservationsNeedingRefund,
		staffWithoutPin,
		staffLocked,
		recentOrders,
		last30DaysOrders,
		topSellingRaw,
	] = await Promise.all([
		db.order.aggregate({
			where: {
				restaurantId: rid,
				...salesWhere,
				createdAt: { gte: cal.todayStart, lt: cal.tomorrowStart },
			},
			_sum: { total: true },
			_count: true,
		}),
		db.order.aggregate({
			where: {
				restaurantId: rid,
				...salesWhere,
				createdAt: { gte: cal.yesterdayStart, lt: cal.yesterdaySameTime },
			},
			_sum: { total: true },
		}),
		db.order.count({
			where: {
				restaurantId: rid,
				createdAt: { gte: cal.todayStart, lt: cal.tomorrowStart },
				status: { not: OrderStatus.CANCELLED },
			},
		}),
		db.order.count({
			where: {
				restaurantId: rid,
				createdAt: { gte: cal.yesterdayStart, lt: cal.yesterdaySameTime },
				status: { not: OrderStatus.CANCELLED },
			},
		}),
		db.reservation.count({
			where: {
				restaurantId: rid,
				startsAt: { gte: cal.todayStart, lt: cal.tomorrowStart },
				status: {
					in: [
						ReservationStatus.APPROVED,
						ReservationStatus.ACTIVE,
						ReservationStatus.CHECKED_IN,
						ReservationStatus.COMPLETED,
					],
				},
			},
		}),
		db.order.count({
			where: { restaurantId: rid, status: OrderStatus.PENDING_APPROVAL },
		}),
		db.order.count({
			where: { restaurantId: rid, refundRequiredReason: { not: null } },
		}),
		db.reservation.count({
			where: {
				restaurantId: rid,
				status: ReservationStatus.PENDING_APPROVAL,
				startsAt: { gte: now },
			},
		}),
		db.reservation.count({
			where: {
				restaurantId: rid,
				status: ReservationStatus.APPROVED,
				startsAt: { gte: now },
			},
		}),
		db.reservation.count({
			where: { restaurantId: rid, refundRequiredReason: { not: null } },
		}),
		db.staffMember.count({
			where: { restaurantId: rid, isActive: true, pinHash: null },
		}),
		db.staffMember.count({
			where: { restaurantId: rid, isActive: true, pinLockedUntil: { gt: now } },
		}),
		db.order.findMany({
			where: { restaurantId: rid },
			orderBy: { createdAt: "desc" },
			take: 6,
			select: {
				id: true,
				customerName: true,
				total: true,
				status: true,
				type: true,
				createdAt: true,
			},
		}),
		db.order.findMany({
			where: {
				restaurantId: rid,
				...salesWhere,
				createdAt: { gte: cal.thirtyDaysStart },
			},
			select: { createdAt: true, total: true },
		}),
		db.orderItem.groupBy({
			by: ["menuItemId"],
			where: {
				order: {
					restaurantId: rid,
					status: { not: OrderStatus.CANCELLED },
					createdAt: { gte: cal.thirtyDaysStart },
				},
			},
			_sum: { qty: true },
			orderBy: { _sum: { qty: "desc" } },
			take: 5,
		}),
	]);

	// "Right now", today's bookings, reviews and menu health.
	const [pipelineRaw, todaysBookings, latestReviews, rating30, menuCounts] =
		await Promise.all([
			db.order.groupBy({
				by: ["status"],
				where: {
					restaurantId: rid,
					status: {
						in: [
							OrderStatus.PENDING_APPROVAL,
							OrderStatus.CONFIRMED,
							OrderStatus.PREPARING,
							OrderStatus.READY,
						],
					},
				},
				_count: true,
			}),
			db.reservation.findMany({
				where: {
					restaurantId: rid,
					startsAt: {
						gte: new Date(now.getTime() - 60 * 60 * 1000),
						lt: cal.tomorrowStart,
					},
					status: {
						in: [
							ReservationStatus.PENDING_APPROVAL,
							ReservationStatus.APPROVED,
							ReservationStatus.ACTIVE,
							ReservationStatus.CHECKED_IN,
						],
					},
				},
				orderBy: { startsAt: "asc" },
				take: 5,
				select: {
					id: true,
					customerName: true,
					partySize: true,
					startsAt: true,
					status: true,
					table: { select: { label: true } },
				},
			}),
			db.rating.findMany({
				where: { restaurantId: rid, isHidden: false },
				orderBy: { createdAt: "desc" },
				take: 3,
				select: {
					id: true,
					overallRating: true,
					comment: true,
					customerName: true,
					createdAt: true,
				},
			}),
			db.rating.aggregate({
				where: {
					restaurantId: rid,
					isHidden: false,
					createdAt: { gte: cal.thirtyDaysStart },
				},
				_avg: { overallRating: true },
			}),
			Promise.all([
				db.menuItem.count({
					where: { isAvailable: true, category: { restaurantId: rid } },
				}),
				db.menuItem.count({
					where: {
						isAvailable: true,
						imageUrl: null,
						category: { restaurantId: rid },
					},
				}),
				db.menuItem.count({
					where: {
						isAvailable: true,
						soldOutUntil: { gt: now },
						category: { restaurantId: rid },
					},
				}),
				db.menuItem.count({
					where: { isAvailable: false, category: { restaurantId: rid } },
				}),
			]),
		]);
	const pipelineCount = (...statuses: OrderStatus[]) =>
		pipelineRaw
			.filter((p) => statuses.includes(p.status))
			.reduce((t, p) => t + p._count, 0);
	const openState = getOpenState(restaurant.openingHours, tz, now);

	const topSellingMenuItems =
		topSellingRaw.length > 0
			? await db.menuItem.findMany({
					where: { id: { in: topSellingRaw.map((entry) => entry.menuItemId) } },
					select: { id: true, name: true, price: true, imageUrl: true },
				})
			: [];
	const topSellingItems = topSellingRaw
		.map((entry) => {
			const item = topSellingMenuItems.find((m) => m.id === entry.menuItemId);
			if (!item) return null;
			return {
				id: item.id,
				name: item.name,
				imageUrl: item.imageUrl,
				price: Number(item.price),
				qtySold: entry._sum.qty ?? 0,
			};
		})
		.filter((entry): entry is NonNullable<typeof entry> => entry !== null);

	const chartOrders = last30DaysOrders.map((order) => ({
		createdAt: order.createdAt,
		total: Number(order.total),
	}));
	const dayPoints = buildDayPoints(chartOrders, tz, cal.todayStart);
	const weekPoints = buildDailyPoints(chartOrders, tz, cal.today, 7, {
		weekday: "short",
	});
	const monthPoints = buildDailyPoints(chartOrders, tz, cal.today, 30, {
		month: "short",
		day: "numeric",
	});

	const revenueToday = Number(todaySales._sum.total ?? 0);
	const revenueYesterday = Number(yesterdaySales._sum.total ?? 0);
	const paidOrdersToday = todaySales._count;
	const thirtyDayRevenue = chartOrders.reduce((sum, o) => sum + o.total, 0);
	const averageOrder =
		paidOrdersToday > 0
			? revenueToday / paidOrdersToday
			: chartOrders.length > 0
				? thirtyDayRevenue / chartOrders.length
				: 0;

	const statCards: Array<{
		label: string;
		value: string;
		helper: string;
		change: number | null;
		icon: LucideIcon;
		tone: string;
	}> = [
		{
			label: "Sales today",
			value: formatMoney(revenueToday, restaurant.currency),
			helper: "Paid orders",
			change: percentChange(revenueToday, revenueYesterday),
			icon: TrendingUp,
			tone: "bg-emerald-100 text-emerald-700",
		},
		{
			label: "Orders today",
			value: String(ordersTodayCount),
			helper: "Excluding cancelled",
			change: percentChange(ordersTodayCount, ordersYesterdayCount),
			icon: ClipboardList,
			tone: "bg-yellow-100 text-yellow-600",
		},
		{
			label: "Average order",
			value: formatMoney(averageOrder, restaurant.currency),
			helper: paidOrdersToday > 0 ? "Today" : "Last 30 days",
			change: null,
			icon: Receipt,
			tone: "bg-blue-100 text-blue-600",
		},
		{
			label: "Bookings today",
			value: String(reservationsToday),
			helper: restaurant.tableReservationEnabled
				? "Tables booked"
				: "Reservations are off",
			change: null,
			icon: CalendarDays,
			tone: "bg-purple-100 text-purple-600",
		},
	];

	const base = `/dashboard/${slug}`;
	const attention: Array<{
		count: number;
		label: string;
		href: string;
		icon: LucideIcon;
		urgent?: boolean;
	}> = [
		{
			count: awaitingAcceptance,
			label: `order${awaitingAcceptance === 1 ? "" : "s"} waiting to be accepted`,
			href: `${base}/orders?status=PENDING_APPROVAL`,
			icon: ClipboardList,
			urgent: true,
		},
		{
			count: reservationsToApprove,
			label: `booking request${reservationsToApprove === 1 ? "" : "s"} to approve`,
			href: `${base}/reservations`,
			icon: CalendarDays,
			urgent: true,
		},
		{
			count: ordersNeedingRefund,
			label: `order${ordersNeedingRefund === 1 ? "" : "s"} you need to refund`,
			href: `${base}/orders?refund=1`,
			icon: RotateCcw,
			urgent: true,
		},
		{
			count: reservationsNeedingRefund,
			label: `booking${reservationsNeedingRefund === 1 ? "" : "s"} you need to refund`,
			href: `${base}/reservations`,
			icon: RotateCcw,
			urgent: true,
		},
		{
			count: reservationsAwaitingPayment,
			label: `approved booking${reservationsAwaitingPayment === 1 ? "" : "s"} waiting for the guest to pay`,
			href: `${base}/reservations`,
			icon: CreditCard,
		},
		{
			count: staffWithoutPin,
			label: `staff member${staffWithoutPin === 1 ? "" : "s"} without a PIN (they can't take orders)`,
			href: `${base}/staff`,
			icon: KeyRound,
			urgent: true,
		},
		{
			count: staffLocked,
			label: `staff PIN${staffLocked === 1 ? "" : "s"} locked after wrong attempts`,
			href: `${base}/staff`,
			icon: KeyRound,
		},
	].filter((item) => item.count > 0);

	const cardClass =
		"min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-5 xl:p-6";

	return (
		<section className="grid min-w-0 max-w-full gap-4 overflow-hidden md:gap-5">
			<SetupChecklist
				slug={slug}
				tasks={setupTasks}
				dismissed={Boolean(restaurant.setupChecklistDismissedAt)}
			/>

			{attention.length > 0 ? (
				<div className="min-w-0 rounded-3xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
					<h3 className="flex items-center gap-2 text-sm font-black text-amber-950 sm:text-base">
						<AlertTriangle className="size-4 sm:size-5" aria-hidden="true" />
						Needs your attention
					</h3>
					<ul className="mt-3 grid gap-2 sm:grid-cols-2">
						{attention.map((item) => {
							const Icon = item.icon;
							return (
								<li key={item.label}>
									<Link
										href={item.href}
										className="flex min-h-12 items-center gap-3 rounded-2xl bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm transition-colors hover:bg-amber-50"
									>
										<span
											className={`grid size-8 shrink-0 place-items-center rounded-xl ${
												item.urgent
													? "bg-amber-100 text-amber-800"
													: "bg-slate-100 text-slate-600"
											}`}
										>
											<Icon className="size-4" aria-hidden="true" />
										</span>
										<span className="min-w-0 flex-1">
											<span className="font-black text-slate-950">
												{item.count}
											</span>{" "}
											{item.label}
										</span>
										<ChevronRight
											className="size-4 shrink-0 text-slate-400"
											aria-hidden="true"
										/>
									</Link>
								</li>
							);
						})}
					</ul>
				</div>
			) : null}

			<div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 min-[390px]:gap-3 sm:gap-4 xl:grid-cols-4 xl:gap-5">
				{statCards.map((card) => {
					const Icon = card.icon;
					const changeText = formatChange(card.change);
					return (
						<div
							key={card.label}
							className="min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white p-2.5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] min-[390px]:p-3 sm:rounded-3xl sm:p-5 xl:p-6"
						>
							<div className="flex min-w-0 items-center gap-2 min-[390px]:gap-3 sm:gap-4">
								<div
									className={`grid size-10 shrink-0 place-items-center rounded-full min-[390px]:size-12 sm:size-14 ${card.tone}`}
								>
									<Icon
										className="size-5 min-[390px]:size-6 sm:size-7"
										aria-hidden="true"
									/>
								</div>
								<div className="min-w-0">
									<p className="truncate text-xs font-medium text-slate-500 sm:text-base">
										{card.label}
									</p>
									<p className="mt-0.5 truncate text-lg font-black text-slate-950 sm:text-2xl xl:text-3xl">
										{card.value}
									</p>
									<p className="truncate text-xs font-medium text-slate-500 sm:text-sm">
										{card.helper}
									</p>
								</div>
							</div>
							{changeText ? (
								<p
									className={`mt-3 inline-flex min-h-8 max-w-full items-center rounded-xl px-2 text-xs font-bold sm:mt-4 sm:px-3 sm:text-sm ${
										(card.change ?? 0) > 0
											? "bg-emerald-50 text-emerald-700"
											: (card.change ?? 0) < 0
												? "bg-red-50 text-red-700"
												: "bg-slate-100 text-slate-600"
									}`}
								>
									<span className="truncate">
										{changeText} vs this time yesterday
									</span>
								</p>
							) : null}
						</div>
					);
				})}
			</div>

			<div className="grid min-w-0 gap-5 lg:grid-cols-2">
				<RightNowPanel
					base={base}
					open={openState}
					pipeline={{
						// Confirmed orders are waiting for the kitchen to start.
						pending: pipelineCount(OrderStatus.PENDING_APPROVAL),
						preparing: pipelineCount(
							OrderStatus.CONFIRMED,
							OrderStatus.PREPARING,
						),
						ready: pipelineCount(OrderStatus.READY),
					}}
				/>
				<TodaysBookingsPanel
					base={base}
					timeZone={tz}
					enabled={restaurant.tableReservationEnabled}
					bookings={todaysBookings.map((b) => ({
						id: b.id,
						customerName: b.customerName,
						partySize: b.partySize,
						startsAt: b.startsAt,
						status: b.status,
						table: b.table.label,
					}))}
				/>
			</div>

			<div className="grid min-w-0 gap-5 xl:grid-cols-[1.7fr_1fr]">
				<DashboardSalesChart
					currency={restaurant.currency}
					day={dayPoints}
					week={weekPoints}
					month={monthPoints}
				/>
				<div className={cardClass}>
					<div className="flex min-w-0 items-center justify-between gap-3">
						<div>
							<h3 className="text-sm font-black text-slate-950 sm:text-xl">
								Top sellers
							</h3>
							<p className="text-xs font-medium text-slate-500">Last 30 days</p>
						</div>
						<Link
							href={`${base}/analytics`}
							className="text-xs font-black text-emerald-700 sm:text-sm"
						>
							Analytics
						</Link>
					</div>
					{topSellingItems.length > 0 ? (
						<ol className="mt-4 grid gap-2">
							{topSellingItems.map((item, index) => (
								<li
									key={item.id}
									className="grid min-w-0 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl p-1.5 hover:bg-slate-50"
								>
									<span className="grid size-6 place-items-center rounded-lg bg-yellow-300 text-xs font-black text-emerald-950">
										{index + 1}
									</span>
									{item.imageUrl ? (
										<Image
											src={item.imageUrl}
											alt=""
											width={44}
											height={44}
											className="size-11 rounded-xl object-cover"
										/>
									) : (
										<span className="grid size-11 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
											<Utensils className="size-4" aria-hidden="true" />
										</span>
									)}
									<div className="min-w-0">
										<p className="truncate text-sm font-black text-slate-950">
											{item.name}
										</p>
										<p className="text-xs font-medium text-slate-500">
											{item.qtySold} sold
										</p>
									</div>
									<p className="text-sm font-black text-slate-950">
										{formatMoney(item.price, restaurant.currency)}
									</p>
								</li>
							))}
						</ol>
					) : (
						<div className="mt-5 grid place-items-center rounded-2xl border border-dashed border-slate-200 p-6 text-center">
							<p className="text-xs font-bold text-slate-500 sm:text-sm">
								No orders in the last 30 days. Your best sellers will show up
								here.
							</p>
						</div>
					)}
				</div>
			</div>

			<div className="grid min-w-0 gap-5 xl:grid-cols-[1.1fr_1fr_1fr]">
				<div className={`${cardClass} xl:col-span-2`}>
					<div className="flex min-w-0 items-center justify-between gap-3">
						<h3 className="text-sm font-black text-slate-950 sm:text-xl">
							Recent orders
						</h3>
						<Link
							href={`${base}/orders`}
							className="text-xs font-black text-emerald-700 sm:text-sm"
						>
							View all
						</Link>
					</div>
					{recentOrders.length > 0 ? (
						<div className="mt-3 grid divide-y divide-slate-100">
							{recentOrders.map((order) => {
								const Icon = orderTypeIcon(order.type);
								const code = order.id.slice(-6).toUpperCase();
								return (
									<Link
										key={order.id}
										href={`${base}/orders?q=${code}`}
										className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 py-3"
									>
										<div className="flex min-w-0 items-center gap-3">
											<div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 sm:size-12">
												<Icon className="size-5" aria-hidden="true" />
											</div>
											<div className="min-w-0">
												<p className="truncate font-black text-slate-950">
													#{code}
													<span className="ml-2 font-medium text-slate-500">
														{order.customerName ?? "Guest"}
													</span>
												</p>
												<p className="text-xs font-medium text-slate-500">
													{formatInTimeZone(order.createdAt, tz, {
														day: "numeric",
														month: "short",
														hour: "numeric",
														minute: "2-digit",
													})}
												</p>
											</div>
										</div>
										<div className="grid min-w-0 justify-items-end gap-1">
											<p className="font-black text-slate-950">
												{formatMoney(Number(order.total), restaurant.currency)}
											</p>
											<p
												className={`rounded-lg px-2 py-0.5 text-xs font-black ${statusTone(order.status)}`}
											>
												{getStatusLabel(order.type, order.status)}
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

				<div className={cardClass}>
					<h3 className="text-sm font-black text-slate-950 sm:text-xl">
						Quick actions
					</h3>
					<div className="mt-5 grid grid-cols-2 gap-3">
						{[
							{ label: "Edit menu", icon: Utensils, href: `${base}/menu` },
							{ label: "Orders", icon: ClipboardList, href: `${base}/orders` },
							{
								label: "Reservations",
								icon: CalendarDays,
								href: `${base}/reservations`,
							},
							{ label: "Staff", icon: Users, href: `${base}/staff` },
						].map((action) => {
							const Icon = action.icon;
							return (
								<Link
									key={action.label}
									href={action.href}
									className="grid min-h-24 min-w-0 place-items-center rounded-2xl border border-slate-200 bg-white p-3 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50 sm:text-sm"
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
			<div className="grid min-w-0 gap-5 lg:grid-cols-2">
				<LatestReviewsPanel
					base={base}
					average={rating30._avg.overallRating ?? null}
					reviews={latestReviews.map((r) => ({
						id: r.id,
						rating: r.overallRating,
						comment: r.comment,
						name: r.customerName,
						createdAt: r.createdAt,
					}))}
				/>
				<MenuHealthPanel
					base={base}
					health={{
						published: menuCounts[0],
						noPhoto: menuCounts[1],
						soldOut: menuCounts[2],
						drafts: menuCounts[3],
					}}
				/>
			</div>
		</section>
	);
}
