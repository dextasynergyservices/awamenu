"use client";

import {
	Check,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	ClipboardList,
	Clock,
	EllipsisVertical,
	FileText,
	Phone,
	Search,
	SlidersHorizontal,
	Truck,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AdminOrderControls } from "@/components/orders/AdminOrderControls";
import { OrderActionForm } from "@/components/orders/OrderActionForm";
import {
	type OrderEventDTO,
	OrderTimelineModal,
} from "@/components/orders/OrderTimeline";
import { ReceiptActions } from "@/components/orders/ReceiptActions";
import { SubmitButton } from "@/components/ui/action-button";
import { getStatusFlow } from "@/lib/order-status-flow";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────

type OrderItem = {
	id: string;
	name: string;
	qty: number;
	unitPrice: string | number;
	notes: string | null;
};

type Order = {
	id: string;
	customerName: string;
	customerPhone: string;
	customerEmail: string | null;
	type: string;
	status: string;
	cancellationNote: string | null;
	paymentStatus: string;
	tableNumber: string | null;
	tableLabel: string | null;
	orderFor?: string | null;
	senderPhone?: string | null;
	receiverPhone?: string | null;
	senderTableNumber?: string | null;
	deliveryAddress: string | null;
	deliveryNotes: string | null;
	dineInPaymentPolicy: string | null;
	dineInPaymentMethod: string | null;
	dineInServiceMode: string | null;
	waiterName: string | null;
	total: string | number;
	createdAt: string;
	items: OrderItem[];
	payments: Array<{
		amount: string | number;
		method: string;
	}>;
	events: OrderEventDTO[];
	attendingStaff: { name: string; staffId: string | null } | null;
};

type MobileOrdersViewProps = {
	orders: Order[];
	currency: string;
	slug: string;
	restaurantName: string;
	whatsappEnabled: boolean;
};

// ─── Helpers ──────────────────────────────────────────

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

