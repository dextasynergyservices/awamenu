"use client";

import { Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
	BILLING_INTERVAL_DETAILS,
	BILLING_INTERVALS,
	type BillingIntervalValue,
	formatCurrency,
	getPlanIntervalPrice,
	getPlanMonthlyEquivalent,
	getPlanSavingsPercent,
} from "@/lib/billing";

export type PublicPricingPlan = {
	id: string;
	tier: string;
	name: string;
	description: string | null;
	monthlyPrice: number;
	quarterlyPrice: number;
	yearlyPrice: number;
	features: string[];
};

type PublicPricingPlansProps = {
	plans: PublicPricingPlan[];
	compact?: boolean;
};

function signupHref(plan: PublicPricingPlan, interval: BillingIntervalValue) {
	const params = new URLSearchParams({ plan: plan.tier.toLowerCase() });
	if (interval !== "MONTHLY") params.set("billing", interval.toLowerCase());
	return `/signup?${params.toString()}`;
}

export function PublicPricingPlans({
	plans,
	compact = false,
}: PublicPricingPlansProps) {
	const [interval, setInterval] = useState<BillingIntervalValue>("MONTHLY");
	const bestSavings = useMemo(
		() =>
			Math.max(
				0,
				...plans.map((plan) => getPlanSavingsPercent(plan, "YEARLY")),
			),
		[plans],
	);

	return (
		<div className="grid gap-6">
			<div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 rounded-[1.75rem] border border-emerald-900/10 bg-white/80 p-2 shadow-[0_18px_50px_rgba(6,78,59,0.08)] backdrop-blur sm:flex-row">
				<div className="grid w-full grid-cols-3 gap-1">
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
								className={`min-h-12 rounded-[1.15rem] px-2 text-center text-xs font-black transition-all duration-300 sm:text-sm ${
									active
										? "bg-emerald-700 text-white shadow-[0_12px_30px_rgba(4,120,87,0.24)]"
										: "text-emerald-900 hover:bg-emerald-50"
								}`}
							>
								<span className="block">
									{BILLING_INTERVAL_DETAILS[value].label}
								</span>
								{savings > 0 ? (
									<span
										className={`mt-0.5 block text-[10px] font-black ${
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

			{bestSavings > 0 ? (
				<p className="text-center text-xs font-black uppercase tracking-widest text-emerald-700">
					Yearly billing saves up to {bestSavings}%
				</p>
			) : null}

			<div
				className={`grid gap-4 ${
					compact ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"
				}`}
			>
				{plans.map((plan) => {
					const price = getPlanIntervalPrice(plan, interval);
					const monthlyEquivalent = getPlanMonthlyEquivalent(plan, interval);
					const savings = getPlanSavingsPercent(plan, interval);
					const isFree = price <= 0;
					const isFeatured = plan.tier === "PRO";

					return (
						<section
							key={plan.id}
							className={`group relative flex min-h-full flex-col overflow-hidden rounded-[2rem] border bg-white p-6 shadow-[0_18px_55px_rgba(6,78,59,0.1)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(6,78,59,0.16)] ${
								isFeatured
									? "border-emerald-700 ring-4 ring-emerald-100"
									: "border-white/70"
							}`}
						>
							<div
								aria-hidden="true"
								className={`absolute inset-x-0 top-0 h-1 ${
									isFeatured ? "bg-yellow-300" : "bg-emerald-100"
								}`}
							/>
							{isFeatured ? (
								<div className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-yellow-300 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-950">
									<Sparkles className="size-3" aria-hidden="true" />
									Popular
								</div>
							) : null}

							<h3 className="pr-20 text-2xl font-black text-emerald-950">
								{plan.name}
							</h3>
							<p className="mt-3 min-h-14 text-sm leading-6 text-zinc-600">
								{plan.description}
							</p>

							<div className="mt-6">
								<p className="text-4xl font-black tracking-tight text-emerald-950 transition-all duration-300">
									{formatCurrency(price)}
									<span className="ml-1 text-base font-bold text-emerald-700">
										{BILLING_INTERVAL_DETAILS[interval].priceSuffix}
									</span>
								</p>
								{!isFree && interval !== "MONTHLY" ? (
									<p className="mt-1 text-xs font-bold text-slate-500">
										{formatCurrency(Math.round(monthlyEquivalent))}/mo{" "}
										equivalent
										{savings > 0 ? ` · save ${savings}%` : ""}
									</p>
								) : (
									<p className="mt-1 text-xs font-bold text-slate-500">
										{isFree ? "Always free" : "Billed monthly"}
									</p>
								)}
							</div>

							<ul className="mt-6 grid gap-3 text-sm font-medium text-zinc-700">
								{plan.features.map((feature) => (
									<li key={feature} className="flex gap-2">
										<Check
											className="mt-0.5 size-4 shrink-0 text-emerald-700"
											aria-hidden="true"
										/>
										<span>{feature}</span>
									</li>
								))}
							</ul>

							<div className="mt-auto pt-7">
								<Link
									href={signupHref(plan, interval)}
									className={`inline-flex h-12 w-full items-center justify-center rounded-full px-5 text-sm font-black transition-all duration-300 ${
										isFeatured
											? "bg-emerald-700 text-white shadow-[0_14px_34px_rgba(4,120,87,0.2)] hover:bg-emerald-800"
											: "bg-emerald-950 text-white hover:bg-emerald-800"
									}`}
								>
									Choose {plan.name}
								</Link>
							</div>
						</section>
					);
				})}
			</div>
		</div>
	);
}
