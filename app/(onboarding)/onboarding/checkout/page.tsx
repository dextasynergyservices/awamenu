import { redirect } from "next/navigation";
import { startSubscriptionCheckoutAction } from "@/actions/onboarding.actions";
import { SubmitButton } from "@/components/ui/action-button";
import {
	BILLING_INTERVAL_DETAILS,
	formatCurrency,
	getPlanIntervalPrice,
	getPlanMonthlyEquivalent,
	getPlanSavingsPercent,
	parseBillingInterval,
} from "@/lib/billing";
import { db } from "@/lib/db";

export default async function CheckoutPage({
	searchParams,
}: {
	searchParams: Promise<{ planId?: string; billing?: string }>;
}) {
	const { planId, billing } = await searchParams;
	const billingInterval = parseBillingInterval(billing);
	if (!planId) redirect("/onboarding/choose-plan");

	const plan = await db.plan.findUnique({ where: { id: planId } });
	if (!plan) redirect("/onboarding/choose-plan");
	const price = getPlanIntervalPrice(plan, billingInterval);
	const monthlyEquivalent = getPlanMonthlyEquivalent(plan, billingInterval);
	const savings = getPlanSavingsPercent(plan, billingInterval);

	return (
		<main className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
			<section className="w-full max-w-md border border-emerald-800/20 bg-white p-6 shadow-[0_12px_40px_rgba(22,101,52,0.08)]">
				<div className="mb-6 h-1.5 w-16 bg-yellow-400" />
				<p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
					Checkout
				</p>
				<h1 className="mt-2 text-2xl font-semibold text-zinc-950">
					{plan.name}
				</h1>
				<p className="mt-3 text-sm text-zinc-600">{plan.description}</p>
				<p className="mt-5 text-2xl font-semibold text-zinc-950">
					{formatCurrency(price)}
					<span className="text-sm font-normal text-emerald-700">
						{BILLING_INTERVAL_DETAILS[billingInterval].priceSuffix}
					</span>
				</p>
				<p className="mt-1 text-sm font-semibold text-zinc-500">
					{price <= 0
						? "No payment required"
						: billingInterval === "MONTHLY"
							? "Billed monthly"
							: `${formatCurrency(Math.round(monthlyEquivalent))}/mo equivalent${savings > 0 ? ` · save ${savings}%` : ""}`}
				</p>
				<form action={startSubscriptionCheckoutAction} className="mt-6">
					<input type="hidden" name="planId" value={plan.id} />
					<input type="hidden" name="billingInterval" value={billingInterval} />
					<SubmitButton
						loadingText="Processing..."
						successText="Redirecting..."
						className="h-11 w-full bg-emerald-700 px-4 text-sm font-semibold uppercase tracking-widest text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
					>
						Pay with Paystack
					</SubmitButton>
				</form>
			</section>
		</main>
	);
}
