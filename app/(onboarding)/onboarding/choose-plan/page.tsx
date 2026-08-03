import { continueWithPreselectedPlan } from "@/actions/onboarding.actions";
import { OnboardingPlanPicker } from "@/components/onboarding/OnboardingPlanPicker";
import { parseBillingInterval } from "@/lib/billing";
import { db } from "@/lib/db";

function formatLimit(value: number, label: string) {
	return value === -1 ? `Unlimited ${label}` : `${value} ${label}`;
}

function planFeatures(plan: {
	maxCategories: number;
	maxMenuItems: number;
	whatsappIntegration: boolean;
	advancedAnalytics: boolean;
	removeAwamenuBranding: boolean;
	prioritySupport: boolean;
	basicSupport: boolean;
}) {
	return [
		formatLimit(plan.maxCategories, "Categories"),
		formatLimit(plan.maxMenuItems, "Items"),
		plan.whatsappIntegration ? "WhatsApp included" : "WhatsApp not included",
		plan.advancedAnalytics ? "Advanced analytics" : "Basic analytics",
		plan.removeAwamenuBranding ? "Remove branding" : "AwaMenu branding shown",
		plan.prioritySupport
			? "Priority support"
			: plan.basicSupport
				? "Basic support"
				: "Standard support",
	];
}

export default async function ChoosePlanPage({
	searchParams,
}: {
	searchParams: Promise<{ plan?: string; billing?: string }>;
}) {
	const { plan, billing } = await searchParams;
	const billingInterval = parseBillingInterval(billing);
	if (plan) await continueWithPreselectedPlan(plan, billingInterval);

	const plans = await db.plan.findMany({
		where: { isActive: true },
		orderBy: { monthlyPrice: "asc" },
	});

	return (
		<main className="min-h-screen bg-white px-4 py-10">
			<section className="mx-auto w-full max-w-4xl">
				<div className="mb-8">
					<div className="mb-5 h-1.5 w-16 bg-yellow-400" />
					<p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
						Onboarding
					</p>
					<h1 className="mt-2 text-3xl font-semibold text-zinc-950">
						Choose a plan
					</h1>
				</div>
				<OnboardingPlanPicker
					initialBillingInterval={billingInterval}
					plans={plans.map((plan) => ({
						id: plan.id,
						tier: plan.tier,
						name: plan.name,
						description: plan.description,
						monthlyPrice: Number(plan.monthlyPrice),
						quarterlyPrice: Number(plan.quarterlyPrice),
						yearlyPrice: Number(plan.yearlyPrice),
						features: planFeatures(plan),
					}))}
				/>
			</section>
		</main>
	);
}
