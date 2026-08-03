"use client";

import { Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { changePlanAction } from "@/actions/billing.actions";
import { SubmitButton } from "@/components/ui/action-button";
import {
	BILLING_INTERVAL_DETAILS,
	BILLING_INTERVALS,
	type BillingIntervalValue,
	formatCurrency,
	getPlanIntervalPrice,
	getPlanMonthlyEquivalent,
	getPlanSavingsPercent,
} from "@/lib/billing";

type DashboardPlan = {
	id: string;
	tier: string;
	name: string;
	description: string | null;
	monthlyPrice: number;
	quarterlyPrice: number;
	yearlyPrice: number;
	features: string[];
};

type ChangePlanPickerProps = {
	plans: DashboardPlan[];
	slug: string;
	currentPlanId?: string;
	currentBillingInterval?: BillingIntervalValue;
};

export function ChangePlanPicker({
	plans,
	slug,
	currentPlanId,
	currentBillingInterval = "MONTHLY",
}: ChangePlanPickerProps) {
	const [interval, setInterval] = useState<BillingIntervalValue>(
		currentBillingInterval,
	);

	return (
		<div className="grid gap-5">
			<div className="rounded-[1.75rem] border border-slate-200 bg-white p-2 shadow-sm">
				<div className="grid grid-cols-3 gap-1">
					{BILLING_INTERVALS.map((value) => {
						const active = value === interval;
						const savings = plans.reduce(
							(max, plan) => Math.max(max, getPlanSavingsPercent(plan, value)),
							0,
						);
						return (
							<button
								key={value}
								type="button"
								onClick={() => setInterval(value)}
								className={`min-h-11 rounded-[1.1rem] px-2 text-xs font-black transition-all duration-300 md:text-sm ${
									active
										? "bg-emerald-700 text-white shadow-[0_12px_30px_rgba(4,120,87,0.2)]"
										: "text-slate-700 hover:bg-emerald-50 hover:text-emerald-800"
								}`}
							>
								<span className="block">
									{BILLING_INTERVAL_DETAILS[value].label}
								</span>
								{savings > 0 ? (
									<span
										className={`mt-0.5 block text-[10px] ${
											active ? "text-yellow-200" : "text-emerald-600"
										}`}
									>
										Save {savings}%
									</span>
								) : null}
							</button>
						);
					})}
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-3">
				{plans.map((plan) => {
					const isCurrent =
						plan.id === currentPlanId && interval === currentBillingInterval;
					const price = getPlanIntervalPrice(plan, interval);
					const savings = getPlanSavingsPercent(plan, interval);
					const monthlyEquivalent = getPlanMonthlyEquivalent(plan, interval);
					const isFeatured = plan.tier === "PRO";

					return (
						<form
							key={plan.id}
							action={changePlanAction}
							className={`relative flex min-h-full flex-col overflow-hidden rounded-3xl border p-6 transition-all duration-300 hover:-translate-y-1 ${
								isCurrent
									? "border-emerald-500 bg-emerald-50 shadow-sm"
									: isFeatured
										? "border-emerald-700 bg-white shadow-sm ring-4 ring-emerald-100 hover:shadow-md"
										: "border-slate-200 bg-white shadow-sm hover:border-emerald-200 hover:shadow-md"
							}`}
						>
							<div
								aria-hidden="true"
								className={`absolute inset-x-0 top-0 h-1 ${
									isFeatured ? "bg-yellow-300" : "bg-emerald-100"
								}`}
							/>
							{isCurrent ? (
								<div className="absolute top-0 right-0 rounded-bl-xl bg-emerald-500 px-3 py-1 text-xs font-black uppercase tracking-wider text-white">
									Current
								</div>
							) : isFeatured ? (
								<div className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-yellow-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-950">
									<Sparkles className="size-3" aria-hidden="true" />
									Popular
								</div>
							) : null}
							<input type="hidden" name="planId" value={plan.id} />
							<input type="hidden" name="slug" value={slug} />
							<input type="hidden" name="billingInterval" value={interval} />

							<h2 className="pr-16 text-sm font-black text-slate-950 md:text-xl">
								{plan.name}
							</h2>
							<p className="mt-1 min-h-12 text-xs font-medium text-slate-600 md:mt-2 md:text-sm">
								{plan.description}
							</p>
							<p className="mt-4 text-xl font-black text-slate-950 md:mt-6 md:text-3xl">
								{formatCurrency(price)}
								<span className="text-xs font-medium text-slate-500 md:text-sm">
									{BILLING_INTERVAL_DETAILS[interval].priceSuffix}
								</span>
							</p>
							<p className="mt-1 min-h-5 text-xs font-bold text-slate-500">
								{price <= 0
									? "Always free"
									: interval === "MONTHLY"
										? "Billed monthly"
										: `${formatCurrency(Math.round(monthlyEquivalent))}/mo equivalent${savings > 0 ? ` · save ${savings}%` : ""}`}
							</p>
							<ul className="mt-5 grid gap-2 text-xs font-bold text-slate-600">
								{plan.features.slice(0, 4).map((feature) => (
									<li key={feature} className="flex gap-2">
										<Check
											className="mt-0.5 size-3.5 shrink-0 text-emerald-700"
											aria-hidden="true"
										/>
										<span>{feature}</span>
									</li>
								))}
							</ul>
							<div className="mt-auto pt-6">
								<SubmitButton
									disabled={isCurrent}
									loadingText="Processing..."
									successText="Redirecting..."
									className={`h-11 w-full rounded-2xl px-4 text-xs font-black transition-colors md:h-12 md:text-sm ${
										isCurrent
											? "cursor-not-allowed bg-slate-100 text-slate-400"
											: "bg-emerald-700 text-white hover:bg-emerald-800"
									}`}
								>
									{isCurrent ? "Current Plan" : "Switch to this Plan"}
								</SubmitButton>
							</div>
						</form>
					);
				})}
			</div>
		</div>
	);
}
