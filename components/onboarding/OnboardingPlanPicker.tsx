"use client";

import { Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { choosePlanAction } from "@/actions/onboarding.actions";
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

type OnboardingPlan = {
	id: string;
	tier: string;
	name: string;
	description: string | null;
	monthlyPrice: number;
	quarterlyPrice: number;
	yearlyPrice: number;
	features: string[];
};

type OnboardingPlanPickerProps = {
	plans: OnboardingPlan[];
	initialBillingInterval?: BillingIntervalValue;
};

export function OnboardingPlanPicker({
	plans,
	initialBillingInterval = "MONTHLY",
}: OnboardingPlanPickerProps) {
	const [interval, setInterval] = useState<BillingIntervalValue>(
		initialBillingInterval,
	);

	return (
		<div className="grid gap-6">
			<div className="rounded-[1.75rem] border border-emerald-900/10 bg-[#f6faf7] p-2">
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
								className={`min-h-12 rounded-[1.15rem] px-2 text-xs font-black transition-all duration-300 sm:text-sm ${
									active
										? "bg-emerald-700 text-white shadow-[0_12px_30px_rgba(4,120,87,0.2)]"
										: "text-emerald-900 hover:bg-white"
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
					const price = getPlanIntervalPrice(plan, interval);
					const savings = getPlanSavingsPercent(plan, interval);
					const monthlyEquivalent = getPlanMonthlyEquivalent(plan, interval);
					const isFeatured = plan.tier === "PRO";

					return (
						<form
							key={plan.id}
							action={choosePlanAction}
							className={`relative flex min-h-full flex-col overflow-hidden rounded-[1.75rem] border bg-white p-5 shadow-[0_10px_30px_rgba(22,101,52,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_46px_rgba(22,101,52,0.12)] ${
								isFeatured
									? "border-emerald-700 ring-4 ring-emerald-100"
									: "border-emerald-800/20"
							}`}
						>
							<div
								aria-hidden="true"
								className={`absolute inset-x-0 top-0 h-1 ${
									isFeatured ? "bg-yellow-300" : "bg-emerald-100"
								}`}
							/>
							{isFeatured ? (
								<div className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-yellow-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-950">
									<Sparkles className="size-3" aria-hidden="true" />
									Popular
								</div>
							) : null}
							<input type="hidden" name="planId" value={plan.id} />
							<input type="hidden" name="billingInterval" value={interval} />
							<h2 className="pr-20 text-xl font-black text-zinc-950">
								{plan.name}
							</h2>
							<p className="mt-2 min-h-12 text-sm font-medium text-zinc-600">
								{plan.description}
							</p>
							<p className="mt-5 text-3xl font-black text-zinc-950">
								{formatCurrency(price)}
								<span className="text-sm font-bold text-emerald-700">
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
							<ul className="mt-5 grid gap-2.5 text-sm font-semibold text-slate-700">
								{plan.features.map((feature) => (
									<li key={feature} className="flex items-start gap-2">
										<Check
											className="mt-0.5 size-4 shrink-0 text-emerald-700"
											aria-hidden="true"
										/>
										<span>{feature}</span>
									</li>
								))}
							</ul>
							<div className="mt-auto pt-6">
								<SubmitButton
									loadingText="Selecting..."
									successText="Selected"
									className="h-11 w-full rounded-xl bg-emerald-700 px-4 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
								>
									Select
								</SubmitButton>
							</div>
						</form>
					);
				})}
			</div>
		</div>
	);
}
