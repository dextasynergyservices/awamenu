import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChangePlanPicker } from "@/components/admin/ChangePlanPicker";
import { requireUser } from "@/lib/auth-guards";
import { parseBillingInterval } from "@/lib/billing";
import { db } from "@/lib/db";

function formatLimit(value: number, label: string) {
	return value === -1 ? `Unlimited ${label}` : `${value} ${label}`;
}

function planFeatures(plan: {
	maxCategories: number;
	maxMenuItems: number;
	maxTables: number;
	whatsappIntegration: boolean;
	advancedAnalytics: boolean;
	removeAwamenuBranding: boolean;
	prioritySupport: boolean;
	basicSupport: boolean;
}) {
	return [
		formatLimit(plan.maxCategories, "Categories"),
		formatLimit(plan.maxMenuItems, "Items"),
		formatLimit(plan.maxTables, "Tables"),
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

export default async function ChangePlanPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const user = await requireUser();
	const { slug } = await params;

	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		include: { subscription: true },
	});

	if (!restaurant) redirect("/dashboard");

	const plans = await db.plan.findMany({
		where: { isActive: true },
		orderBy: { monthlyPrice: "asc" },
	});

	const currentPlanId = restaurant.subscription?.planId;

	return (
		<div className="grid max-w-4xl gap-5 md:gap-8">
			<div>
				<Link
					href={`/dashboard/${slug}/settings`}
					className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 md:mb-6 md:gap-2 md:text-sm"
				>
					<ArrowLeft className="size-3.5 md:size-4" />
					Back to Settings
				</Link>
				<h1 className="text-sm font-black text-slate-950 md:text-3xl">
					Change Plan
				</h1>
				<p className="mt-1 text-xs font-medium text-slate-600 md:mt-2 md:text-base">
					Select a new plan for your restaurant. Your current subscription will
					be cancelled and replaced.
				</p>
			</div>

			<ChangePlanPicker
				slug={slug}
				currentPlanId={currentPlanId}
				currentBillingInterval={parseBillingInterval(
					restaurant.subscription?.billingInterval,
				)}
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
		</div>
	);
}
