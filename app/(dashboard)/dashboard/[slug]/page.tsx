import {
	CalendarDays,
	ChevronDown,
	ClipboardList,
	ShoppingBag,
	Users,
	Utensils,
} from "lucide-react";
import { QRDownload } from "@/components/admin/QRDownload";
import { db } from "@/lib/db";
import { getQrScanUrl } from "@/lib/qr";

const statCards = [
	{
		label: "Menu Items",
		value: "0",
		helper: "Active items",
		change: "Ready",
		icon: ShoppingBag,
		tone: "bg-emerald-100 text-emerald-700",
	},
	{
		label: "Orders Today",
		value: "0",
		helper: "Total orders",
		change: "No orders yet",
		icon: ClipboardList,
		tone: "bg-yellow-100 text-yellow-600",
	},
	{
		label: "Reservations",
		value: "0",
		helper: "Upcoming today",
		change: "No bookings",
		icon: CalendarDays,
		tone: "bg-purple-100 text-purple-600",
	},
	{
		label: "Staff Members",
		value: "0",
		helper: "Active staff",
		change: "Set up team",
		icon: Users,
		tone: "bg-blue-100 text-blue-600",
	},
];

const topItems = ["Menu setup", "QR code", "WhatsApp", "Reservations", "Staff"];

const recentOrders = [
	{
		id: "#ORD-0001",
		customer: "No orders yet",
		total: "₦0",
		status: "Pending",
	},
	{
		id: "#ORD-0002",
		customer: "Waiting for customers",
		total: "₦0",
		status: "Pending",
	},
	{
		id: "#ORD-0003",
		customer: "Share your QR menu",
		total: "₦0",
		status: "Pending",
	},
];

const salesPoints = [
	{ label: "12 AM", x: 0, y: 82 },
	{ label: "3 AM", x: 12, y: 80 },
	{ label: "6 AM", x: 24, y: 70 },
	{ label: "9 AM", x: 36, y: 56 },
	{ label: "12 PM", x: 50, y: 42 },
	{ label: "3 PM", x: 64, y: 34 },
	{ label: "6 PM", x: 78, y: 18 },
	{ label: "9 PM", x: 92, y: 26 },
	{ label: "11 PM", x: 100, y: 16 },
];

const salesLine = salesPoints.map((point) => `${point.x},${point.y}`).join(" ");