function timeAgo(dateStr: string) {
	const now = Date.now();
	const then = new Date(dateStr).getTime();
	const diffSec = Math.floor((now - then) / 1000);
	if (diffSec < 60) return "a few seconds ago";
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;
	const diffDay = Math.floor(diffHr / 24);
	return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

// ─── Status stepper config ────────────────────────────

function getStatusSteps(type: string) {
	return getStatusFlow(type) as readonly string[];
}

function getStepIndex(status: string, type: string) {
	const steps = getStatusSteps(type);
	const idx = (steps as readonly string[]).indexOf(status);
	return idx === -1 ? -1 : idx;
}

function getNextStatus(status: string, type: string) {
	if (status === "PENDING_APPROVAL" || status === "PENDING_PAYMENT")
		return "CONFIRMED";
	if (status === "CONFIRMED") return "PREPARING";
	if (status === "PREPARING") return "READY";
	if (status === "READY") {
		return type === "DELIVERY" || type === "PICKUP" ? "DELIVERED" : "COMPLETED";
	}
	if (status === "DELIVERED") return "COMPLETED";
	return null;
}

function getNextStatusLabel(status: string, type: string) {
	const next = getNextStatus(status, type);
	if (!next) return null;
	if (status === "PENDING_APPROVAL" || status === "PENDING_PAYMENT")
		return "Accept order";
	if (next === "PREPARING") return "Preparing";
	if (next === "READY") return "Ready";
	if (next === "DELIVERED")
		return type === "PICKUP" ? "Collected" : "Delivered";
	if (next === "COMPLETED") return "Complete";
	return next.charAt(0) + next.slice(1).toLowerCase();
}

function orderStatusLabel(
	order: Pick<Order, "status" | "cancellationNote" | "type">,
) {
	if (order.status === "CANCELLED" && order.cancellationNote) return "DECLINED";
	if (order.type === "PICKUP" && order.status === "DELIVERED")
		return "COLLECTED";
	return order.status.replaceAll("_", " ");
}

// ─── Pagination ───────────────────────────────────────

const ORDERS_PER_PAGE = 10;

// ─── Component ────────────────────────────────────────

export function MobileOrdersView({
	orders,
	currency,
	slug,
	restaurantName,
	whatsappEnabled,
}: MobileOrdersViewProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [activeFilter, setActiveFilter] = useState<string>("ALL");
	const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
	const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
	const [menuOrderId, setMenuOrderId] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(0);
	const selectedOrder = selectedOrderId
		? (orders.find((order) => order.id === selectedOrderId) ?? null)
		: null;

	// ─── Derived counts ───────────────────────────────
	const counts = useMemo(() => {
		const c = { all: orders.length, preparing: 0, onTheWay: 0, completed: 0 };
		for (const o of orders) {
			if (o.status === "PREPARING") c.preparing++;
			else if (o.status === "READY" || o.status === "DELIVERED") c.onTheWay++;
			else if (o.status === "COMPLETED") c.completed++;
		}
		return c;
	}, [orders]);

	// ─── Filtered + searched orders ───────────────────
	const filtered = useMemo(() => {
		let list = orders;

		// filter by status
		if (activeFilter === "PREPARING")
			list = list.filter((o) => o.status === "PREPARING");
		else if (activeFilter === "ON_THE_WAY")
			list = list.filter(
				(o) => o.status === "READY" || o.status === "DELIVERED",
			);
		else if (activeFilter === "COMPLETED")
			list = list.filter((o) => o.status === "COMPLETED");

		// search
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(o) =>
					o.id.toLowerCase().includes(q) ||
					o.customerName.toLowerCase().includes(q) ||
					o.customerPhone.includes(q) ||
					(o.customerEmail?.toLowerCase().includes(q) ?? false),
			);
		}

		// sort
		if (sortOrder === "oldest") list = [...list].reverse();

		return list;
	}, [orders, activeFilter, searchQuery, sortOrder]);

	// ─── Pagination derived values ───────────────────
	const totalPages = Math.max(1, Math.ceil(filtered.length / ORDERS_PER_PAGE));
	const paginatedOrders = filtered.slice(
		currentPage * ORDERS_PER_PAGE,
		currentPage * ORDERS_PER_PAGE + ORDERS_PER_PAGE,
	);

	return (
		<>
			{/* ── Search ─────────────────────────────────── */}
			<div className="flex min-w-0 items-center gap-2">
				<div className="relative min-w-0 flex-1">
					<Search
						className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400"
						aria-hidden="true"
					/>
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => {
							setSearchQuery(e.target.value);
							setCurrentPage(0);
						}}
						placeholder="Search orders by ID, customer, phone, email..."
						className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-base font-medium text-slate-700 placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-100"
					/>
				</div>
				<button
					type="button"
					className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600"
				>
					<SlidersHorizontal className="size-3.5" aria-hidden="true" />
					Filters
				</button>
			</div>

			{/* ── Filter pills ───────────────────────────── */}
			<div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
				{[
					{
						key: "ALL",
						label: "All Orders",
						count: counts.all,
						icon: <ClipboardList className="size-3.5" />,
						colors: "bg-slate-50 text-slate-700 border-slate-200",
						activeColors: "bg-emerald-50 text-emerald-700 border-emerald-200",
					},
					{
						key: "PREPARING",
						label: "Preparing",
						count: counts.preparing,
						icon: <Clock className="size-3.5" />,
						colors: "bg-slate-50 text-slate-700 border-slate-200",
						activeColors: "bg-amber-50 text-amber-700 border-amber-200",
					},
					{
						key: "ON_THE_WAY",
						label: "On the Way",
						count: counts.onTheWay,
						icon: <Truck className="size-3.5" />,
						colors: "bg-slate-50 text-slate-700 border-slate-200",
						activeColors: "bg-blue-50 text-blue-700 border-blue-200",
					},
					{
						key: "COMPLETED",
						label: "Completed",
						count: counts.completed,
						icon: <Check className="size-3.5" />,
						colors: "bg-slate-50 text-slate-700 border-slate-200",
						activeColors: "bg-emerald-50 text-emerald-700 border-emerald-200",
					},
				].map((pill) => (
					<button
						key={pill.key}
						type="button"
						onClick={() => {
							setActiveFilter(pill.key);
							setCurrentPage(0);
						}}
						className={cn(
							"flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors",
							activeFilter === pill.key ? pill.activeColors : pill.colors,
						)}
					>
						{pill.icon}
						<span className="font-black">{pill.count}</span>
						<span>{pill.label}</span>
					</button>
				))}
			</div>

			{/* ── Section header ─────────────────────────── */}
			<div className="flex items-center justify-between">
				<p className="text-sm font-black text-slate-950">Active Orders</p>
				<button
					type="button"
					onClick={() => {
						setSortOrder((s) => (s === "newest" ? "oldest" : "newest"));
						setCurrentPage(0);
					}}
					className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-600"
				>
					{sortOrder === "newest" ? "Newest First" : "Oldest First"}
					<ChevronDown className="size-3" aria-hidden="true" />
				</button>
			</div>

			{/* ── Order cards ────────────────────────────── */}
			{filtered.length > 0 ? (
				<div className="grid gap-3">
					{paginatedOrders.map((order) => (
						<OrderCard
							key={order.id}
							order={order}
							currency={currency}
							slug={slug}
							onViewDetails={() => setSelectedOrderId(order.id)}
							menuOpen={menuOrderId === order.id}
							onToggleMenu={() =>
								setMenuOrderId((prev) => (prev === order.id ? null : order.id))
							}
							onCloseMenu={() => setMenuOrderId(null)}
						/>
					))}
				</div>
			) : (
				<div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
					<p className="text-sm font-black text-slate-950">No orders found</p>
				</div>
			)}

			{/* ── Pagination ─────────────────────────────── */}
			{totalPages > 1 ? (
				<div className="flex items-center justify-between gap-3 pt-2">
					<button
						type="button"
						onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
						disabled={currentPage === 0}
						className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-40"
					>
						<ChevronLeft className="size-3.5" aria-hidden="true" />
						Previous
					</button>
					<p className="text-xs font-semibold text-slate-500">
						Page {currentPage + 1} of {totalPages}
					</p>
					<button
						type="button"
						onClick={() =>
							setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
						}
						disabled={currentPage >= totalPages - 1}
						className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-40"
					>
						Next
						<ChevronRight className="size-3.5" aria-hidden="true" />
					</button>
				</div>
			) : null}

			{/* ── Order detail modal ─────────────────────── */}
			{selectedOrder ? (
				<OrderDetailModal
					order={selectedOrder}
					currency={currency}
					slug={slug}
					restaurantName={restaurantName}
					whatsappEnabled={whatsappEnabled}
					onClose={() => setSelectedOrderId(null)}
				/>
			) : null}
		</>
	);
}

