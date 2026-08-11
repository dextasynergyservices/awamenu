"use client";

import { Banknote, Check, Copy, Landmark } from "lucide-react";
import { useState } from "react";

export type ManualPaymentOptionsProps = {
	bankTransfer: {
		bankName: string;
		accountNumber: string;
		accountName: string;
	} | null;
	cashEnabled: boolean;
	/** Whether an online channel is also available, which changes the framing
	 * from "here's how to pay" to "or pay another way". */
	hasOnlineOption: boolean;
};

/**
 * Manual payment options shown at checkout.
 *
 * These channels can't be completed by the gateway, so the customer needs the
 * details in front of them — otherwise enabling Bank Transfer in settings would
 * have no visible effect for the people meant to use it.
 */
export function ManualPaymentOptions({
	bankTransfer,
	cashEnabled,
	hasOnlineOption,
}: ManualPaymentOptionsProps) {
	const [copied, setCopied] = useState(false);

	if (!bankTransfer && !cashEnabled) return null;

	return (
		<section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
			<h3 className="text-sm font-black text-slate-950">
				{hasOnlineOption ? "Other ways to pay" : "How to pay"}
			</h3>

			{bankTransfer ? (
				<div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
					<p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
						<Landmark className="size-3.5" aria-hidden="true" />
						Bank transfer
					</p>
					<p className="mt-2 font-black text-slate-900">
						{bankTransfer.accountName}
					</p>
					<p className="text-sm font-bold text-slate-700">
						{bankTransfer.bankName}
					</p>
					<div className="mt-2 flex items-center gap-2">
						<code className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-base font-black tracking-wider text-slate-900">
							{bankTransfer.accountNumber}
						</code>
						<button
							type="button"
							onClick={() => {
								navigator.clipboard.writeText(bankTransfer.accountNumber);
								setCopied(true);
								setTimeout(() => setCopied(false), 2000);
							}}
							aria-label="Copy account number"
							className="grid size-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
						>
							{copied ? (
								<Check className="size-4 text-emerald-600" aria-hidden="true" />
							) : (
								<Copy className="size-4" aria-hidden="true" />
							)}
						</button>
					</div>
					<p className="mt-2 text-xs font-medium text-slate-500">
						Transfer the exact total, then place your order. The restaurant
						confirms your payment before preparing it.
					</p>
				</div>
			) : null}

			{cashEnabled ? (
				<div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3">
					<Banknote
						className="mt-0.5 size-4 shrink-0 text-slate-500"
						aria-hidden="true"
					/>
					<p className="text-sm font-medium text-slate-700">
						<span className="font-black text-slate-900">Cash</span> — pay in
						person when your order arrives or when you collect it.
					</p>
				</div>
			) : null}
		</section>
	);
}
