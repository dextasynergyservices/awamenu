"use client";

import {
	CalendarCheck,
	CheckCircle2,
	ChefHat,
	ClipboardList,
	CreditCard,
	Eye,
	Package,
	Search,
	Truck,
	UtensilsCrossed,
	X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
	staffApproveReservationAction,
	staffUpdateOrderStatusAction,
} from "@/actions/staff.actions";
import { ReceiptActions } from "@/components/orders/ReceiptActions";
import { SplitPaymentModal } from "@/components/orders/SplitPaymentModal";
import { PinPromptModal } from "@/components/staff/PinPromptModal";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────

export type StaffOrder = {
	id: string;
	type: string;
	status: string;
	customerName: string;
	customerPhone: string | null;
	customerEmail: string | null;
	tableNumber: string | null;
	deliveryAddress: string | null;
	deliveryNotes: string | null;
	total: number;
	subtotal: number;
	paymentStatus: string;
	dineInPaymentPolicy: string | null;
	dineInPaymentMethod: string | null;
	createdAt: string;
	items: Array<{
		id: string;
		name: string;
		qty: number;
		unitPrice: number;
		notes: string | null;
	}>;
	payments: Array<{
		method: string;
		amount: number;
	}>;
};

type StaffReservation = {
	id: string;
	customerName: string;
	customerPhone: string;
	date: string;
	time: string;
	guestCount: number;
	tableLabel: string;
	status: string;
};

type StaffOrderFeedProps = {
	orders: StaffOrder[];
	reservations: StaffReservation[];
	currency: string;
	slug: string;
};

const typeConfig: Record<
	string,
	{ label: string; icon: typeof UtensilsCrossed; color: string }
> = {
	DINE_IN: {
		label: "Dine-in",
		icon: UtensilsCrossed,
		color: "bg-emerald-100 text-emerald-700",
	},
	PICKUP: {
		label: "Pickup",
		icon: Package,
		color: "bg-blue-100 text-blue-700",
	},
	DELIVERY: {
		label: "Delivery",
		icon: Truck,
		color: "bg-orange-100 text-orange-700",
	},
};

const statusFlow: Record<string, string> = {
	PENDING_APPROVAL: "CONFIRMED",
	PENDING_PAYMENT: "CONFIRMED",
	CONFIRMED: "PREPARING",
	PREPARING: "READY",
	READY: "DELIVERED",
};

const statusActionLabel: Record<string, string> = {
	PENDING_APPROVAL: "Accept Order",
	PENDING_PAYMENT: "Accept Order",
	CONFIRMED: "Start Preparing",
	PREPARING: "Mark Ready",
	READY: "Mark Delivered",
};

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

function formatOrderTime(value: string) {
	const date = new Date(value);
	const now = new Date();
	const isToday = date.toDateString() === now.toDateString();
	return `${
		isToday
			? "Today"
			: new Intl.DateTimeFormat("en-NG", {
					month: "short",
					day: "numeric",
				}).format(date)
	}, ${new Intl.DateTimeFormat("en-NG", { hour: "numeric", minute: "2-digit" }).format(date)}`;
}

// ─── Main Component ───────────────────────────────────

