"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { OrderActionForm } from "@/components/orders/OrderActionForm";
import { SubmitButton } from "@/components/ui/action-button";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	orderId: string;
	slug: string;
	total: number;
	currency: string;
	requirePin?: boolean;
};

export function SplitPaymentModal({
	isOpen,
	onClose,
	orderId,
	slug,
	total,
	currency,
	requirePin = false,
}: Props) {
	const [cash, setCash] = useState(0);
	const [pos, setPos] = useState(0);
	const [transfer, setTransfer] = useState(0);

	if (!isOpen) return null;

	const sum = cash + pos + transfer;
	const remaining = total - sum;
	const isBalanced = sum === total;
	const currencySymbol = currency === "NGN" ? "₦" : currency;

	function formatAmount(amount: number) {
		return amount.toLocaleString("en-NG", { minimumFractionDigits: 0 });
	}

	return (
		<div className="fixed inset-0 z-[120] flex flex-col justify-end sm:grid sm:place-items-center">
			{/* Backdrop */}
			<button
				type="button"
				aria-label="Close modal backdrop"
				className="absolute inset-0 w-full h-full bg-slate-950/50 backdrop-blur-sm"
				onClick={onClose}
			/>

			<OrderActionForm
				actionKind="recordSplitPayment"
				onSuccess={onClose}
				requirePin={requirePin}
				className="relative z-10 w-full max-h-[90vh] overflow-y-auto rounded-t-[1.75rem] sm:rounded-3xl bg-white p-4 pt-6 sm:p-5 shadow-2xl sm:max-w-sm animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in sm:duration-200 duration-300 pb-[max(env(safe-area-inset-bottom),1rem)] sm:pb-5"
			>
				{/* Drag handle for mobile */}
				<div className="sm:hidden absolute left-0 right-0 top-0 flex justify-center pt-2.5 pb-2">
					<div className="h-1 w-10 rounded-full bg-slate-200" />
				</div>

				<input type="hidden" name="slug" value={slug} />
				<input type="hidden" name="orderId" value={orderId} />

				<div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3 sm:pb-4 sm:mb-4">
					<h2 className="text-lg sm:text-xl font-black text-slate-950">
						Record Payment
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="grid size-7 sm:size-8 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
						aria-label="Close modal"
					>
						<X className="size-4" aria-hidden="true" />
					</button>
				</div>

				<div className="mb-4 sm:mb-6 rounded-2xl bg-emerald-50 p-3 sm:p-4 text-center">
					<p className="text-xs sm:text-sm font-bold text-emerald-900 mb-1">
						Order Total
					</p>
					<p className="text-2xl sm:text-3xl font-black text-emerald-950">
						{currencySymbol}
						{formatAmount(total)}
					</p>
				</div>

				<div className="grid gap-3 sm:gap-4">
					<label className="flex items-center justify-between gap-3 sm:gap-4">
						<span className="text-xs sm:text-sm font-black text-slate-700 w-20 sm:w-24">
							Cash
						</span>
						<div className="relative flex-1">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
								{currencySymbol}
							</span>
							<input
								type="number"
								name="cashAmount"
								min="0"
								step="1"
								value={cash || ""}
								onChange={(e) => setCash(Number(e.target.value) || 0)}
								className="h-10 sm:h-11 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
								placeholder="0"
							/>
						</div>
					</label>

					<label className="flex items-center justify-between gap-3 sm:gap-4">
						<span className="text-xs sm:text-sm font-black text-slate-700 w-20 sm:w-24">
							POS
						</span>
						<div className="relative flex-1">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
								{currencySymbol}
							</span>
							<input
								type="number"
								name="posAmount"
								min="0"
								step="1"
								value={pos || ""}
								onChange={(e) => setPos(Number(e.target.value) || 0)}
								className="h-10 sm:h-11 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
								placeholder="0"
							/>
						</div>
					</label>

					<label className="flex items-center justify-between gap-3 sm:gap-4">
						<span className="text-xs sm:text-sm font-black text-slate-700 w-20 sm:w-24">
							Transfer
						</span>
						<div className="relative flex-1">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
								{currencySymbol}
							</span>
							<input
								type="number"
								name="transferAmount"
								min="0"
								step="1"
								value={transfer || ""}
								onChange={(e) => setTransfer(Number(e.target.value) || 0)}
								className="h-10 sm:h-11 w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 text-sm font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
								placeholder="0"
							/>
						</div>
					</label>
				</div>

				<div className="mt-4 sm:mt-6 border-t border-slate-100 pt-4 flex flex-col gap-3 sm:gap-4">
					<div className="flex items-center justify-between">
						<p className="text-xs sm:text-sm font-bold text-slate-500">
							Remaining Balance:
						</p>
						<p
							className={`text-base sm:text-lg font-black ${
								remaining === 0
									? "text-emerald-600"
									: remaining > 0
										? "text-amber-600"
										: "text-red-600"
							}`}
						>
							{currencySymbol}
							{formatAmount(remaining)}
						</p>
					</div>

					<label className="flex items-center justify-between gap-3 sm:gap-4">
						<span className="text-xs sm:text-sm font-black text-slate-700 w-20 sm:w-24">
							Staff ID
						</span>
						<input
							type="text"
							name="staffId"
							maxLength={6}
							minLength={6}
							required
							onChange={(e) => {
								e.target.value = e.target.value.toUpperCase();
							}}
							placeholder="6 chars"
							className="h-10 sm:h-11 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-900 outline-none uppercase placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
						/>
					</label>
				</div>

				<SubmitButton
					disabled={!isBalanced}
					loadingText="Confirming..."
					successText="Payment Recorded"
					className="mt-5 sm:mt-6 h-11 sm:h-12 w-full rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-50 disabled:hover:bg-emerald-700"
				>
					Confirm Payment
				</SubmitButton>
			</OrderActionForm>
		</div>
	);
}
