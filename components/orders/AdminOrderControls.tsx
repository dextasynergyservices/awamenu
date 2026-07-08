"use client";

import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";
import { OrderActionForm } from "@/components/orders/OrderActionForm";
import { SplitPaymentModal } from "@/components/orders/SplitPaymentModal";
import { SubmitButton } from "@/components/ui/action-button";
import { cn } from "@/lib/utils";

type AdminOrderControlsProps = {
	slug: string;
	orderId: string;
	customerPhone: string;
	status: string;
	type: string;
	paymentStatus: string;
	dineInPaymentPolicy: string | null;
	dineInPaymentMethod: string | null;
	total: number;
	currency: string;
	variant?: "desktop" | "mobile";
};

function getStatusOptions(type: string) {
	if (type === "DINE_IN" || type === "TABLE_RESERVATION") {
		return ["CONFIRMED", "PREPARING", "READY", "COMPLETED"];
	}
	return ["CONFIRMED", "PREPARING", "READY", "DELIVERED", "COMPLETED"];
}

function getStatusOptionLabel(status: string, type: string) {
	if (type === "PICKUP" && status === "DELIVERED") return "COLLECTED";
	return status.replaceAll("_", " ");
}

const DEFAULT_DECLINE_REASON =
	"Sorry, we cannot accept this order right now. Please contact the restaurant for more details.";

function getInitialSelectedStatus(status: string, type: string) {
	if (status === "PENDING_PAYMENT") return "CONFIRMED";
	if (getStatusOptions(type).includes(status)) return status;
	return "CONFIRMED";
}

function getDefaultStatusMessage(orderId: string, status: string) {
	const orderCode = `#${orderId.slice(-6).toUpperCase()}`;

	if (status === "CONFIRMED") {
		return `Your order ${orderCode} has been accepted. Please check the link below for the next step.`;
	}

	if (status === "PREPARING") {
		return `Your order ${orderCode} is now being prepared with care.`;
	}

	if (status === "READY") {
		return `Your order ${orderCode} is ready. Please check the order page for pickup, delivery, or dine-in details.`;
	}

	if (status === "DELIVERED") {
		return `Your order ${orderCode} has been delivered. Thank you for ordering.`;
	}

	if (status === "COMPLETED") {
		return `Your order ${orderCode} has been completed. We hope you enjoyed your meal.`;
	}

	return `Your order ${orderCode} status has been updated.`;
}

export function AdminOrderControls({
	orderId,
	status,
	...props
}: AdminOrderControlsProps) {
	return (
		<AdminOrderControlsContent
			key={`${orderId}:${status}`}
			orderId={orderId}
			status={status}
			{...props}
		/>
	);
}