export default async function DashboardPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const restaurant = await db.restaurant.findUniqueOrThrow({
		where: { slug },
		select: { name: true },
	});
	const qrUrl = getQrScanUrl(slug);

	return (
		<section className="grid min-w-0 max-w-full overflow-hidden gap-4 md:gap-5">
			<div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 md:hidden">
				<div className="min-w-0">
					<p className="text-sm font-medium text-slate-500">Welcome back,</p>
					<h2 className="mt-1 truncate text-xl font-black text-slate-950">
						{restaurant.name}
					</h2>
					<p className="mt-1 truncate text-sm font-medium text-slate-500">
						Here's what's happening today.
					</p>
				</div>
				<button
					type="button"
					className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-2.5 text-xs font-black text-slate-950 shadow-sm min-[390px]:min-h-12 min-[390px]:gap-2 min-[390px]:px-3 min-[390px]:text-sm"
				>
					<CalendarDays
						className="size-4 min-[390px]:size-5"
						aria-hidden="true"
					/>
					<span className="hidden min-[390px]:inline">June 15, 2026</span>
					<span className="min-[390px]:hidden">Jun 15</span>
					<ChevronDown
						className="size-4 min-[390px]:size-5"
						aria-hidden="true"
					/>
				</button>
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
									<p className="truncate text-base font-medium text-slate-500">
										{card.label}
									</p>
									<p className="mt-0.5 text-3xl font-black text-slate-950 xl:text-3xl">
										{card.value}
									</p>
									<p className="truncate text-xs font-medium text-slate-500 sm:text-sm">
										{card.helper}
									</p>
								</div>
							</div>
							<p className="mt-3 inline-flex min-h-8 max-w-full items-center rounded-xl bg-emerald-50 px-2 text-sm font-bold text-emerald-700 sm:mt-5 sm:min-h-9 sm:px-3">
								<span className="truncate">{card.change}</span>
							</p>
						</div>
					);
				})}
			</div>

			<div className="grid min-w-0 gap-5 xl:grid-cols-[1.7fr_1fr]">
				<div className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-5 xl:p-6">
					<div className="grid gap-4 sm:flex sm:items-start sm:justify-between">
						<div>
							<h3 className="text-xl font-black text-slate-950">
								Sales Overview
							</h3>
							<p className="mt-4 text-3xl font-black text-slate-950 xl:text-4xl">
								₦0
							</p>
							<p className="text-sm font-medium text-slate-500">
								Total sales today
							</p>
						</div>
						<div className="grid min-w-0 grid-cols-3 overflow-hidden rounded-xl border border-slate-200 text-xs font-black sm:w-auto sm:text-sm">
							<span className="min-w-0 bg-emerald-700 px-3 py-2 text-center text-white sm:px-4">
								Day
							</span>
							<span className="min-w-0 px-3 py-2 text-center text-slate-600 sm:px-4">
								Week
							</span>
							<span className="min-w-0 px-3 py-2 text-center text-slate-600 sm:px-4">
								Month
							</span>
						</div>
					</div>
					<div className="mt-6 h-40 max-w-full overflow-hidden rounded-2xl bg-emerald-50 p-3 sm:mt-8 sm:h-52 sm:p-4 xl:h-64 xl:p-5">
						<div className="relative h-full">
							<div className="absolute inset-0 grid grid-rows-4">
								{["$2.5k", "$1.5k", "$500", "$0"].map((label) => (
									<div
										key={label}
										className="border-emerald-200/70 border-t text-xs font-bold text-slate-400 first:border-t-0"
									>
										<span>{label}</span>
									</div>
								))}
							</div>
							<svg
								viewBox="0 0 100 100"
								className="absolute inset-x-0 bottom-5 h-[82%] w-full overflow-visible"
								aria-label="Sales trend"
							>
								<defs>
									<linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1">
										<stop offset="0%" stopColor="#059669" stopOpacity="0.22" />
										<stop offset="100%" stopColor="#059669" stopOpacity="0" />
									</linearGradient>
								</defs>
								<polygon
									points={`0,100 ${salesLine} 100,100`}
									fill="url(#salesFill)"
								/>
								<polyline
									points={salesLine}
									fill="none"
									stroke="#059669"
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2.6"
								/>
								{salesPoints.map((point) => (
									<circle
										key={point.label}
										cx={point.x}
										cy={point.y}
										fill="#ffffff"
										r="2.6"
										stroke="#059669"
										strokeWidth="2"
									/>
								))}
							</svg>
							<div className="absolute inset-x-0 bottom-0 grid grid-cols-5 text-xs font-bold text-slate-500">
								{salesPoints
									.filter((_, index) => index % 2 === 0)
									.map((point) => (
										<span key={point.label} className="text-center">
											{point.label}
										</span>
									))}
							</div>
						</div>
					</div>
				</div>

				<div className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-5 xl:p-6">
					<div className="flex min-w-0 items-center justify-between gap-3">
						<h3 className="text-xl font-black text-slate-950">
							Top Selling Items
						</h3>
						<span className="text-sm font-black text-emerald-700">
							View all
						</span>
					</div>
					<div className="mt-5 flex max-w-full gap-4 overflow-x-auto pb-2 xl:grid xl:gap-3 xl:overflow-visible xl:pb-0">
						{topItems.map((item, index) => (
							<div
								key={item}
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
										{item}
									</p>
									<p className="text-xs font-medium text-slate-500">
										No orders yet
									</p>
								</div>
								<p className="mt-1 text-sm font-black text-slate-950 xl:mt-0 xl:text-right">
									₦0
								</p>
							</div>
						))}
					</div>
				</div>
			</div>

			<div className="grid min-w-0 gap-5 xl:grid-cols-[1.1fr_1fr_1fr]">
				<div className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] xl:col-span-2 xl:p-6">
					<div className="flex min-w-0 items-center justify-between gap-3">
						<h3 className="text-xl font-black text-slate-950">Recent Orders</h3>
						<span className="text-sm font-black text-emerald-700">
							View all
						</span>
					</div>
					<div className="mt-5 grid divide-y divide-slate-100">
						{recentOrders.map((order) => (
							<div
								key={order.id}
								className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 py-4"
							>
								<div className="flex min-w-0 items-center gap-3">
									<div className="grid size-12 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
										<ClipboardList className="size-5" aria-hidden="true" />
									</div>
									<div className="min-w-0">
										<p className="truncate font-black text-slate-950">
											{order.id}
										</p>
										<p className="truncate text-sm font-medium text-slate-500">
											{order.customer}
										</p>
									</div>
								</div>
								<div className="min-w-0 text-right">
									<p className="font-black text-slate-950">{order.total}</p>
									<p className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
										{order.status}
									</p>
								</div>
							</div>
						))}
					</div>
				</div>

				<div className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] xl:p-6">
					<h3 className="text-xl font-black text-slate-950">Quick Actions</h3>
					<div className="mt-5 grid grid-cols-2 gap-3">
						{[
							{ label: "Add Menu Item", icon: Utensils },
							{ label: "New Order", icon: ClipboardList },
							{ label: "New Reservation", icon: CalendarDays },
							{ label: "Add Staff", icon: Users },
						].map((action) => {
							const Icon = action.icon;

							return (
								<button
									key={action.label}
									type="button"
									className="grid min-h-24 min-w-0 place-items-center rounded-2xl border border-slate-200 bg-white p-3 text-sm font-black text-slate-700"
								>
									<Icon
										className="size-6 text-emerald-700"
										aria-hidden="true"
									/>
									<span className="text-center">{action.label}</span>
								</button>
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
