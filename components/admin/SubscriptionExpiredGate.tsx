"use client";

import { AlertTriangle, Check, Sparkles } from "lucide-react";
import { useState } from "react";
import {
	downgradeToFreeAction,
	renewOrUpgradeAction,
} from "@/actions/subscription-lifecycle.actions";
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

type PlanOption = {
	id: string;
	name: string;
	quarterlyPrice: number;
	monthlyPrice: number;
	yearlyPrice: number;
};

type CategoryOption = {
	id: string;
	name: string;
	emoji: string | null;
};

type SubscriptionExpiredGateProps = {
	restaurantId: string;
	restaurantName: string;
	slug: string;
	currentPlan: PlanOption;
	upgradePlans: PlanOption[];
	categories: CategoryOption[];
	freePlanMaxCategories: number;
};

export function SubscriptionExpiredGate({
	restaurantId,
	restaurantName,
	slug,
	currentPlan,
	upgradePlans,
	categories,
	freePlanMaxCategories,
}: SubscriptionExpiredGateProps) {
	const alreadyWithinFreeLimits =
		freePlanMaxCategories < 0 || categories.length <= freePlanMaxCategories;
	const [showFreeFlow, setShowFreeFlow] = useState(false);
	const [billingInterval, setBillingInterval] =
		useState<BillingIntervalValue>("MONTHLY");
	const [keptCategoryIds, setKeptCategoryIds] = useState<string[]>(() =>
		alreadyWithinFreeLimits ? categories.map((c) => c.id) : [],
	);

	function toggleCategory(id: string) {
		setKeptCategoryIds((prev) => {
			if (prev.includes(id)) return prev.filter((c) => c !== id);
			if (freePlanMaxCategories >= 0 && prev.length >= freePlanMaxCategories) {
				return prev;
			}
			return [...prev, id];
		});
	}

	const canConfirmFree = categories.length === 0 || keptCategoryIds.length > 0;

	return (
		<main className="min-h-screen bg-[#f6faf7] px-4 py-10">
			<section className="mx-auto w-full max-w-2xl">
				<div className="rounded-[2rem] border border-red-100 bg-white p-6 text-center shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-8">
					<div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600">
						<AlertTriangle className="size-7" aria-hidden="true" />
					</div>
					<p className="text-xs font-black uppercase tracking-widest text-red-600">
						Subscription Expired
					</p>
					<h1 className="mt-2 text-2xl font-black text-slate-950">
						{restaurantName}'s plan has lapsed
					</h1>
					<p className="mt-2 text-sm font-medium text-slate-600">
						Your public menu is offline until you renew, upgrade, or continue on
						the Free plan. Choose an option below to unlock your dashboard
						again.
					</p>
				</div>

				{!showFreeFlow ? (
					<div className="mt-6 grid gap-4">
						<div className="rounded-2xl border border-slate-100 bg-white p-2 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
							<div className="grid grid-cols-3 gap-1">
								{BILLING_INTERVALS.map((value) => {
									const active = value === billingInterval;
									const allPlans = [currentPlan, ...upgradePlans];
									const savings = allPlans.reduce(
										(max, plan) =>
											Math.max(max, getPlanSavingsPercent(plan, value)),
										0,
									);
									return (
										<button
											key={value}
											type="button"
											onClick={() => setBillingInterval(value)}
											className={`min-h-11 rounded-xl px-2 text-xs font-black transition-all ${
												active
													? "bg-emerald-700 text-white shadow-sm"
													: "text-slate-700 hover:bg-emerald-50"
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

						{currentPlan.monthlyPrice > 0 ? (
							<form action={renewOrUpgradeAction}>
								<input type="hidden" name="restaurantId" value={restaurantId} />
								<input type="hidden" name="planId" value={currentPlan.id} />
								<input
									type="hidden"
									name="billingInterval"
									value={billingInterval}
								/>
								<input type="hidden" name="slug" value={slug} />
								<div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
									<div
										aria-hidden="true"
										className="absolute inset-x-0 top-0 h-1 bg-emerald-100"
									/>
									<h2 className="font-black text-slate-950">
										Renew {currentPlan.name}
									</h2>
									<p className="mt-1 text-sm font-medium text-slate-600">
										{formatCurrency(
											getPlanIntervalPrice(currentPlan, billingInterval),
										)}
										{BILLING_INTERVAL_DETAILS[billingInterval].priceSuffix} —
										keep everything exactly as it was.
									</p>
									{billingInterval !== "MONTHLY" ? (
										<p className="mt-1 text-xs font-bold text-slate-500">
											{formatCurrency(
												Math.round(
													getPlanMonthlyEquivalent(
														currentPlan,
														billingInterval,
													),
												),
											)}
											/mo equivalent
										</p>
									) : null}
									<SubmitButton
										loadingText="Redirecting..."
										className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-800 sm:w-auto"
									>
										Renew Now
									</SubmitButton>
								</div>
							</form>
						) : null}

						{upgradePlans.map((plan) => (
							<form key={plan.id} action={renewOrUpgradeAction}>
								<input type="hidden" name="restaurantId" value={restaurantId} />
								<input type="hidden" name="planId" value={plan.id} />
								<input
									type="hidden"
									name="billingInterval"
									value={billingInterval}
								/>
								<input type="hidden" name="slug" value={slug} />
								<div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
									<div
										aria-hidden="true"
										className="absolute inset-x-0 top-0 h-1 bg-yellow-300"
									/>
									<h2 className="flex items-center gap-2 font-black text-slate-950">
										<Sparkles
											className="size-4 text-yellow-500"
											aria-hidden="true"
										/>
										Upgrade to {plan.name}
									</h2>
									<p className="mt-1 text-sm font-medium text-slate-600">
										{formatCurrency(
											getPlanIntervalPrice(plan, billingInterval),
										)}
										{BILLING_INTERVAL_DETAILS[billingInterval].priceSuffix}
									</p>
									{billingInterval !== "MONTHLY" ? (
										<p className="mt-1 text-xs font-bold text-slate-500">
											{formatCurrency(
												Math.round(
													getPlanMonthlyEquivalent(plan, billingInterval),
												),
											)}
											/mo equivalent
										</p>
									) : null}
									<SubmitButton
										loadingText="Redirecting..."
										className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl border border-emerald-700 px-4 text-sm font-black text-emerald-700 transition-colors hover:bg-emerald-50 sm:w-auto"
									>
										Upgrade Now
									</SubmitButton>
								</div>
							</form>
						))}

						<div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
							<h2 className="font-black text-slate-950">
								Continue on Free instead
							</h2>
							<p className="mt-1 text-sm font-medium text-slate-600">
								No payment required, but only{" "}
								{freePlanMaxCategories < 0
									? "your menu"
									: `${freePlanMaxCategories} categor${freePlanMaxCategories === 1 ? "y" : "ies"}`}{" "}
								(and its item limit) stays visible to customers.
							</p>
							{alreadyWithinFreeLimits ? (
								<form action={downgradeToFreeAction}>
									<input
										type="hidden"
										name="restaurantId"
										value={restaurantId}
									/>
									{categories.map((category) => (
										<input
											key={category.id}
											type="hidden"
											name="keepCategoryIds"
											value={category.id}
										/>
									))}
									<SubmitButton
										loadingText="Switching to Free..."
										className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-black text-slate-600 transition-colors hover:bg-slate-100 sm:w-auto"
									>
										Continue on Free
									</SubmitButton>
								</form>
							) : (
								<button
									type="button"
									onClick={() => setShowFreeFlow(true)}
									className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-black text-slate-600 transition-colors hover:bg-slate-100 sm:w-auto"
								>
									Continue on Free
								</button>
							)}
						</div>
					</div>
				) : (
					<form
						action={downgradeToFreeAction}
						className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-5 sm:p-6"
					>
						<input type="hidden" name="restaurantId" value={restaurantId} />
						<h2 className="font-black text-slate-950">
							Choose{" "}
							{freePlanMaxCategories === 1
								? "the category"
								: `up to ${freePlanMaxCategories} categories`}{" "}
							to keep
						</h2>
						<p className="mt-1 text-sm font-medium text-slate-700">
							On the Free plan, customers will only see{" "}
							<span className="font-black">
								{freePlanMaxCategories === 1
									? "one category"
									: `up to ${freePlanMaxCategories} categories`}
							</span>{" "}
							of your menu. Your other categories will be hidden from the public
							menu — but not deleted, and you can edit them any time. They'll
							reappear automatically the moment you renew or upgrade.
						</p>

						<div className="mt-4 grid gap-2">
							{categories.map((category) => {
								const checked = keptCategoryIds.includes(category.id);
								const atLimit =
									freePlanMaxCategories >= 0 &&
									keptCategoryIds.length >= freePlanMaxCategories;
								return (
									<label
										key={category.id}
										className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 has-checked:border-emerald-600 has-checked:bg-emerald-50 has-disabled:cursor-not-allowed has-disabled:opacity-50"
									>
										<input
											type="checkbox"
											name="keepCategoryIds"
											value={category.id}
											checked={checked}
											disabled={!checked && atLimit}
											onChange={() => toggleCategory(category.id)}
											className="accent-emerald-700"
										/>
										<span className="font-bold text-slate-900">
											{category.emoji ? `${category.emoji} ` : ""}
											{category.name}
										</span>
									</label>
								);
							})}
						</div>

						<div className="mt-5 flex flex-col gap-2 sm:flex-row">
							<SubmitButton
								disabled={!canConfirmFree}
								loadingText="Switching to Free..."
								className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
							>
								<Check className="size-4" aria-hidden="true" />
								Confirm — Use Free Plan
							</SubmitButton>
							<button
								type="button"
								onClick={() => setShowFreeFlow(false)}
								className="inline-flex h-11 items-center justify-center rounded-xl px-4 text-sm font-black text-slate-600 hover:bg-white"
							>
								Back
							</button>
						</div>
					</form>
				)}
			</section>
		</main>
	);
}
