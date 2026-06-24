"use client";

import {
	AlertTriangle,
	Check,
	ChevronRight,
	Clock3,
	Eye,
	FileText,
	MapPin,
	Printer,
	ReceiptText,
	Send,
	ShoppingBag,
	User,
	X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	cancelOrderAction,
	markOrderPaidAction,
	updateOrderStatusAction,
} from "@/actions/order.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { cn } from "@/lib/utils";

type OrderItem = {
	id: string;
	name: string;
	qty: number;
	unitPrice: string;
	notes: string | null;
};

type Order = {
	id: string;
	customerName: string;
	customerPhone: string;
	type: string;
	status: string;
	statusNote: string | null;
	paymentStatus: string;
	tableNumber: string | null;
	tableLabel: string | null;
	deliveryAddress: string | null;
	deliveryNotes: string | null;
	dineInPaymentPolicy: string | null;
	dineInPaymentMethod: string | null;
	dineInServiceMode: string | null;
	waiterName: string | null;
	total: string;
	createdAt: string;
	items: OrderItem[];
};

type DesktopOrdersListProps = {
	orders: Order[];
	currency: string;
	slug: string;
};

const statusOptions = [
	"CONFIRMED",
	"PREPARING",
	"READY",
	"DELIVERED",
	"COMPLETED",
];

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
	}, ${new Intl.DateTimeFormat("en-NG", {
		hour: "numeric",
		minute: "2-digit",
	}).format(date)}`;
}

function orderTypeLabel(type: string) {
	return type.replaceAll("_", " ");
}

function statusBadgeClass(status: string) {
	if (status === "PENDING_PAYMENT") return "bg-yellow-50 text-yellow-700";
	if (status === "CANCELLED") return "bg-red-50 text-red-700";
	if (status === "COMPLETED") return "bg-emerald-50 text-emerald-700";
	if (status === "CONFIRMED") return "bg-emerald-50 text-emerald-700";
	if (status === "PREPARING") return "bg-blue-50 text-blue-700";
	if (status === "READY") return "bg-indigo-50 text-indigo-700";
	return "bg-slate-50 text-slate-700";
}

function paymentBadgeClass(status: string) {
	return status === "PAID"
		? "bg-emerald-50 text-emerald-700"
		: "bg-yellow-50 text-yellow-700";
}

function typeBadgeClass(type: string) {
	if (type === "PICKUP") return "bg-blue-50 text-blue-700";
	if (type === "DELIVERY") return "bg-emerald-50 text-emerald-700";
	if (type === "DINE_IN") return "bg-violet-50 text-violet-700";
	return "bg-slate-50 text-slate-700";
}

function getInitialSelectedStatus(status: string) {
	if (status === "PENDING_PAYMENT") return "CONFIRMED";
	if (statusOptions.includes(status)) return status;
	return "CONFIRMED";
}

function getDefaultStatusNote(status: string) {
	if (status === "CONFIRMED") return "Your order has been confirmed.";
	if (status === "PREPARING") return "Food is being prepared.";
	if (status === "READY") return "Your order is ready.";
	if (status === "DELIVERED") return "Your order is out for delivery.";
	if (status === "COMPLETED") return "Your order has been completed.";
	return "";
}

function getDefaultWhatsAppMessage(order: Order, status: string) {
	const code = `#${order.id.slice(-6).toUpperCase()}`;
	const readableStatus = status.replaceAll("_", " ").toLowerCase();
	return [
		`Hello ${order.customerName},`,
		`Your order ${code} is ${readableStatus}.`,
		"We will notify you once there is another update.",
		"Thank you for ordering with us.",
	].join("\n\n");
}

function getStatusSteps(type: string) {
	if (type === "DELIVERY") {
		return [
			{ value: "PENDING_PAYMENT", label: "Pending" },
			{ value: "CONFIRMED", label: "Confirmed" },
			{ value: "PREPARING", label: "Preparing" },
			{ value: "READY", label: "Out for Delivery" },
			{ value: "DELIVERED", label: "Delivered" },
		];
	}

	return [
		{ value: "PENDING_PAYMENT", label: "Pending" },
		{ value: "CONFIRMED", label: "Confirmed" },
		{ value: "PREPARING", label: "Preparing" },
		{ value: "READY", label: "Ready" },
		{ value: "COMPLETED", label: "Completed" },
	];
}

