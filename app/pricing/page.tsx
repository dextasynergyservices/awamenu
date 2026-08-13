import type { Metadata } from "next";
import Link from "next/link";
import { MarketingBottomNav } from "@/components/marketing/MarketingBottomNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { PublicPricingPlans } from "@/components/pricing/PublicPricingPlans";
import { db } from "@/lib/db";

export const metadata: Metadata = {
	title: "Pricing — AwaMenu",
	description: "Choose a plan and launch your restaurant's digital menu today.",
};

type PricingPlan = {
	id: string;
	tier: string;
	name: string;
	description: string | null;
	monthlyPrice: unknown;
	quarterlyPrice: unknown;
	yearlyPrice: unknown;
	maxCategories: number;
	maxMenuItems: number;
	maxTables: number;
	advancedAnalytics: boolean;
	removeAwamenuBranding: boolean;
	whatsappIntegration: boolean;
	prioritySupport: boolean;
	basicSupport: boolean;
};

function formatLimit(value: number, label: string) {
	return value === -1 ? `Unlimited ${label}` : `${value} ${label}`;
}

function planFeatures(plan: PricingPlan) {
	return [
		formatLimit(plan.maxCategories, "Categories"),
		formatLimit(plan.maxMenuItems, "Items"),
		formatLimit(plan.maxTables, "Tables"),
		plan.whatsappIntegration
			? "WhatsApp chat included"
			: "WhatsApp chat not included",
		plan.advancedAnalytics ? "Advanced Analytics" : "Basic Analytics",
		plan.removeAwamenuBranding ? "Remove Branding" : "AwaMenu branding shown",
		plan.prioritySupport
			? "Priority Support"
			: plan.basicSupport
				? "Basic Support"
				: "Standard Support",
	];
}

export default async function PricingPage() {
	const plans: PricingPlan[] = await db.plan.findMany({
		where: { isActive: true },
		orderBy: { monthlyPrice: "asc" },
		select: {
			id: true,
			tier: true,
			name: true,
			description: true,
			monthlyPrice: true,
			quarterlyPrice: true,
			yearlyPrice: true,
			maxCategories: true,
			maxMenuItems: true,
			maxTables: true,
			advancedAnalytics: true,
			removeAwamenuBranding: true,
			whatsappIntegration: true,
			prioritySupport: true,
			basicSupport: true,
		},
	});

	return (
		<>
			<main className="min-h-screen bg-[#f6faf7] pt-2 pb-24 text-slate-950 md:pb-8">
				<MarketingHeader variant="light" />

				<div className="mx-auto max-w-6xl px-4 pt-6 sm:pt-8 lg:px-8">
					<div className="mx-auto max-w-2xl text-center">
						<p className="text-xs font-black uppercase tracking-widest text-emerald-700">
							Pricing
						</p>
						<h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
							Choose a plan and launch today
						</h1>
						<p className="mt-2 text-sm font-medium text-slate-600 sm:text-base">
							No hidden fees. Upgrade or downgrade anytime.
						</p>
					</div>

					<div className="mt-8">
						<PublicPricingPlans
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

					<p className="mt-8 text-center text-xs font-bold text-slate-400">
						Questions about a plan?{" "}
						<Link href="/about" className="text-emerald-700 underline">
							Get in touch
						</Link>
						.
					</p>
				</div>
			</main>
			<MarketingFooter />
			<MarketingBottomNav />
		</>
	);
}