export function StaffOrderFeed({
	orders,
	reservations,
	currency,
	slug,
}: StaffOrderFeedProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const initialOrderId = searchParams.get("orderId");
	const [search, setSearch] = useState("");

	const [activeTab, setActiveTab] = useState<
		"PENDING_APPROVAL" | "CONFIRMED" | "PREPARING" | "READY" | "RESERVATIONS"
	>("PENDING_APPROVAL");

	const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
		initialOrderId,
	);
	const [prevOrderIdParam, setPrevOrderIdParam] = useState<string | null>(
		initialOrderId,
	);

	const orderIdParam = searchParams.get("orderId");
	if (orderIdParam !== prevOrderIdParam) {
		setPrevOrderIdParam(orderIdParam);
		if (orderIdParam) {
			setSelectedOrderId(orderIdParam);
			const order = orders.find((o) => o.id === orderIdParam);
			if (
				order &&
				[
					"CONFIRMED",
					"PREPARING",
					"READY",
					"PENDING_APPROVAL",
					"RESERVATIONS",
				].includes(order.status)
			) {
				setActiveTab(order.status as typeof activeTab);
			}
		} else {
			setSelectedOrderId(null);
		}
	}

	function handleCloseModal() {
		setSelectedOrderId(null);
		if (searchParams.has("orderId")) {
			const newParams = new URLSearchParams(searchParams.toString());
			newParams.delete("orderId");
			router.replace(`?${newParams.toString()}`, { scroll: false });
		}
	}

	const selectedOrder = selectedOrderId
		? (orders.find((order) => order.id === selectedOrderId) ?? null)
		: null;

	useEffect(() => {
		const interval = setInterval(() => router.refresh(), 5_000);
		return () => clearInterval(interval);
	}, [router]);

	const filteredOrders = search.trim()
		? orders.filter(
				(o) =>
					o.id.slice(-6).toUpperCase().includes(search.toUpperCase()) ||
					o.customerName.toLowerCase().includes(search.toLowerCase()) ||
					(o.customerPhone?.toLowerCase().includes(search.toLowerCase()) ??
						false) ||
					(o.tableNumber?.toLowerCase().includes(search.toLowerCase()) ??
						false),
			)
		: orders;

	const counts = {
		PENDING_APPROVAL: filteredOrders.filter(
			(o) => o.status === "PENDING_APPROVAL",
		).length,
		CONFIRMED: filteredOrders.filter((o) => o.status === "CONFIRMED").length,
		PREPARING: filteredOrders.filter((o) => o.status === "PREPARING").length,
		READY: filteredOrders.filter((o) => o.status === "READY").length,
		PENDING_PAYMENT: filteredOrders.filter(
			(o) => o.status === "PENDING_PAYMENT",
		).length,
	};

	const showReservationsTab = reservations.length > 0;
	const activeOrders = filteredOrders.filter((o) => o.status === activeTab);

	const tabs = [
		{
			id: "PENDING_APPROVAL",
			label: "New Orders",
			icon: ClipboardList,
			count: counts.PENDING_APPROVAL,
		},
		{
			id: "CONFIRMED",
			label: "Confirmed",
			icon: CheckCircle2,
			count: counts.CONFIRMED,
		},
		{
			id: "PREPARING",
			label: "Preparing",
			icon: ChefHat,
			count: counts.PREPARING,
		},
		{ id: "READY", label: "Ready", icon: Package, count: counts.READY },
	] as const;

	return (
		<div className="grid gap-4 pt-1">
			{/* Header area */}
			<div className="flex items-center justify-between gap-3">
				<div>
					<h1 className="text-xl font-black text-slate-950 md:text-2xl">
						Orders
					</h1>
					<p className="hidden text-sm font-semibold text-slate-500 md:block">
						Track and manage all incoming orders in real time
					</p>
				</div>
				<div className="relative w-full max-w-[180px] md:max-w-xs">
					<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
					<input
						type="search"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Search..."
						className="min-h-10 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-9 text-sm font-medium text-slate-950 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
					/>
				</div>
			</div>

			{/* Tabs — horizontally scrollable on mobile */}
			<div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
				<div className="flex min-w-max items-center gap-1 border-b border-slate-200 pb-px md:gap-4">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							type="button"
							onClick={() => setActiveTab(tab.id as typeof activeTab)}
							className={cn(
								"flex items-center gap-1.5 border-b-2 py-2.5 px-2 text-xs font-black transition-colors md:gap-2 md:px-1 md:text-sm",
								activeTab === tab.id
									? "border-emerald-700 text-emerald-700"
									: "border-transparent text-slate-500 hover:text-slate-700",
							)}
						>
							<tab.icon className="size-3.5 md:size-4" />
							{tab.label}
							<span
								className={cn(
									"rounded-md px-1.5 py-0.5 text-[10px] font-black md:text-xs",
									activeTab === tab.id
										? "bg-emerald-100 text-emerald-700"
										: "bg-slate-100 text-slate-600",
								)}
							>
								{tab.count}
							</span>
						</button>
					))}
					{showReservationsTab && (
						<button
							type="button"
							onClick={() => setActiveTab("RESERVATIONS")}
							className={cn(
								"flex items-center gap-1.5 border-b-2 py-2.5 px-2 text-xs font-black transition-colors md:gap-2 md:px-1 md:text-sm",
								activeTab === "RESERVATIONS"
									? "border-emerald-700 text-emerald-700"
									: "border-transparent text-slate-500 hover:text-slate-700",
							)}
						>
							<CalendarCheck className="size-3.5 md:size-4" />
							Reservations
							<span
								className={cn(
									"rounded-md px-1.5 py-0.5 text-[10px] font-black md:text-xs",
									activeTab === "RESERVATIONS"
										? "bg-emerald-100 text-emerald-700"
										: "bg-slate-100 text-slate-600",
								)}
							>
								{reservations.length}
							</span>
						</button>
					)}
				</div>
			</div>

			{/* Content */}
			{activeTab === "RESERVATIONS" ? (
				<div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
					<ReservationsTable reservations={reservations} slug={slug} />
				</div>
			) : activeOrders.length === 0 ? (
				<div className="rounded-2xl border border-slate-100 bg-white p-12 text-center text-sm font-medium text-slate-500 shadow-sm">
					No orders in this category.
				</div>
			) : (
				<>
					{/* Mobile: card list */}
					<div className="grid gap-3 md:hidden">
						{activeOrders.map((order) => (
							<StaffOrderCard
								key={order.id}
								order={order}
								currency={currency}
								onView={() => setSelectedOrderId(order.id)}
							/>
						))}
					</div>
					{/* Desktop: table */}
					<div className="hidden md:block rounded-2xl border border-slate-100 bg-white shadow-sm">
						<div className="overflow-x-auto p-5">
							<table className="w-full min-w-[700px] text-left text-sm">
								<thead>
									<tr className="border-b border-slate-100 text-xs font-semibold text-slate-500">
										<th className="pb-3 font-medium">Order</th>
										<th className="pb-3 font-medium">Customer / Table</th>
										<th className="pb-3 font-medium">Items</th>
										<th className="pb-3 font-medium">Amount</th>
										<th className="pb-3 font-medium">Time</th>
										<th className="pb-3 text-right font-medium">Actions</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100">
									{activeOrders.map((order) => (
										<StaffOrderTableRow
											key={order.id}
											order={order}
											currency={currency}
											onView={() => setSelectedOrderId(order.id)}
										/>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</>
			)}

			{selectedOrder && (
				<StaffOrderDetailsModal
					order={selectedOrder}
					currency={currency}
					slug={slug}
					onClose={handleCloseModal}
				/>
			)}
		</div>
	);
}

// ─── Order Card (Mobile) ──────────────────────────────

function StaffOrderCard({
	order,
	currency,
	onView,
}: {
	order: StaffOrder;
	currency: string;
	onView: () => void;
}) {
	const config = typeConfig[order.type] ?? typeConfig.DINE_IN;
	const TypeIcon = config.icon;
	const isPaid = order.paymentStatus === "PAID";
	const nextLabel = statusActionLabel[order.status];
	const mainItem = order.items[0];
	const itemsDesc = mainItem
		? order.items.length > 1
			? `${mainItem.name} + ${order.items.length - 1} more`
			: mainItem.name
		: "";

	return (
		<button
			type="button"
			onClick={onView}
			className="w-full text-left rounded-2xl border border-slate-100 bg-white p-4 shadow-sm active:bg-slate-50 transition-colors"
		>
			{/* Top row: order id + badge + time */}
			<div className="flex items-start justify-between gap-2 mb-3">
				<div className="flex items-center gap-2 flex-wrap">
					<span className="text-base font-black text-slate-950">
						#{order.id.slice(-6).toUpperCase()}
					</span>
					<span
						className={cn(
							"inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black",
							config.color,
						)}
					>
						<TypeIcon className="size-3" />
						{config.label}
					</span>
					<span
						className={cn(
							"inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-black",
							isPaid
								? "bg-emerald-50 text-emerald-700"
								: "bg-amber-50 text-amber-700",
						)}
					>
						{isPaid ? "Paid" : "Unpaid"}
					</span>
				</div>
				<span className="shrink-0 text-xs font-semibold text-slate-400">
					{new Date(order.createdAt).toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit",
					})}
				</span>
			</div>

			{/* Customer + items row */}
			<div className="flex items-center justify-between gap-2">
				<div className="min-w-0">
					<p className="text-sm font-bold text-slate-900 truncate">
						{order.customerName}
					</p>
					<p className="text-xs font-medium text-slate-500 truncate">
						{order.tableNumber
							? `Table ${order.tableNumber}`
							: order.customerPhone || "Walk-in"}{" "}
						· {itemsDesc}
					</p>
				</div>
				<div className="shrink-0 text-right">
					<p className="text-sm font-black text-slate-950">
						{formatMoney(order.total, currency)}
					</p>
					{nextLabel && (
						<span className="text-[10px] font-bold text-emerald-600">
							{nextLabel} →
						</span>
					)}
				</div>
			</div>
		</button>
	);
}

