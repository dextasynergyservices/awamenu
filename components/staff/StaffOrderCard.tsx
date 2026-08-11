"use client";

import {
	Banknote,
	CheckCircle2,
	ChefHat,
	CreditCard,
	MessageCircle,
	Package,
	Truck,
	UtensilsCrossed,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { staffUpdateOrderStatusAction } from "@/actions/staff.actions";
import { ReceiptActions } from "@/components/orders/ReceiptActions";
import { SplitPaymentModal } from "@/components/orders/SplitPaymentModal";
import { PinPromptModal } from "@/components/staff/PinPromptModal";
import type { StaffPermissions } from "@/lib/staff-permissions";
import { cn } from "@/lib/utils";
import type { StaffOrder } from "./StaffOrderFeed";

type Props = {
	order: StaffOrder;
	currency: string;
	slug: string;
	restaurantName: string;
	permissions: StaffPermissions;
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
	PENDING_PAYMENT: "CONFIRMED",
	CONFIRMED: "PREPARING",
	PREPARING: "READY",
	READY: "DELIVERED",
};

const statusActionLabel: Record<string, string> = {
	PENDING_PAYMENT: "Accept Order",
	CONFIRMED: "Start Preparing",
	PREPARING: "Mark Ready",
	READY: "Mark Delivered",
};

export function StaffOrderCard({
	order,
	currency,
	slug,
	restaurantName,
	permissions,
}: Props) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [paymentOpen, setPaymentOpen] = useState(false);
	const [promptingPin, setPromptingPin] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const config = typeConfig[order.type] ?? typeConfig.DINE_IN;
	const TypeIcon = config.icon;
	const nextStatus = statusFlow[order.status];
	const nextLabel = statusActionLabel[order.status];
	const orderCode = `#${order.id.slice(-6).toUpperCase()}`;

	const isPaid = order.paymentStatus === "PAID";
	const canRecordPayment =
		!isPaid && order.type === "DINE_IN" && permissions.cashPayment;

	const whatsappPhone = normalizeWhatsAppPhone(order.customerPhone ?? "");

	function openWhatsApp() {
		const message = [
			`Hello ${order.customerName},`,
			`Your order ${orderCode} is ${order.status.replaceAll("_", " ").toLowerCase()}.`,
			"We'll keep you posted on any updates.",
			`Thank you for ordering with ${restaurantName}.`,
		].join("\n\n");
		const orderLink = `${window.location.origin}/${slug}/order/${order.id}`;
		window.open(
			`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(`${message}\n\n${orderLink}`)}`,
			"_blank",
			"noopener,noreferrer",
		);
	}

	function handleStatusUpdateClick() {
		if (!nextStatus) return;
		setPromptingPin(true);
	}

	function submitStatusUpdate(staffId: string) {
		setPromptingPin(false);
		setError(null);

		const fd = new FormData();
		fd.set("slug", slug);
		fd.set("staffId", staffId);
		fd.set("orderId", order.id);
		fd.set("status", nextStatus);

		startTransition(async () => {
			try {
				await staffUpdateOrderStatusAction(fd);
				router.refresh();
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to update status.",
				);
			}
		});
	}

	const currencySymbol = currency === "NGN" ? "₦" : currency;

	return (
		<>
			<div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
				{/* Header */}
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-base font-black text-slate-950">
								{orderCode}
							</span>
							<span
								className={cn(
									"inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-black",
									config.color,
								)}
							>
								<TypeIcon className="size-3" />
								{config.label}
							</span>
							{isPaid ? (
								<span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-black text-emerald-700">
									<CheckCircle2 className="size-3" />
									Paid
								</span>
							) : (
								<span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-0.5 text-xs font-black text-amber-700">
									<Banknote className="size-3" />
									Unpaid
								</span>
							)}
						</div>
						<p className="mt-1 text-sm font-medium text-slate-600">
							{order.customerName}
							{order.tableNumber ? ` · Table ${order.tableNumber}` : ""}
						</p>
					</div>
					<p className="shrink-0 text-lg font-black text-slate-950">
						{currencySymbol}
						{order.total.toLocaleString()}
					</p>
				</div>

				{/* Items */}
				<div className="mt-3 rounded-xl bg-slate-50 p-3">
					{order.items.map((item) => (
						<div
							key={item.id}
							className="flex items-baseline justify-between gap-2 py-1 text-sm"
						>
							<span className="min-w-0 font-medium text-slate-700">
								<span className="font-black text-slate-900">{item.qty}×</span>{" "}
								{item.name}
								{item.notes ? (
									<span className="ml-1 text-xs text-slate-400">
										({item.notes})
									</span>
								) : null}
							</span>
							<span className="shrink-0 font-bold text-slate-600">
								{currencySymbol}
								{(item.unitPrice * item.qty).toLocaleString()}
							</span>
						</div>
					))}
				</div>

				{/* Time */}
				<p className="mt-1 text-xs font-medium text-slate-400">
					{new Date(order.createdAt).toLocaleTimeString([], {
						hour: "2-digit",
						minute: "2-digit",
					})}
				</p>

				{/* Actions */}
				<div className="mt-3 flex flex-wrap gap-2">
					{nextLabel ? (
						<button
							type="button"
							onClick={handleStatusUpdateClick}
							disabled={isPending}
							className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
						>
							{isPending ? (
								"Updating…"
							) : (
								<>
									<ChefHat className="size-4" />
									{nextLabel}
								</>
							)}
						</button>
					) : null}

					{canRecordPayment ? (
						<button
							type="button"
							onClick={() => setPaymentOpen(true)}
							className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-black text-emerald-700 transition-colors hover:bg-emerald-100"
						>
							<CreditCard className="size-4" />
							Record Payment
						</button>
					) : null}

					{/* Staff can now message the customer at any stage, the same way the
					    owner can from the admin dashboard. */}
					{whatsappPhone ? (
						<button
							type="button"
							onClick={openWhatsApp}
							className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 text-sm font-black text-emerald-700 transition-colors hover:bg-emerald-50"
							title={`Message ${order.customerName} on WhatsApp`}
						>
							<MessageCircle className="size-4" />
							WhatsApp
						</button>
					) : null}

					<div className="flex justify-end gap-2 text-sm scale-[0.8] origin-right">
						<ReceiptActions
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

				{error ? (
					<p className="mt-2 text-xs font-medium text-red-600">{error}</p>
				) : null}
			</div>

			{/* Payment Modal */}
			{paymentOpen ? (
				<SplitPaymentModal
					isOpen={paymentOpen}
					orderId={order.id}
					total={Number(order.total)}
					currency={currency}
					slug={slug}
					requirePin={true}
					onClose={() => setPaymentOpen(false)}
				/>
			) : null}

			{promptingPin ? (
				<PinPromptModal
					onPinEnter={submitStatusUpdate}
					onClose={() => setPromptingPin(false)}
				/>
			) : null}
		</>
	);
}

/**
 * Normalises a stored phone number into the digits-only form wa.me expects,
 * assuming Nigerian numbers when given a local 0-prefixed one. Returns an empty
 * string for anything unusable, which hides the WhatsApp action.
 */
function normalizeWhatsAppPhone(phone: string) {
	const digits = phone.replace(/\D/g, "");
	if (!digits || phone.toLowerCase().includes("not provided")) return "";
	if (digits.startsWith("0") && digits.length === 11) {
		return `234${digits.slice(1)}`;
	}
	return digits;
}