function getStepIndex(status: string, type: string) {
	const steps = getStatusSteps(type);
	const index = steps.findIndex((step) => step.value === status);
	return index === -1 ? 0 : index;
}

function normalizeWhatsAppPhone(phone: string) {
	const digits = phone.replace(/\D/g, "");
	if (!digits || phone.toLowerCase().includes("not provided")) return "";
	if (digits.startsWith("0") && digits.length === 11) {
		return `234${digits.slice(1)}`;
	}
	return digits;
}

export function DesktopOrdersList({
	orders,
	currency,
	slug,
}: DesktopOrdersListProps) {
	const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

	return (
		<>
			<div className="grid gap-3">
				{orders.map((order) => (
					<button
						key={order.id}
						type="button"
						onClick={() => setSelectedOrder(order)}
						className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 rounded-2xl border border-slate-100 bg-white px-5 py-4 text-left shadow-[0_10px_30px_rgba(15,23,42,0.03)] transition hover:border-emerald-100 hover:shadow-[0_14px_34px_rgba(15,23,42,0.05)] focus:outline-none focus:ring-2 focus:ring-emerald-100"
					>
						<span className="grid size-12 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
							<ShoppingBag className="size-5" aria-hidden="true" />
						</span>
						<span className="min-w-0">
							<span className="flex flex-wrap items-center gap-2">
								<span className="text-lg font-black text-slate-950">
									#{order.id.slice(-6).toUpperCase()}
								</span>
								<span
									className={`rounded-full px-3 py-1 text-xs font-black ${typeBadgeClass(order.type)}`}
								>
									{orderTypeLabel(order.type)}
								</span>
								<span
									className={`rounded-full px-3 py-1 text-xs font-black ${paymentBadgeClass(order.paymentStatus)}`}
								>
									{order.paymentStatus}
								</span>
							</span>
							<span className="mt-2 block truncate text-sm font-semibold text-slate-600">
								{order.customerName} · {order.customerPhone}
							</span>
							{order.type === "DELIVERY" && order.deliveryAddress ? (
								<span className="mt-1 block truncate text-sm font-semibold text-slate-600">
									Delivery: {order.deliveryAddress}
								</span>
							) : null}
							{order.type === "DINE_IN" ? (
								<span className="mt-1 block truncate text-sm font-semibold text-slate-600">
									Table: {order.tableLabel ?? order.tableNumber ?? "Not set"}
								</span>
							) : null}
						</span>
						<span className="text-right">
							<span className="block text-xl font-black text-slate-950">
								{formatMoney(Number(order.total), currency)}
							</span>
							<span
								className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${statusBadgeClass(order.status)}`}
							>
								{order.status.replaceAll("_", " ")}
							</span>
							<span className="mt-2 flex items-center justify-end gap-1 text-xs font-semibold text-slate-500">
								<Clock3 className="size-3.5" aria-hidden="true" />
								{formatOrderTime(order.createdAt)}
							</span>
						</span>
						<ChevronRight
							className="size-5 text-slate-700"
							aria-hidden="true"
						/>
					</button>
				))}
			</div>

			{selectedOrder ? (
				<OrderDetailsModal
					order={selectedOrder}
					currency={currency}
					slug={slug}
					onClose={() => setSelectedOrder(null)}
				/>
			) : null}
		</>
	);
}

function OrderDetailsModal({
	order,
	currency,
	slug,
	onClose,
}: {
	order: Order;
	currency: string;
	slug: string;
	onClose: () => void;
}) {
	const selectedDefaultStatus = getInitialSelectedStatus(order.status);
	const [selectedStatus, setSelectedStatus] = useState(selectedDefaultStatus);
	const [statusNote, setStatusNote] = useState(
		order.statusNote ?? getDefaultStatusNote(selectedDefaultStatus),
	);
	const [whatsappMessage, setWhatsappMessage] = useState(() =>
		getDefaultWhatsAppMessage(order, selectedDefaultStatus),
	);
	const [previewOpen, setPreviewOpen] = useState(false);
	const [cancelOpen, setCancelOpen] = useState(false);
	const statusFormId = `status-form-${order.id}`;
	const subtotal = useMemo(
		() =>
			order.items.reduce(
				(total, item) => total + Number(item.unitPrice) * item.qty,
				0,
			),
		[order.items],
	);
	const deliveryFee = Number(order.total) - subtotal;
	const normalizedPhone = normalizeWhatsAppPhone(order.customerPhone);
	const canUpdateStatus = order.status !== "CANCELLED";
	const canCancel =
		order.status !== "CANCELLED" && order.status !== "COMPLETED";
	const canMarkPaid =
		order.type === "DINE_IN" &&
		order.paymentStatus === "PENDING" &&
		order.dineInPaymentPolicy === "PAY_AFTER_SERVICE" &&
		order.status !== "CANCELLED";
	const orderLink =
		typeof window === "undefined"
			? ""
			: `${window.location.origin}/${slug}/order/${order.id}`;

	useEffect(() => {
		const nextStatus = getInitialSelectedStatus(order.status);
		setSelectedStatus(nextStatus);
		setStatusNote(order.statusNote ?? getDefaultStatusNote(nextStatus));
		setWhatsappMessage(getDefaultWhatsAppMessage(order, nextStatus));
		setPreviewOpen(false);
	}, [order]);

	function handleStatusChange(value: string) {
		setSelectedStatus(value);
		setStatusNote(getDefaultStatusNote(value));
		setWhatsappMessage(getDefaultWhatsAppMessage(order, value));
	}

	function openWhatsApp() {
		if (!normalizedPhone) return;
		const text = encodeURIComponent(`${whatsappMessage}\n\n${orderLink}`);
		window.open(
			`https://wa.me/${normalizedPhone}?text=${text}`,
			"_blank",
			"noopener,noreferrer",
		);
	}

	return (
		<div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-5 backdrop-blur-[2px]">
			<button
				type="button"
				aria-label="Close order details"
				className="absolute inset-0 cursor-default"
				onClick={onClose}
			/>
			<section className="relative z-10 grid max-h-[88vh] w-full max-w-[53rem] overflow-hidden rounded-[1rem] bg-white shadow-2xl">
				<header className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-4 px-7 pb-4 pt-6">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<h2 className="text-2xl font-black text-slate-950">
								Order #{order.id.slice(-6).toUpperCase()}
							</h2>
							<span
								className={`rounded-full px-3 py-1 text-xs font-black ${typeBadgeClass(order.type)}`}
							>
								{orderTypeLabel(order.type)}
							</span>
							<span
								className={`rounded-full px-3 py-1 text-xs font-black ${paymentBadgeClass(order.paymentStatus)}`}
							>
								{order.paymentStatus}
							</span>
						</div>
						<p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
							<Clock3 className="size-3.5" aria-hidden="true" />
							Placed on {formatOrderTime(order.createdAt)}
						</p>
					</div>
					<div className="text-right">
						<p className="text-2xl font-black text-emerald-700">
							{formatMoney(Number(order.total), currency)}
						</p>
						<span
							className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${statusBadgeClass(order.status)}`}
						>
							{order.status.replaceAll("_", " ")}
						</span>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-50"
					>
						<X className="size-5" aria-hidden="true" />
						<span className="sr-only">Close</span>
					</button>
				</header>

				<div className="grid max-h-[calc(88vh-6.25rem)] gap-4 overflow-y-auto px-7 pb-6 md:grid-cols-[18rem_minmax(0,1fr)]">
					<div className="grid content-start gap-4">
						<InfoCard
							icon={<User className="size-4" />}
							title="Customer Details"
						>
							<p>{order.customerName}</p>
							<p>{order.customerPhone || "No phone provided"}</p>
							{order.type === "DINE_IN" ? (
								<p>
									{order.dineInServiceMode === "SERVED_BY_WAITER"
										? `Served by ${order.waiterName ?? "staff"}`
										: "Self-served"}
								</p>
							) : null}
						</InfoCard>

						{order.deliveryAddress || order.tableLabel || order.tableNumber ? (
							<InfoCard
								icon={<MapPin className="size-4" />}
								title={
									order.type === "DINE_IN"
										? "Table Details"
										: "Delivery Address"
								}
							>
								<p>
									{order.type === "DINE_IN"
										? (order.tableLabel ?? order.tableNumber ?? "Not set")
										: order.deliveryAddress}
								</p>
								{order.deliveryNotes ? <p>{order.deliveryNotes}</p> : null}
							</InfoCard>
						) : null}

						<div className="rounded-2xl border border-slate-100 p-4">
							<div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
								<ShoppingBag className="size-4 text-slate-500" />
								Order Items ({order.items.length})
							</div>
							<div className="grid gap-2">
								{order.items.map((item) => (
									<div
										key={item.id}
										className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-100 p-2"
									>
										<span className="grid size-12 place-items-center rounded-xl bg-emerald-50 text-xs font-black text-emerald-700">
											{item.qty}x
										</span>
										<span className="min-w-0">
											<span className="block text-sm font-black text-slate-950">
												{item.name}
											</span>
											{item.notes ? (
												<span className="mt-1 block text-xs font-semibold text-slate-500">
													{item.notes}
												</span>
											) : null}
										</span>
										<span className="text-sm font-black text-slate-950">
											{formatMoney(Number(item.unitPrice) * item.qty, currency)}
										</span>
									</div>
								))}
							</div>
						</div>

						<div className="rounded-2xl bg-slate-50 p-4">
							<h3 className="text-sm font-black text-slate-950">
								Order Summary
							</h3>
							<div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600">
								<SummaryLine
									label="Subtotal"
									value={formatMoney(subtotal, currency)}
								/>
								<SummaryLine
									label="Delivery Fee"
									value={
										deliveryFee > 0 ? formatMoney(deliveryFee, currency) : "NO"
									}
								/>
								<SummaryLine label="Discount" value="-NO" />
								<SummaryLine
									label="Total Amount"
									value={formatMoney(Number(order.total), currency)}
									strong
								/>
							</div>
						</div>
					</div>

					<div className="grid content-start gap-4">
						<div className="rounded-2xl border border-slate-100 p-4">
							<div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-800">
								<ReceiptText className="size-4 text-slate-500" />
								Update Order Status
							</div>
							<StatusStepper
								status={selectedStatus}
								orderType={order.type}
								createdAt={order.createdAt}
							/>
							<form
								id={statusFormId}
								action={updateOrderStatusAction}
								className="mt-4 grid gap-3"
							>
								<input type="hidden" name="slug" value={slug} />
								<input type="hidden" name="orderId" value={order.id} />
								<label className="grid gap-1 text-xs font-black text-slate-600">
									Status
									<select
										name="status"
										value={selectedStatus}
										onChange={(event) => handleStatusChange(event.target.value)}
										disabled={!canUpdateStatus}
										className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-600 disabled:bg-slate-50"
									>
										{statusOptions.map((status) => (
											<option key={status} value={status}>
												{status.replaceAll("_", " ")}
											</option>
										))}
									</select>
								</label>
								<label className="grid gap-1 text-xs font-black text-slate-600">
									Add note (optional)
									<textarea
										name="statusNote"
										value={statusNote}
										onChange={(event) => setStatusNote(event.target.value)}
										rows={3}
										maxLength={500}
										placeholder="E.g. Food is being prepared"
										className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-600"
									/>
								</label>
								<SubmitButton
									disabled={!canUpdateStatus}
									loadingText="Updating..."
									successText="Updated"
									className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white"
								>
									Update Status
								</SubmitButton>
							</form>
						</div>

						<div className="rounded-2xl border border-slate-100 p-4">
							<div className="mb-2 flex items-center justify-between gap-3">
								<div className="flex items-center gap-2 text-sm font-black text-slate-800">
									<Send className="size-4 text-emerald-600" />
									WhatsApp Message
								</div>
								<button
									type="button"
									onClick={() =>
										setWhatsappMessage(
											getDefaultWhatsAppMessage(order, selectedStatus),
										)
									}
									className="text-xs font-black text-blue-600"
								>
									Reset to default
								</button>
							</div>
							<p className="mb-2 text-xs font-semibold text-slate-500">
								Edit message to send to customer
							</p>
							<textarea
								value={whatsappMessage}
								onChange={(event) => setWhatsappMessage(event.target.value)}
								rows={5}
								className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-600"
							/>
							{previewOpen ? (
								<div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600">
									{whatsappMessage}
									<br />
									<br />
									{orderLink}
								</div>
							) : null}
							<div className="mt-3 grid grid-cols-2 gap-3">
								<button
									type="button"
									onClick={() => setPreviewOpen((value) => !value)}
									className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
								>
									<Eye className="size-4" />
									Preview
								</button>
								<button
									type="button"
									disabled={!normalizedPhone}
									onClick={openWhatsApp}
									className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-50"
								>
									<Send className="size-4" />
									Send via WhatsApp
								</button>
							</div>
						</div>

						<div className="rounded-2xl border border-slate-100 p-4">
							<div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
								<User className="size-4 text-slate-500" />
								Actions
							</div>
							<div className="grid grid-cols-2 gap-3">
								<ActionButton
									icon={<Printer className="size-4" />}
									label="Print Receipt"
									helper="Download or print receipt"
									onClick={() => window.print()}
								/>
								<ActionButton
									icon={<FileText className="size-4" />}
									label="Print Invoice"
									helper="Download or print invoice"
									onClick={() => window.print()}
								/>
							</div>
							<div className="mt-3 grid gap-2">
								{canMarkPaid ? (
									<form action={markOrderPaidAction}>
										<input type="hidden" name="slug" value={slug} />
										<input type="hidden" name="orderId" value={order.id} />
										<SubmitButton
											loadingText="Recording..."
											successText="Paid"
											className="min-h-10 w-full rounded-xl bg-yellow-300 px-4 text-sm font-black text-emerald-950"
										>
											Mark cash paid
										</SubmitButton>
									</form>
								) : null}
								<button
									type="button"
									disabled={!canCancel}
									onClick={() => setCancelOpen(true)}
									className="min-h-10 rounded-xl border border-red-100 bg-white px-4 text-sm font-black text-red-600 disabled:opacity-50"
								>
									Cancel order
								</button>
							</div>
						</div>
					</div>
				</div>

				<footer className="grid grid-cols-[1fr_auto] gap-3 border-slate-100 border-t px-7 py-4">
					<button
						type="button"
						onClick={onClose}
						className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
					>
						Close
					</button>
					<button
						type="submit"
						form={statusFormId}
						disabled={!canUpdateStatus}
						className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-8 text-sm font-black text-white disabled:opacity-50"
					>
						<Check className="size-4" />
						Save Changes
					</button>
				</footer>
			</section>

			{cancelOpen ? (
				<CancelOrderModal
					slug={slug}
					orderId={order.id}
					onClose={() => setCancelOpen(false)}
				/>
			) : null}
		</div>
	);
}

function StatusStepper({
	status,
	orderType,
	createdAt,
}: {
	status: string;
	orderType: string;
	createdAt: string;
}) {
	const steps = getStatusSteps(orderType);
	const currentIndex = getStepIndex(status, orderType);

	return (
		<div className="grid gap-2">
			<div className="grid grid-cols-5 items-start">
				{steps.map((step, index) => {
					const done = index <= currentIndex;
					const active = index === currentIndex;
					return (
						<div key={step.value} className="grid justify-items-center gap-2">
							<div className="flex w-full items-center">
								<div
									className={cn(
										"h-[2px] flex-1",
										index === 0
											? "bg-transparent"
											: done
												? "bg-emerald-600"
												: "bg-slate-200",
									)}
								/>
								<span
									className={cn(
										"grid size-6 place-items-center rounded-full border text-[11px] font-black",
										done
											? "border-emerald-700 bg-emerald-700 text-white"
											: "border-slate-300 bg-slate-100 text-slate-500",
										active && "ring-4 ring-emerald-50",
									)}
								>
									{done ? <Check className="size-3.5" /> : index + 1}
								</span>
								<div
									className={cn(
										"h-[2px] flex-1",
										index === steps.length - 1
											? "bg-transparent"
											: index < currentIndex
												? "bg-emerald-600"
												: "bg-slate-200",
									)}
								/>
							</div>
							<div className="text-center">
								<p
									className={cn(
										"text-[11px] font-black",
										active ? "text-emerald-700" : "text-slate-500",
									)}
								>
									{step.label}
								</p>
								<p className="mt-1 text-[10px] font-semibold text-slate-400">
									{formatOrderTime(createdAt).split(", ").at(-1)}
								</p>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function InfoCard({
	icon,
	title,
	children,
}: {
	icon: React.ReactNode;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="rounded-2xl border border-slate-100 p-4">
			<div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800">
				<span className="text-slate-500">{icon}</span>
				{title}
			</div>
			<div className="grid gap-1 text-sm font-semibold leading-6 text-slate-600">
				{children}
			</div>
		</div>
	);
}

function SummaryLine({
	label,
	value,
	strong = false,
}: {
	label: string;
	value: string;
	strong?: boolean;
}) {
	return (
		<div
			className={cn(
				"flex items-center justify-between gap-3",
				strong && "border-slate-200 border-t pt-3",
			)}
		>
			<span className={strong ? "font-black text-slate-950" : undefined}>
				{label}
			</span>
			<span
				className={strong ? "font-black text-emerald-700" : "text-slate-700"}
			>
				{value}
			</span>
		</div>
	);
}

function ActionButton({
	icon,
	label,
	helper,
	onClick,
}: {
	icon: React.ReactNode;
	label: string;
	helper: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="grid min-h-16 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 text-left"
		>
			<span className="text-slate-500">{icon}</span>
			<span className="min-w-0">
				<span className="block text-sm font-black text-slate-800">{label}</span>
				<span className="block truncate text-xs font-semibold text-slate-500">
					{helper}
				</span>
			</span>
		</button>
	);
}

function CancelOrderModal({
	slug,
	orderId,
	onClose,
}: {
	slug: string;
	orderId: string;
	onClose: () => void;
}) {
	return (
		<div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
			<form
				action={cancelOrderAction}
				className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl"
			>
				<input type="hidden" name="slug" value={slug} />
				<input type="hidden" name="orderId" value={orderId} />
				<div className="flex items-start justify-between gap-3">
					<div className="flex items-start gap-3">
						<span className="grid size-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-600">
							<AlertTriangle className="size-4" aria-hidden="true" />
						</span>
						<div>
							<h2 className="text-sm font-black text-slate-950">
								Are you sure?
							</h2>
							<p className="mt-1 text-xs font-bold text-slate-500">
								This order will be cancelled and locked.
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="grid size-8 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500"
						aria-label="Close cancel confirmation"
					>
						<X className="size-4" aria-hidden="true" />
					</button>
				</div>

				<label className="mt-4 block text-xs font-black text-slate-700">
					Admin password
					<input
						name="password"
						type="password"
						required
						autoComplete="current-password"
						className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
					/>
				</label>

				<div className="mt-4 flex justify-end gap-2">
					<button
						type="button"
						onClick={onClose}
						className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
					>
						Keep order
					</button>
					<SubmitButton
						loadingText="Cancelling..."
						successText="Cancelled"
						onSuccess={onClose}
						className="h-10 rounded-xl bg-red-600 px-4 text-sm font-black text-white"
					>
						Cancel order
					</SubmitButton>
				</div>
			</form>
		</div>
	);
}