// ─── Order Table Row ──────────────────────────────────

function StaffOrderTableRow({
	order,
	currency,
	onView,
}: {
	order: StaffOrder;
	currency: string;
	onView: () => void;
}) {
	const config = typeConfig[order.type] ?? typeConfig.DINE_IN;
	const TypeIcon = config.icon;
	const isPaid = order.paymentStatus === "PAID";

	const mainItem = order.items[0];
	const itemsDesc = mainItem
		? order.items.length > 1
			? `${mainItem.name} + ${order.items.length - 1} more`
			: mainItem.name
		: "";

	return (
		<tr className="group transition-colors hover:bg-slate-50/50">
			<td className="py-4 pr-4">
				<div className="font-black text-slate-950">
					#{order.id.slice(-6).toUpperCase()}
				</div>
				<div className="mt-1 flex items-center gap-1.5">
					<span
						className={cn(
							"inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black",
							config.color,
						)}
					>
						<TypeIcon className="size-3" />
						{config.label}
					</span>
					<span
						className={cn(
							"inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-black",
							isPaid
								? "bg-emerald-50 text-emerald-700"
								: "bg-amber-50 text-amber-700",
						)}
					>
						{isPaid ? "Paid" : "Unpaid"}
					</span>
				</div>
			</td>
			<td className="py-4 pr-4">
				<div className="font-semibold text-slate-900">{order.customerName}</div>
				<div className="text-xs font-medium text-slate-500">
					{order.tableNumber
						? `Table ${order.tableNumber}`
						: order.customerPhone || "Walk-in"}
				</div>
			</td>
			<td className="py-4 pr-4">
				<div className="font-semibold text-slate-900">
					{order.items.length} item{order.items.length !== 1 ? "s" : ""}
				</div>
				<div className="truncate text-xs font-medium text-slate-500 max-w-[150px]">
					{itemsDesc}
				</div>
			</td>
			<td className="py-4 pr-4 font-black text-slate-950">
				{formatMoney(order.total, currency)}
			</td>
			<td className="py-4 pr-4">
				<div className="font-semibold text-slate-700">
					{new Date(order.createdAt).toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit",
					})}
				</div>
				<div className="text-xs font-medium text-slate-500">
					{new Date(order.createdAt).toDateString() ===
					new Date().toDateString()
						? "Today"
						: new Date(order.createdAt).toLocaleDateString()}
				</div>
			</td>
			<td className="py-4 text-right">
				<div className="flex items-center justify-end gap-2">
					<button
						type="button"
						onClick={onView}
						className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50"
					>
						<Eye className="size-4" />
						View Details
					</button>
				</div>
			</td>
		</tr>
	);
}

