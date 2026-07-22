"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { initiateOrderPaymentAction } from "@/actions/order.actions";
import { Dialog, DialogBody, DialogTitle } from "@/components/ui/Dialog";
import { DineInPaymentChoiceModal } from "./DineInPaymentChoiceModal";

type Props = {
	orderId: string;
	slug: string;
	total: number;
	currency: string;
	policy: string | null;
	bankAccounts?: Array<{
		id: string;
		accountName: string;
		accountNumber: string;
		bankName: string;
	}>;
	orderType?: string;
};

export function DineInPayNowButton({
	orderId,
	slug,
	total,
	currency,
	policy,
	bankAccounts,
	orderType,
}: Props) {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isPayLaterModalOpen, setIsPayLaterModalOpen] = useState(false);
	const [hasClickedPayLater, setHasClickedPayLater] = useState(true);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		const timer = setTimeout(() => {
			const clicked = localStorage.getItem(`awamenu_pay_later_${orderId}`);
			if (clicked !== "true") {
				setHasClickedPayLater(false);
			}
		}, 0);
		return () => clearTimeout(timer);
	}, [orderId]);

	function handlePayLaterClick() {
		setIsPayLaterModalOpen(true);
		setHasClickedPayLater(true);
		localStorage.setItem(`awamenu_pay_later_${orderId}`, "true");
	}

	if (orderType && orderType !== "DINE_IN") {
		return (
			<div className="mt-5 grid gap-3">
				<form action={initiateOrderPaymentAction}>
					<input type="hidden" name="slug" value={slug} />
					<input type="hidden" name="orderId" value={orderId} />
					<button
						type="submit"
						disabled={isPending}
						onClick={(e) => {
							if (isPending) e.preventDefault();
							else {
								const form = e.currentTarget.closest("form");
								if (form) {
									e.preventDefault();
									startTransition(() => {
										form.requestSubmit();
									});
								}
							}
						}}
						className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-50"
					>
						Pay online
					</button>
				</form>
			</div>
		);
	}

	return (
		<div className="mt-5 grid gap-3">
			<button
				type="button"
				onClick={() => setIsModalOpen(true)}
				className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white"
			>
				Pay now
			</button>
			{policy === "FLEXIBLE" && !hasClickedPayLater && (
				<button
					type="button"
					onClick={handlePayLaterClick}
					className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-emerald-700 bg-white px-4 text-sm font-black text-emerald-700 hover:bg-emerald-50 transition-colors"
				>
					Pay later
				</button>
			)}
			<DineInPaymentChoiceModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				orderId={orderId}
				slug={slug}
				total={total}
				currency={currency}
				bankAccounts={bankAccounts}
			/>
			<PayLaterModal
				isOpen={isPayLaterModalOpen}
				onClose={() => setIsPayLaterModalOpen(false)}
			/>
		</div>
	);
}

function PayLaterModal({
	isOpen,
	onClose,
}: {
	isOpen: boolean;
	onClose: () => void;
}) {
	return (
		<Dialog
			open={isOpen}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			size="sm"
		>
			<DialogBody className="pt-4 text-center sm:pt-5">
				<div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 mb-4">
					<CheckCircle2 className="size-6 text-emerald-600" />
				</div>
				<DialogTitle className="text-xl font-black text-slate-950 mb-2">
					Pay Later
				</DialogTitle>
				<p className="text-sm font-medium text-slate-600 mb-6">
					You can pay the staff when you&apos;re eating. Enjoy your meal!
				</p>
				<button
					type="button"
					onClick={onClose}
					className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-black text-white hover:bg-slate-800 transition-colors"
				>
					Got it
				</button>
			</DialogBody>
		</Dialog>
	);
}