// ─── Order Card ───────────────────────────────────────

function OrderCard({
	order,
	currency,
	slug,
	onViewDetails,
	menuOpen,
	onToggleMenu,
	onCloseMenu,
}: {
	order: Order;
	currency: string;
	slug: string;
	onViewDetails: () => void;
	menuOpen: boolean;
	onToggleMenu: () => void;
	onCloseMenu: () => void;
}) {
	const steps = getStatusSteps(order.type);
	const currentStep = getStepIndex(order.status, order.type);
	// "Pay before service" means the kitchen doesn't start until the money is

	// in, so acceptance is held rather than failing on submit.

	const blockedOnPayment =
		order.status === "PENDING_APPROVAL" &&
		order.type === "DINE_IN" &&
		order.dineInPaymentPolicy === "PAY_BEFORE_SERVICE" &&
		order.paymentStatus !== "PAID";

	const nextStatusLabel = getNextStatusLabel(order.status, order.type);
	const nextStatus = getNextStatus(order.status, order.type);

	return (
		<article className="relative min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_4px_20px_rgba(15,23,42,0.04)]">
			{/* Top row: ID + badges + 3-dot */}
			<div className="flex min-w-0 items-start justify-between gap-2">
				<div className="flex min-w-0 flex-wrap items-center gap-1.5">
					<h2 className="text-sm font-black text-slate-950">
						#{order.id.slice(-6).toUpperCase()}
					</h2>
					<span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-black uppercase tracking-wide text-emerald-700">
						{order.type.replace("_", " ")}
					</span>
					<span className="rounded-md bg-yellow-50 px-2 py-0.5 text-xs font-black uppercase tracking-wide text-yellow-700">
						{order.paymentStatus}
					</span>
					<span className="text-xs font-bold text-slate-400">
						{order.items.length} item{order.items.length !== 1 ? "s" : ""}
					</span>
				</div>
				<div className="relative">
					<button
						type="button"
						onClick={onToggleMenu}
						className="grid size-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-50"
					>
						<EllipsisVertical className="size-4" />
					</button>
					{menuOpen ? (
						<>
							<button
								type="button"
								aria-label="Close order menu"
								className="fixed inset-0 z-40"
								onClick={onCloseMenu}
							/>
							<div className="absolute top-8 right-0 z-50 min-w-[140px] rounded-xl border border-slate-100 bg-white p-1 shadow-lg">
								<button
									type="button"
									onClick={() => {
										onCloseMenu();
										onViewDetails();
									}}
									className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
								>
									<FileText className="size-3.5" />
									View Details
								</button>
							</div>
						</>
					) : null}
				</div>
			</div>

			{/* Customer info + amount */}
			<div className="mt-2 flex items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="text-xs font-bold text-slate-700">
						{order.customerName}
					</p>
					<p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-400">
						<Phone className="size-3" aria-hidden="true" />
						{order.customerPhone || "No phone provided"}
					</p>
				</div>
				<div className="shrink-0 text-right">
					<p className="text-sm font-black text-emerald-700">
						{formatMoney(Number(order.total), currency)}
					</p>
					<p className="mt-0.5 text-xs font-medium text-slate-400">
						{timeAgo(order.createdAt)}
					</p>
				</div>
			</div>

			{/* Status stepper */}
			{order.status !== "CANCELLED" && order.status !== "PENDING_PAYMENT" ? (
				<div className="mt-3">
					<div className="flex items-center">
						{steps.map((step, i) => {
							const done = i <= currentStep;
							const isActive = i === currentStep;
							return (
								<div key={step} className="flex flex-1 flex-col items-center">
									<div className="flex w-full items-center">
										{i > 0 ? (
											<div
												className={cn(
													"h-[2px] flex-1",
													i <= currentStep ? "bg-emerald-500" : "bg-slate-200",
												)}
											/>
										) : (
											<div className="flex-1" />
										)}
										<div
											className={cn(
												"grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
												done
													? "border-emerald-500 bg-emerald-500 text-white"
													: "border-slate-200 bg-white text-slate-300",
												isActive &&
													!done &&
													"border-emerald-500 bg-white text-emerald-500",
											)}
										>
											{done ? (
												<Check className="size-3" />
											) : isActive ? (
												<div className="size-2 rounded-full bg-emerald-500" />
											) : null}
										</div>
										{i < steps.length - 1 ? (
											<div
												className={cn(
													"h-[2px] flex-1",
													i < currentStep ? "bg-emerald-500" : "bg-slate-200",
												)}
											/>
										) : (
											<div className="flex-1" />
										)}
									</div>
									<span
										className={cn(
											"mt-1 text-xs font-bold",
											done ? "text-emerald-700" : "text-slate-400",
											isActive && "font-black text-emerald-700",
										)}
									>
										{step.charAt(0)}
										{step.slice(1).toLowerCase()}
									</span>
								</div>
							);
						})}
					</div>
				</div>
			) : order.status === "CANCELLED" ? (
				<div className="mt-3 rounded-xl bg-red-50 p-3">
					<p className="text-xs font-black text-red-700">
						{orderStatusLabel(order)}
					</p>
					{order.cancellationNote ? (
						<p className="mt-1 text-xs font-bold text-red-800">
							{order.cancellationNote}
						</p>
					) : null}
				</div>
			) : (
				<div className="mt-3 rounded-xl bg-yellow-50 p-3">
					<p className="text-xs font-black text-yellow-800">
						Pending admin acceptance
					</p>
				</div>
			)}

			{/* Action buttons */}
			<div className="mt-3 flex gap-2">
				<button
					type="button"
					onClick={onViewDetails}
					className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700"
				>
					<FileText className="size-3" aria-hidden="true" />
					View Details
				</button>
				{blockedOnPayment ? (
					// Shown instead of the accept button, not as an error after the
					// click: staff need to know why it can't move, and the reason is
					// actionable — take the payment.
					<span className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs font-bold text-amber-800">
						Waiting for payment
					</span>
				) : nextStatus ? (
					<OrderActionForm
						actionKind={
							order.status === "PENDING_APPROVAL"
								? "acceptOrder"
								: "updateStatus"
						}
						className="flex flex-1"
					>
						<input type="hidden" name="slug" value={slug} />
						<input type="hidden" name="orderId" value={order.id} />
						{order.status !== "PENDING_APPROVAL" ? (
							<input type="hidden" name="status" value={nextStatus} />
						) : null}
						<SubmitButton
							loadingText="..."
							successText="Completed"
							className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-700 text-xs font-bold text-white"
						>
							<Check className="size-3" aria-hidden="true" />
							{nextStatusLabel}
						</SubmitButton>
					</OrderActionForm>
				) : null}
			</div>
		</article>
	);
}