// ─── Reservations Table ───────────────────────────────

function ReservationsTable({
	reservations,
	slug,
}: {
	reservations: StaffReservation[];
	slug: string;
}) {
	if (reservations.length === 0) {
		return (
			<div className="py-12 text-center text-sm font-medium text-slate-500">
				No pending reservations.
			</div>
		);
	}

	return (
		<>
			{/* Mobile: reservation cards */}
			<div className="grid gap-3 p-4 md:hidden">
				{reservations.map((res) => (
					<div
						key={res.id}
						className="rounded-xl border border-slate-100 bg-slate-50 p-4"
					>
						<div className="flex items-start justify-between mb-3">
							<div>
								<p className="text-sm font-black text-slate-950">
									{res.tableLabel}
								</p>
								<p className="text-xs font-semibold text-slate-500">
									{res.customerName} · {res.customerPhone}
								</p>
							</div>
							<div className="text-right">
								<p className="text-xs font-bold text-slate-700">
									{new Date(res.date).toLocaleDateString()}
								</p>
								<p className="text-xs font-semibold text-slate-500">
									{res.time} · {res.guestCount} guests
								</p>
							</div>
						</div>
						<ReservationAction res={res} slug={slug} />
					</div>
				))}
			</div>
			{/* Desktop: table */}
			<div className="hidden md:block overflow-x-auto p-5">
				<table className="w-full min-w-[600px] text-left text-sm">
					<thead>
						<tr className="border-b border-slate-100 text-xs font-semibold text-slate-500">
							<th className="pb-3 font-medium">Table</th>
							<th className="pb-3 font-medium">Customer</th>
							<th className="pb-3 font-medium">Date &amp; Time</th>
							<th className="pb-3 font-medium">Guests</th>
							<th className="pb-3 text-right font-medium">Actions</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{reservations.map((res) => (
							<tr
								key={res.id}
								className="group transition-colors hover:bg-slate-50/50"
							>
								<td className="py-4 pr-4 font-black text-slate-950">
									{res.tableLabel}
								</td>
								<td className="py-4 pr-4">
									<div className="font-semibold text-slate-900">
										{res.customerName}
									</div>
									<div className="text-xs font-medium text-slate-500">
										{res.customerPhone}
									</div>
								</td>
								<td className="py-4 pr-4">
									<div className="font-semibold text-slate-900">
										{new Date(res.date).toLocaleDateString()}
									</div>
									<div className="text-xs font-medium text-slate-500">
										{res.time}
									</div>
								</td>
								<td className="py-4 pr-4 font-semibold text-slate-700">
									{res.guestCount}
								</td>
								<td className="py-4 text-right">
									<ReservationAction res={res} slug={slug} />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</>
	);
}

function ReservationAction({
	res,
	slug,
}: {
	res: StaffReservation;
	slug: string;
}) {
	const router = useRouter();
	const [promptingPin, setPromptingPin] = useState(false);
	const [isPending, startTransition] = useTransition();

	function handleApprove(staffId: string) {
		setPromptingPin(false);
		const fd = new FormData();
		fd.set("reservationId", res.id);
		fd.set("slug", slug);
		fd.set("staffId", staffId);
		startTransition(async () => {
			try {
				const result = await staffApproveReservationAction(fd);
				if ("error" in result) throw new Error(result.error);
				router.refresh();
			} catch (err) {
				alert(
					err instanceof Error ? err.message : "Error approving reservation",
				);
			}
		});
	}

	return (
		<>
			<div className="flex items-center justify-end gap-2">
				<button
					type="button"
					onClick={() => setPromptingPin(true)}
					disabled={isPending}
					className="inline-flex min-h-9 items-center rounded-lg bg-emerald-700 px-4 text-xs font-black text-white hover:bg-emerald-800 disabled:opacity-50"
				>
					{isPending ? "Approving..." : "Approve"}
				</button>
			</div>
			{promptingPin ? (
				<PinPromptModal
					onPinEnter={handleApprove}
					onClose={() => setPromptingPin(false)}
				/>
			) : null}
		</>
	);
}

// ─── Order Details Side Modal ─────────────────────────

function StaffOrderDetailsModal({
	order,
	currency,
	slug,
	onClose,
}: {
	order: StaffOrder;
	currency: string;
	slug: string;
	onClose: () => void;
}) {
	const router = useRouter();
	const [promptingPin, setPromptingPin] = useState(false);
	const [error, setError] = useState("");
	const [isPending, startTransition] = useTransition();
	const [paymentOpen, setPaymentOpen] = useState(false);

	const config = typeConfig[order.type] ?? typeConfig.DINE_IN;
	const isPaid = order.paymentStatus === "PAID";
	const nextStatus = statusFlow[order.status];
	const nextLabel = statusActionLabel[order.status];
	const canRecordPayment = !isPaid && order.type === "DINE_IN";

	function handleActionClick() {
		if (!nextStatus) return;
		setPromptingPin(true);
	}

	function submitAction(staffId: string) {
		setPromptingPin(false);
		setError("");
		const fd = new FormData();
		fd.set("orderId", order.id);
		fd.set("status", nextStatus);
		fd.set("slug", slug);
		fd.set("staffId", staffId);
		startTransition(async () => {
			try {
				const result = await staffUpdateOrderStatusAction(fd);
				if ("error" in result) throw new Error(result.error);
				router.refresh();
				onClose();
			} catch (err) {
				setError(err instanceof Error ? err.message : "Error updating order");
			}
		});
	}

	return (
		<>
			<div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/40 backdrop-blur-sm sm:p-4">
				{/* Close overlay */}
				<button
					type="button"
					className="absolute inset-0 w-full h-full cursor-default"
					onClick={onClose}
					aria-label="Close"
				/>

				<div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-300 rounded-t-2xl sm:rounded-2xl max-h-[90vh]">
					{/* Header */}
					<div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5 md:p-4">
						<h2 className="text-sm font-black text-slate-950 md:text-base">
							Order Details
						</h2>
						<button
							type="button"
							onClick={onClose}
							className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
						>
							<X className="size-4" />
						</button>
					</div>

					{/* Content */}
					<div className="flex-1 overflow-y-auto px-3 py-3 md:p-4">
						<div className="mb-5">
							<div className="flex items-center gap-1.5 mb-1">
								<span className="text-sm font-black text-slate-950 md:text-base">
									#{order.id.slice(-6).toUpperCase()}
								</span>
								<span
									className={cn(
										"inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black",
										config.color,
									)}
								>
									<config.icon className="size-3" />
									{config.label}
								</span>
								<span
									className={cn(
										"inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-black",
										isPaid
											? "bg-emerald-50 text-emerald-700"
											: "bg-amber-50 text-amber-700",
									)}
								>
									{isPaid ? "Paid" : "Unpaid"}
								</span>
							</div>
							<p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider md:text-xs">
								{order.customerName} •{" "}
								{order.tableNumber
									? `Table ${order.tableNumber}`
									: order.customerPhone}
							</p>
						</div>

						<div className="mb-6">
							<h3 className="text-xs font-black text-slate-950 mb-2 md:text-sm md:mb-3">
								Items
							</h3>
							<div className="grid gap-2 md:gap-3">
								{order.items.map((item) => (
									<div
										key={item.id}
										className="flex justify-between text-xs md:text-sm"
									>
										<div className="font-semibold text-slate-700 min-w-0">
											<span className="font-black text-slate-950 mr-2 shrink-0">
												{item.qty}x
											</span>
											<span className="break-words">{item.name}</span>
											{item.notes && (
												<div className="text-xs text-slate-400 mt-0.5 ml-6 break-words">
													{item.notes}
												</div>
											)}
										</div>
										<div className="font-black text-slate-900 shrink-0 ml-2">
											{formatMoney(item.unitPrice * item.qty, currency)}
										</div>
									</div>
								))}
							</div>
						</div>

						<div className="mb-5 border-t border-slate-100 pt-3">
							<div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1.5 md:text-xs md:mb-2">
								<span>Subtotal</span>
								<span>{formatMoney(order.subtotal, currency)}</span>
							</div>
							<div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1.5 md:text-xs md:mb-2">
								<span>Delivery Fee</span>
								<span>
									{order.total > order.subtotal
										? formatMoney(order.total - order.subtotal, currency)
										: "NO"}
								</span>
							</div>
							<div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-2 md:text-xs md:mb-3">
								<span>Discount</span>
								<span>NO</span>
							</div>
							<div className="flex justify-between text-xs font-black text-slate-950 md:text-sm">
								<span>Total</span>
								<span>{formatMoney(order.total, currency)}</span>
							</div>
						</div>

						<div className="border-t border-slate-100 pt-3">
							<h3 className="text-[11px] font-black text-slate-950 mb-1.5 md:text-xs md:mb-2">
								Order Information
							</h3>
							<div className="grid gap-1.5 text-[11px] md:gap-2 md:text-xs">
								<div className="flex justify-between">
									<span className="font-semibold text-slate-500">
										Order Time
									</span>
									<span className="font-black text-slate-700">
										{formatOrderTime(order.createdAt)}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="font-semibold text-slate-500">
										Payment Method
									</span>
									<span className="font-black text-slate-700">
										{order.dineInPaymentMethod ||
											(isPaid ? "Online" : "Cash / Transfer")}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="font-semibold text-slate-500">
										Customer Phone
									</span>
									<span className="font-black text-slate-700">
										{order.customerPhone || "N/A"}
									</span>
								</div>
								{order.deliveryAddress && (
									<div className="flex justify-between gap-2">
										<span className="font-semibold text-slate-500 shrink-0">
											Delivery Address
										</span>
										<span className="font-black text-slate-700 text-right max-w-[60%] break-words">
											{order.deliveryAddress}
										</span>
									</div>
								)}
							</div>
							{order.deliveryNotes && (
								<div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 p-3">
									<p className="text-xs font-black text-amber-700 mb-1">
										Order Note
									</p>
									<p className="text-sm font-semibold text-amber-900 break-words">
										{order.deliveryNotes}
									</p>
								</div>
							)}
						</div>

						<div className="px-3 md:px-4 pb-2">
							<ReceiptActions
								size="sm"
								hideDownload
								hideShare
								receipt={{
									orderId: order.id,
									orderCode: `#${order.id.slice(-6).toUpperCase()}`,
									restaurantName: "Receipt", // Using generic name for staff print since restaurantName is not directly accessible here unless passed down
									customerName: order.customerName,
									status: order.status,
									paymentStatus: order.paymentStatus,
									orderType: order.type,
									total: order.total,
									currency: currency,
									createdAt: order.createdAt,
									items: order.items.map((i) => ({
										name: i.name,
										qty: i.qty,
										unitPrice: i.unitPrice,
										notes: i.notes,
									})),
								}}
							/>
						</div>
					</div>

					{/* Footer */}
					<div className="border-t border-slate-100 p-2.5 md:p-3 flex flex-col gap-1.5 bg-white">
						{error && (
							<p className="text-[10px] font-bold text-red-600">{error}</p>
						)}
						{nextLabel && (
							<button
								type="button"
								onClick={handleActionClick}
								disabled={isPending}
								className="h-8 w-full rounded-md bg-emerald-700 text-[11px] font-black text-white hover:bg-emerald-800 transition-colors disabled:opacity-50"
							>
								{isPending ? "Updating..." : nextLabel}
							</button>
						)}
						{canRecordPayment && (
							<button
								type="button"
								onClick={() => setPaymentOpen(true)}
								className="h-8 w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 text-[11px] font-black text-emerald-700 hover:bg-emerald-100 transition-colors"
							>
								<CreditCard className="size-3" />
								Record Payment
							</button>
						)}
						<button
							type="button"
							onClick={onClose}
							className="h-8 w-full rounded-md border border-slate-200 bg-white text-[11px] font-black text-slate-700 hover:bg-slate-50 transition-colors"
						>
							Close Details
						</button>
					</div>
				</div>
			</div>

			{/* Payment Modal */}
			{paymentOpen && (
				<SplitPaymentModal
					isOpen={paymentOpen}
					orderId={order.id}
					total={Number(order.total)}
					currency={currency}
					slug={slug}
					requirePin={true}
					onClose={() => {
						setPaymentOpen(false);
						onClose();
					}}
				/>
			)}
			{promptingPin ? (
				<PinPromptModal
					onPinEnter={submitAction}
					onClose={() => setPromptingPin(false)}
				/>
			) : null}
		</>
	);
}
