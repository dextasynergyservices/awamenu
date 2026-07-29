"use client";

import { useState } from "react";
import { MobileModal } from "@/components/ui/MobileModal";

type PaymentRow = {
	id: string;
	restaurantName: string;
	planName: string;
	monthlyPrice: number;
	status: string;
	currentPeriodStart: string;
};

const STATUS_STYLES: Record<string, string> = {
	ACTIVE: "bg-emerald-100 text-emerald-700",
	TRIALING: "bg-blue-100 text-blue-700",
	PAST_DUE: "bg-amber-100 text-amber-700",
	CANCELLED: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
	ACTIVE: "Active",
	TRIALING: "Trialing",
	PAST_DUE: "Past Due",
	CANCELLED: "Cancelled",
};

export function PaymentsTable({ payments }: { payments: PaymentRow[] }) {
	const [selectedPayment, setSelectedPayment] = useState<PaymentRow | null>(
		null,
	);

	if (payments.length === 0) {
		return (
			<div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm font-medium text-slate-500">
				No payments recorded yet.
			</div>
		);
	}

	return (
		<>
			<div className="grid gap-2 md:hidden">
				{payments.map((payment) => (
					<button
						key={payment.id}
						type="button"
						onClick={() => setSelectedPayment(payment)}
						className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white p-3 text-left"
					>
						<div className="min-w-0">
							<p className="truncate text-sm font-black text-slate-900">
								{payment.restaurantName}
							</p>
							<p className="truncate text-xs font-medium text-slate-400">
								{payment.planName} · ₦{payment.monthlyPrice.toLocaleString()}
							</p>
						</div>
						<span
							className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${
								STATUS_STYLES[payment.status] ?? "bg-slate-100 text-slate-600"
							}`}
						>
							{STATUS_LABELS[payment.status] ?? payment.status}
						</span>
					</button>
				))}
			</div>

			<div className="hidden overflow-x-auto rounded-2xl border border-slate-100 bg-white md:block">
				<table className="w-full min-w-[640px] text-left text-sm">
					<thead>
						<tr className="border-b border-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
							<th className="p-4">Restaurant</th>
							<th className="p-4">Plan</th>
							<th className="p-4">Amount</th>
							<th className="p-4">Status</th>
							<th className="p-4">Date</th>
						</tr>
					</thead>
					<tbody>
						{payments.map((payment) => (
							<tr
								key={payment.id}
								className="border-b border-slate-50 last:border-0"
							>
								<td className="p-4 font-black text-slate-900">
									{payment.restaurantName}
								</td>
								<td className="p-4 font-semibold text-slate-700">
									{payment.planName}
								</td>
								<td className="p-4 font-semibold text-slate-700">
									₦{payment.monthlyPrice.toLocaleString()}
								</td>
								<td className="p-4">
									<span
										className={`rounded-full px-2.5 py-1 text-xs font-black ${
											STATUS_STYLES[payment.status] ??
											"bg-slate-100 text-slate-600"
										}`}
									>
										{STATUS_LABELS[payment.status] ?? payment.status}
									</span>
								</td>
								<td className="p-4 font-medium text-slate-500">
									{new Date(payment.currentPeriodStart).toLocaleDateString()}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<MobileModal
				open={selectedPayment !== null}
				onClose={() => setSelectedPayment(null)}
				title={selectedPayment?.restaurantName ?? ""}
				description={selectedPayment?.planName}
			>
				{selectedPayment ? (
					<div className="grid gap-3 pb-2">
						<div>
							<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								Amount
							</p>
							<p className="mt-0.5 text-sm font-semibold text-slate-700">
								₦{selectedPayment.monthlyPrice.toLocaleString()}
							</p>
						</div>
						<div>
							<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								Date
							</p>
							<p className="mt-0.5 text-sm font-semibold text-slate-700">
								{new Date(
									selectedPayment.currentPeriodStart,
								).toLocaleDateString()}
							</p>
						</div>
						<div>
							<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								Status
							</p>
							<span
								className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-black ${
									STATUS_STYLES[selectedPayment.status] ??
									"bg-slate-100 text-slate-600"
								}`}
							>
								{STATUS_LABELS[selectedPayment.status] ??
									selectedPayment.status}
							</span>
						</div>
					</div>
				) : null}
			</MobileModal>
		</>
	);
}
