"use client";

import { AlertTriangle, CreditCard } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import {
	acceptOrderAction,
	cancelOrderAction,
	markOrderPaidAction,
	recordSplitPaymentAction,
	updateOrderStatusAction,
} from "@/actions/order.actions";
import { PinPromptModal } from "@/components/staff/PinPromptModal";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";

type OrderActionKind =
	| "updateStatus"
	| "markPaid"
	| "recordSplitPayment"
	| "cancel"
	| "acceptOrder";

type OrderActionFormProps = {
	actionKind: OrderActionKind;
	children: React.ReactNode;
	className?: string;
	id?: string;
	onSuccess?: () => void;
	requirePin?: boolean;
};

type ErrorCopy = {
	title: string;
	message: string;
	nextStep: string;
	tone: "payment" | "danger" | "default";
};

function getErrorCopy(error: unknown): ErrorCopy {
	const message =
		error instanceof Error
			? error.message
			: "Something went wrong while updating this order.";
	const lowerMessage = message.toLowerCase();

	if (
		lowerMessage.includes("payment is required") ||
		lowerMessage.includes("must be paid online")
	) {
		return {
			title: "Payment required first",
			message,
			nextStep:
				"Ask the customer to complete payment, then record or confirm it. Once payment is confirmed, you can move the order to preparing.",
			tone: "payment",
		};
	}

	if (lowerMessage.includes("cancelled")) {
		return {
			title: "Order is locked",
			message,
			nextStep:
				"This order can no longer be changed. Check the order status and create a new order if needed.",
			tone: "danger",
		};
	}

	if (lowerMessage.includes("completed")) {
		return {
			title: "Completed order",
			message,
			nextStep:
				"Completed orders cannot be changed. Review the order history or create a new order if the customer needs more items.",
			tone: "default",
		};
	}

	if (lowerMessage.includes("password")) {
		return {
			title: "Password check failed",
			message,
			nextStep:
				"Confirm your admin password and try again. This protects declined and cancelled orders from accidental changes.",
			tone: "danger",
		};
	}

	return {
		title: "Could not update order",
		message,
		nextStep:
			"Review the order details, then try again. If the status still cannot change, refresh the orders page and check the latest payment status.",
		tone: "default",
	};
}

async function runOrderAction(actionKind: OrderActionKind, formData: FormData) {
	if (actionKind === "acceptOrder") {
		await acceptOrderAction(formData);
		return;
	}

	if (actionKind === "updateStatus") {
		await updateOrderStatusAction(formData);
		return;
	}

	if (actionKind === "markPaid") {
		await markOrderPaidAction(formData);
		return;
	}

	if (actionKind === "recordSplitPayment") {
		await recordSplitPaymentAction(formData);
		return;
	}

	await cancelOrderAction(formData);
}

export function OrderActionForm({
	actionKind,
	children,
	className,
	id,
	onSuccess,
	requirePin = false,
}: OrderActionFormProps) {
	const router = useRouter();
	const [errorCopy, setErrorCopy] = useState<ErrorCopy | null>(null);
	const [pending, setPending] = useState(false);
	const [promptingPin, setPromptingPin] = useState(false);
	const [pendingForm, setPendingForm] = useState<FormData | null>(null);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;

		if (!form.checkValidity()) {
			form.reportValidity();
			return;
		}

		if (requirePin) {
			// Show PIN prompt before proceeding
			setPromptingPin(true);
			setPendingForm(new FormData(form));
		} else {
			// Submit normally
			setPending(true);
			setErrorCopy(null);

			try {
				await runOrderAction(actionKind, new FormData(form));
				onSuccess?.();
				router.refresh();
			} catch (error) {
				setErrorCopy(getErrorCopy(error));
			} finally {
				setPending(false);
			}
		}
	}

	async function handlePinSubmit(pin: string) {
		if (!pendingForm) return;

		setPending(true);
		setPromptingPin(false);
		setErrorCopy(null);

		const formData = pendingForm;
		formData.set("pin", pin);

		try {
			await runOrderAction(actionKind, formData);
			onSuccess?.();
			router.refresh();
		} catch (error) {
			setErrorCopy(getErrorCopy(error));
		} finally {
			setPending(false);
			setPendingForm(null);
		}
	}

	return (
		<>
			<form
				id={id}
				onSubmit={handleSubmit}
				aria-busy={pending}
				data-pending={pending ? "true" : undefined}
				className={className}
			>
				<fieldset disabled={pending} className="contents">
					{children}
				</fieldset>
			</form>

			{errorCopy ? (
				<OrderActionErrorModal
					error={errorCopy}
					onClose={() => setErrorCopy(null)}
				/>
			) : null}

			{promptingPin ? (
				<PinPromptModal
					onPinEnter={handlePinSubmit}
					onClose={() => {
						setPromptingPin(false);
						setPendingForm(null);
					}}
				/>
			) : null}
		</>
	);
}

function OrderActionErrorModal({
	error,
	onClose,
}: {
	error: ErrorCopy;
	onClose: () => void;
}) {
	const Icon = error.tone === "payment" ? CreditCard : AlertTriangle;

	return (
		<Dialog
			open
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			size="md"
		>
			<DialogHeader
				title={
					<span className="flex items-start gap-3">
						<span
							className={cn(
								"grid size-10 shrink-0 place-items-center rounded-full",
								error.tone === "payment"
									? "bg-yellow-50 text-yellow-700"
									: error.tone === "danger"
										? "bg-red-50 text-red-700"
										: "bg-slate-100 text-slate-700",
							)}
						>
							<Icon className="size-5" aria-hidden="true" />
						</span>
						<span className="flex flex-col gap-2">
							<span>{error.title}</span>
							<span className="text-sm font-bold leading-6 text-slate-700">
								{error.message}
							</span>
						</span>
					</span>
				}
			/>
			<DialogBody>
				<div className="rounded-xl bg-slate-50 p-3">
					<p className="text-xs font-black uppercase tracking-wide text-slate-500">
						What to do
					</p>
					<p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
						{error.nextStep}
					</p>
				</div>

				<button
					type="button"
					onClick={onClose}
					className="mt-5 min-h-11 w-full rounded-xl bg-slate-950 px-4 text-sm font-black text-white"
				>
					Okay
				</button>
			</DialogBody>
		</Dialog>
	);
}
