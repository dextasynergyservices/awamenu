import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
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
	maxCategories: number;
	maxMenuItems: number;
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
			maxCategories: true,
			maxMenuItems: true,
			advancedAnalytics: true,
			removeAwamenuBranding: true,
			whatsappIntegration: true,
			prioritySupport: true,
			basicSupport: true,
		},
	});

	return (
		<main className="min-h-screen bg-[#f6faf7] px-4 py-6 text-slate-950 sm:py-8">
			<div className="mx-auto max-w-lg">
				<Link href="/" className="text-sm font-black text-emerald-700">
					Back to home
				</Link>

				<div className="mt-5 text-center">
					<p className="text-xs font-black uppercase tracking-widest text-emerald-700">
						Pricing
					</p>
					<h1 className="mt-2 text-3xl font-black tracking-tight">
						Choose a plan and launch today
					</h1>
					<p className="mt-2 text-sm font-medium text-slate-600">
						No hidden fees. Upgrade or downgrade anytime.
					</p>
				</div>

				<div className="mt-8 grid gap-4">
					{plans.map((plan) => (
						<section
							key={plan.id}
							className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]"
						>
							<h2 className="text-xl font-black">{plan.name}</h2>
							<p className="mt-1 min-h-10 text-sm font-medium text-slate-500">
								{plan.description}
							</p>
							<p className="mt-4 text-3xl font-black">
								₦{Number(plan.monthlyPrice).toLocaleString()}
								<span className="text-sm font-bold text-slate-500">/mo</span>
							</p>
							<ul className="mt-5 grid gap-2.5 text-sm font-semibold text-slate-700">
								{planFeatures(plan).map((feature) => (
									<li key={feature} className="flex items-start gap-2">
										<Check
											className="mt-0.5 size-4 shrink-0 text-emerald-700"
											aria-hidden="true"
										/>
										<span>{feature}</span>
									</li>
								))}
							</ul>
							<Link
								href={`/signup?plan=${plan.tier.toLowerCase()}`}
								className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
							>
								Choose {plan.name}
							</Link>
						</section>
					))}
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
	);
}