function AdminOrderControlsContent({
	slug,
	orderId,
	customerPhone,
	status,
	type,
	paymentStatus,
	dineInPaymentPolicy,
	dineInPaymentMethod,
	total,
	currency,
	variant = "desktop",
}: AdminOrderControlsProps) {
	const [cancelOpen, setCancelOpen] = useState(false);
	const [selectedStatus, setSelectedStatus] = useState(() =>
		getInitialSelectedStatus(status, type),
	);
	const [whatsappMessage, setWhatsappMessage] = useState(() =>
		getDefaultStatusMessage(orderId, getInitialSelectedStatus(status, type)),
	);
	const [isSplitPaymentModalOpen, setIsSplitPaymentModalOpen] = useState(false);
	const isCancelled = status === "CANCELLED";
	const isCompleted = status === "COMPLETED";
	const isAwaitingAcceptance = status === "PENDING_PAYMENT";
	const canUpdateStatus = !isCancelled;
	const canCancel = !isCancelled && !isCompleted;
	const canMarkPaid =
		!isCancelled && type === "DINE_IN" && paymentStatus === "PENDING";
	const usesInHouseDineInPayment =
		type === "DINE_IN" && Boolean(dineInPaymentMethod);
	const paymentRequiredBeforePreparation =
		type !== "DINE_IN" ||
		(dineInPaymentPolicy === "PAY_BEFORE_SERVICE" && !usesInHouseDineInPayment);
	const canSendPaymentLink =
		!isCancelled &&
		selectedStatus === "CONFIRMED" &&
		paymentStatus === "PENDING" &&
		paymentRequiredBeforePreparation;
	const normalizedPhone = normalizeWhatsAppPhone(customerPhone);
	const canSendStatusMessage = !isCancelled;

	return (
		<div
			className={cn(
				"grid gap-3",
				variant === "desktop" && "border-slate-100 border-t pt-4",
			)}
		>
			<div
				className={cn(
					"grid gap-2",
					variant === "desktop" && "md:grid-cols-[1fr_auto] md:items-start",
				)}
			>
				<OrderActionForm
					actionKind="updateStatus"
					className="flex flex-wrap gap-2"
				>
					<input type="hidden" name="slug" value={slug} />
					<input type="hidden" name="orderId" value={orderId} />
					<select
						name="status"
						value={selectedStatus}
						onChange={(event) => {
							setSelectedStatus(event.target.value);
							setWhatsappMessage(
								getDefaultStatusMessage(orderId, event.target.value),
							);
						}}
						disabled={!canUpdateStatus}
						className={cn(
							"rounded-xl border border-slate-200 bg-white px-3 font-bold text-slate-700 disabled:bg-slate-50 disabled:text-slate-400",
							variant === "desktop"
								? "min-h-11 text-base"
								: "h-8 flex-1 text-[11px] rounded-md",
						)}
					>
						{getStatusOptions(type).map((option) => (
							<option key={option} value={option}>
								{getStatusOptionLabel(option, type)}
							</option>
						))}
					</select>
					<SubmitButton
						disabled={!canUpdateStatus}
						loadingText="Updating..."
						successText="Updated"
						className={cn(
							"rounded-xl bg-emerald-700 text-white",
							variant === "desktop"
								? "min-h-11 px-4 text-base font-medium md:text-sm md:font-black"
								: "h-8 px-4 text-[11px] font-black rounded-md",
						)}
					>
						{isAwaitingAcceptance ? "Accept order" : "Update"}
					</SubmitButton>
				</OrderActionForm>

				<div className="grid gap-1">
					<button
						type="button"
						disabled={!canCancel}
						onClick={() => setCancelOpen(true)}
						className={cn(
							"rounded-xl border border-red-100 bg-white font-black text-red-600 disabled:opacity-50",
							variant === "desktop"
								? "min-h-11 px-4 text-base md:text-sm"
								: "h-8 px-4 text-[11px] rounded-md",
						)}
					>
						{isAwaitingAcceptance ? "Decline order" : "Cancel order"}
					</button>
					{isCancelled || isCompleted ? (
						<p className="text-[11px] font-bold text-slate-400">
							{isCancelled
								? "Cancelled orders are locked."
								: "Completed orders cannot be cancelled."}
						</p>
					) : null}
				</div>
			</div>

			{canMarkPaid ? (
				<>
					<button
						type="button"
						onClick={() => setIsSplitPaymentModalOpen(true)}
						className={cn(
							"rounded-xl bg-yellow-300 px-4 font-black text-emerald-950 hover:bg-yellow-400",
							variant === "desktop"
								? "min-h-11 text-base"
								: "h-8 w-full text-[11px] rounded-md",
						)}
					>
						Confirm payment received
					</button>

					<SplitPaymentModal
						isOpen={isSplitPaymentModalOpen}
						onClose={() => setIsSplitPaymentModalOpen(false)}
						orderId={orderId}
						slug={slug}
						total={total}
						currency={currency}
					/>
				</>
			) : null}

			{canSendStatusMessage ? (
				<div className="grid gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
					<label className="grid gap-1 text-xs font-black text-emerald-900">
						WhatsApp status message
						<textarea
							value={whatsappMessage}
							onChange={(event) => setWhatsappMessage(event.target.value)}
							rows={3}
							className="rounded-xl border border-emerald-100 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-emerald-400"
						/>
					</label>
					<p className="text-[11px] font-bold text-emerald-800">
						{canSendPaymentLink
							? "The payment link is added automatically and cannot be edited."
							: "The order link is added automatically and cannot be edited."}
					</p>
					<button
						type="button"
						disabled={!normalizedPhone}
						onClick={() => {
							const paymentLink = `${window.location.origin}/${slug}/order/${orderId}`;
							const text = encodeURIComponent(
								`${whatsappMessage}\n\n${paymentLink}`,
							);
							window.open(
								`https://wa.me/${normalizedPhone}?text=${text}`,
								"_blank",
								"noopener,noreferrer",
							);
						}}
						className={cn(
							"rounded-xl bg-emerald-700 px-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-50",
							variant === "desktop" ? "min-h-11 text-sm" : "h-9 text-xs",
						)}
					>
						{canSendPaymentLink
							? "Open WhatsApp payment link"
							: "Open WhatsApp status message"}
					</button>
					{normalizedPhone ? null : (
						<p className="text-[11px] font-bold text-red-600">
							Add a valid customer phone number to send this link.
						</p>
					)}
				</div>
			) : null}

			{cancelOpen ? (
				<div className="fixed inset-0 z-120 grid place-items-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
					<OrderActionForm
						actionKind="cancel"
						onSuccess={() => setCancelOpen(false)}
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
										{isAwaitingAcceptance ? "Decline order?" : "Cancel order?"}
									</h2>
									<p className="mt-1 text-xs font-bold text-slate-500">
										{isAwaitingAcceptance
											? "The customer will see this order as declined."
											: "This order will be cancelled and locked."}
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={() => setCancelOpen(false)}
								className="grid size-8 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500"
								aria-label="Close cancel confirmation"
							>
								<X className="size-4" aria-hidden="true" />
							</button>
						</div>

						<label className="mt-4 block text-xs font-black text-slate-700">
							{isAwaitingAcceptance ? "Decline reason" : "Cancellation reason"}
							<textarea
								name="cancellationNote"
								required
								rows={4}
								maxLength={500}
								defaultValue={DEFAULT_DECLINE_REASON}
								className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:border-red-300 focus:ring-2 focus:ring-red-100"
							/>
						</label>

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
								onClick={() => setCancelOpen(false)}
								className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
							>
								Keep order
							</button>
							<SubmitButton
								loadingText={
									isAwaitingAcceptance ? "Declining..." : "Cancelling..."
								}
								successText={isAwaitingAcceptance ? "Declined" : "Cancelled"}
								className="h-10 rounded-xl bg-red-600 px-4 text-sm font-black text-white"
							>
								{isAwaitingAcceptance ? "Decline order" : "Cancel order"}
							</SubmitButton>
						</div>
					</OrderActionForm>
				</div>
			) : null}
		</div>
	);
}

function normalizeWhatsAppPhone(phone: string) {
	const digits = phone.replace(/\D/g, "");

	if (!digits || phone.toLowerCase().includes("not provided")) return "";
	if (digits.startsWith("0") && digits.length === 11) {
		return `234${digits.slice(1)}`;
	}

	return digits;
}