// ─── Order Detail Modal ───────────────────────────────

function OrderDetailModal({
	order,
	currency,
	slug,
	restaurantName,
	whatsappEnabled,
	onClose,
}: {
	order: Order;
	currency: string;
	slug: string;
	restaurantName: string;
	whatsappEnabled: boolean;
	onClose: () => void;
}) {
	const [showTimeline, setShowTimeline] = useState(false);
	const steps = getStatusSteps(order.type);
	const currentStep = getStepIndex(order.status, order.type);

	return (
		<div className="fixed inset-0 z-100 flex items-end justify-center">
			{/* Backdrop */}
			<button
				type="button"
				aria-label="Close order details"
				className="absolute inset-0 bg-black/40 backdrop-blur-sm"
				onClick={onClose}
			/>

			{/* Modal sheet */}
			<div className="relative z-10 max-h-[90vh] w-full overflow-y-auto rounded-t-3xl bg-white pb-[max(env(safe-area-inset-bottom),1rem)] animate-in slide-in-from-bottom duration-300">
				{/* Drag handle */}
				<div className="sticky top-0 z-10 flex justify-center bg-white pt-3 pb-2">
					<div className="h-1 w-10 rounded-full bg-slate-200" />
				</div>

				<div className="px-4 pb-4">
					{/* Header */}
					<div className="flex items-start justify-between gap-2">
						<div>
							<div className="flex flex-wrap items-center gap-1.5">
								<h2 className="text-sm font-black text-slate-950">
									Order #{order.id.slice(-6).toUpperCase()}
								</h2>
								<span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-black uppercase tracking-wide text-emerald-700">
									{order.type.replace("_", " ")}
								</span>
								<span className="rounded-md bg-yellow-50 px-2 py-0.5 text-xs font-black uppercase tracking-wide text-yellow-700">
									{order.paymentStatus}
								</span>
							</div>
							<p className="mt-1 text-xs font-medium text-slate-400">
								{new Date(order.createdAt).toLocaleString("en-NG", {
									dateStyle: "medium",
									timeStyle: "short",
								})}
							</p>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="grid size-8 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-50"
						>
							<X className="size-4" />
						</button>
					</div>

					{/* Status stepper */}
					{order.status !== "CANCELLED" &&
					order.status !== "PENDING_PAYMENT" ? (
						<div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
							<p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">
								Order Progress
							</p>
							<div className="flex items-center">
								{steps.map((step, i) => {
									const done = i <= currentStep;
									const isActive = i === currentStep;
									return (
										<div
											key={step}
											className="flex flex-1 flex-col items-center"
										>
											<div className="flex w-full items-center">
												{i > 0 ? (
													<div
														className={cn(
															"h-[2px] flex-1",
															i <= currentStep
																? "bg-emerald-500"
																: "bg-slate-200",
														)}
													/>
												) : (
													<div className="flex-1" />
												)}
												<div
													className={cn(
														"grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
														done
															? "border-emerald-500 bg-emerald-500 text-white"
															: "border-slate-200 bg-white text-slate-300",
														isActive &&
															!done &&
															"border-emerald-500 bg-white text-emerald-500",
													)}
												>
													{done ? (
														<Check className="size-3.5" />
													) : isActive ? (
														<div className="size-2 rounded-full bg-emerald-500" />
													) : null}
												</div>
												{i < steps.length - 1 ? (
													<div
														className={cn(
															"h-[2px] flex-1",
															i < currentStep
																? "bg-emerald-500"
																: "bg-slate-200",
														)}
													/>
												) : (
													<div className="flex-1" />
												)}
											</div>
											<span
												className={cn(
													"mt-1 text-xs font-bold",
													done ? "text-emerald-700" : "text-slate-400",
													isActive && "font-black text-emerald-700",
												)}
											>
												{step.charAt(0)}
												{step.slice(1).toLowerCase()}
											</span>
										</div>
									);
								})}
							</div>
						</div>
					) : (
						<div
							className={cn(
								"mt-4 rounded-xl p-3",
								order.status === "CANCELLED" ? "bg-red-50" : "bg-yellow-50",
							)}
						>
							<p
								className={cn(
									"text-xs font-black",
									order.status === "CANCELLED"
										? "text-red-700"
										: "text-yellow-800",
								)}
							>
								{order.status === "CANCELLED"
									? orderStatusLabel(order)
									: "Pending admin acceptance"}
							</p>
							{order.status === "CANCELLED" && order.cancellationNote ? (
								<p className="mt-1 text-xs font-bold text-red-800">
									{order.cancellationNote}
								</p>
							) : null}
						</div>
					)}

					{/* Customer info */}
					<div className="mt-4 rounded-xl border border-slate-100 p-3">
						<p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">
							Customer Details
						</p>
						<div className="grid gap-1.5">
							<div className="flex items-center justify-between">
								<span className="text-xs font-medium text-slate-500">Name</span>
								<span className="text-xs font-bold text-slate-900">
									{order.customerName}
								</span>
							</div>
							<div className="flex items-center justify-between">
								<span className="text-xs font-medium text-slate-500">
									Phone
								</span>
								<span className="text-xs font-bold text-slate-900">
									{order.customerPhone || "Not provided"}
								</span>
							</div>
							{order.type === "DINE_IN" ? (
								<>
									{order.tableLabel || order.tableNumber ? (
										<div className="flex items-center justify-between">
											<span className="text-xs font-medium text-slate-500">
												{order.orderFor === "SOMEONE_ELSE"
													? "Receiver Table"
													: "Table"}
											</span>
											<span className="text-xs font-bold text-slate-900">
												{order.tableLabel ?? order.tableNumber}
											</span>
										</div>
									) : null}
									{order.orderFor === "SOMEONE_ELSE" &&
									order.senderTableNumber ? (
										<div className="flex items-center justify-between">
											<span className="text-xs font-medium text-slate-500">
												Sender Table
											</span>
											<span className="text-xs font-bold text-slate-900">
												{order.senderTableNumber}
											</span>
										</div>
									) : null}
									{order.orderFor === "SOMEONE_ELSE" && order.senderPhone ? (
										<div className="flex items-center justify-between">
											<span className="text-xs font-medium text-slate-500">
												Sender Phone
											</span>
											<span className="text-xs font-bold text-slate-900">
												{order.senderPhone}
											</span>
										</div>
									) : null}
									<div className="flex items-center justify-between">
										<span className="text-xs font-medium text-slate-500">
											Service
										</span>
										<span className="text-xs font-bold text-slate-900">
											{order.dineInServiceMode === "SERVED_BY_WAITER"
												? `Served by ${order.waiterName ?? "staff"}`
												: "Self-served"}
										</span>
									</div>
									{order.dineInPaymentMethod ? (
										<div className="flex items-center justify-between">
											<span className="text-xs font-medium text-slate-500">
												Payment Method
											</span>
											<span className="text-xs font-bold text-slate-900">
												{order.dineInPaymentMethod === "CASH"
													? "Cash"
													: "POS / Transfer"}
											</span>
										</div>
									) : null}
									{order.dineInPaymentPolicy ? (
										<div className="flex items-center justify-between">
											<span className="text-xs font-medium text-slate-500">
												Payment Policy
											</span>
											<span className="text-xs font-bold text-slate-900">
												{order.dineInPaymentPolicy === "PAY_AFTER_SERVICE"
													? "Pay After Service"
													: "Pay Before Service"}
											</span>
										</div>
									) : null}
								</>
							) : null}
							{order.type === "DELIVERY" && order.deliveryAddress ? (
								<div className="flex items-center justify-between">
									<span className="text-xs font-medium text-slate-500">
										Address
									</span>
									<span className="max-w-[60%] text-right text-xs font-bold text-slate-900">
										{order.deliveryAddress}
									</span>
								</div>
							) : null}
						</div>
					</div>

					{/* Order items */}
					<div className="mt-4 rounded-xl border border-slate-100 p-3">
						<p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-400">
							Order Items ({order.items.length})
						</p>
						<div className="grid gap-2">
							{order.items.map((item) => (
								<div
									key={item.id}
									className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 p-2.5"
								>
									<div className="min-w-0">
										<p className="text-xs font-black text-slate-900">
											{item.name}{" "}
											<span className="font-bold text-slate-500">
												x{item.qty}
											</span>
										</p>
										{item.notes ? (
											<p className="mt-0.5 text-xs font-medium text-slate-500">
												Note: {item.notes}
											</p>
										) : null}
									</div>
									<p className="shrink-0 text-xs font-black text-emerald-700">
										{formatMoney(Number(item.unitPrice) * item.qty, currency)}
									</p>
								</div>
							))}
						</div>
						<div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
							<span className="text-xs font-black text-slate-950">Total</span>
							<span className="text-sm font-black text-emerald-700">
								{formatMoney(Number(order.total), currency)}
							</span>
						</div>
					</div>

					{/* Delivery notes */}
					{order.deliveryNotes ? (
						<div className="mt-4 rounded-xl bg-yellow-50 p-3">
							<p className="text-xs font-black uppercase tracking-wider text-yellow-700">
								Order Note
							</p>
							<p className="mt-1 text-xs font-bold text-yellow-800">
								{order.deliveryNotes}
							</p>
						</div>
					) : null}

					<div className="mt-4">
						<AdminOrderControls
							slug={slug}
							whatsappEnabled={whatsappEnabled}
							orderId={order.id}
							customerPhone={order.customerPhone}
							status={order.status}
							type={order.type}
							paymentStatus={order.paymentStatus}
							dineInPaymentPolicy={order.dineInPaymentPolicy}
							dineInPaymentMethod={order.dineInPaymentMethod}
							total={Number(order.total)}
							currency={currency}
							variant="mobile"
						/>
						{order.events ? (
							<div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
								<button
									type="button"
									onClick={() => setShowTimeline(true)}
									className="flex w-full items-center justify-between text-xs font-black text-slate-800"
								>
									View Order Timeline
									<ChevronRight className="size-3.5 text-slate-400" />
								</button>
							</div>
						) : null}
					</div>
					<div className="px-4 pb-4">
						<ReceiptActions
							size="sm"
							receipt={{
								orderId: order.id,
								orderCode: `#${order.id.slice(-6).toUpperCase()}`,
								restaurantName: restaurantName,
								customerName: order.customerName,
								status: order.status,
								paymentStatus: order.paymentStatus,
								orderType: order.type,
								total: Number(order.total),
								currency: currency,
								createdAt: order.createdAt,
								items: order.items.map((i) => ({
									name: i.name,
									qty: i.qty,
									unitPrice: Number(i.unitPrice),
									notes: i.notes,
								})),
								payments: order.payments,
							}}
						/>
					</div>
				</div>

				{showTimeline && (
					<OrderTimelineModal
						events={order.events || []}
						fallback={{
							createdAt: order.createdAt,
							status: order.status,
							paymentStatus: order.paymentStatus,
							paymentMethod: order.dineInPaymentMethod,
							attendingStaff: order.attendingStaff,
						}}
						onClose={() => setShowTimeline(false)}
					/>
				)}
			</div>
		</div>
	);
}
