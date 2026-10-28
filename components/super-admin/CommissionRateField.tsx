"use client";

import { useState } from "react";
import {
	estimateGatewayFee,
	getGatewayDescriptor,
} from "@/lib/payment-gateways/catalog";

const EXAMPLE = 10_000;
const naira = (v: number) => `₦${Math.round(v).toLocaleString("en-NG")}`;

/** The platform rate, with what it means on a real order as you type. */
export function CommissionRateField({
	defaultValue,
}: {
	defaultValue: number;
}) {
	const [rate, setRate] = useState(String(defaultValue));
	const percent = Math.min(50, Math.max(0, Number(rate) || 0));
	const fee = estimateGatewayFee(
		EXAMPLE,
		getGatewayDescriptor("PAYSTACK").fees,
	);
	const commission = (EXAMPLE * percent) / 100;

	return (
		<div className="grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-end">
			<label className="grid gap-1">
				<span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
					Platform rate (%)
				</span>
				<input
					type="number"
					name="awamenuPayCommissionPercent"
					min={0}
					max={50}
					step="0.01"
					value={rate}
					onChange={(e) => setRate(e.target.value)}
					className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
				/>
			</label>
			<dl className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200 p-2 text-center text-xs">
				<div className="col-span-3 text-left text-[11px] font-bold text-slate-500">
					On a {naira(EXAMPLE)} order paid with Paystack
				</div>
				<div className="rounded-lg bg-slate-50 p-2">
					<dt className="font-bold text-slate-500">Paystack fee</dt>
					<dd className="font-black text-slate-900">{naira(fee)}</dd>
				</div>
				<div className="rounded-lg bg-emerald-50 p-2">
					<dt className="font-bold text-emerald-800">AwaMenu</dt>
					<dd className="font-black text-emerald-900">{naira(commission)}</dd>
				</div>
				<div className="rounded-lg bg-slate-50 p-2">
					<dt className="font-bold text-slate-500">Restaurant</dt>
					<dd className="font-black text-slate-900">
						{naira(EXAMPLE - fee - commission)}
					</dd>
				</div>
			</dl>
		</div>
	);
}
