import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { changePlanAction } from "@/actions/billing.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";

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

			<div className="grid gap-4 md:grid-cols-3">
				{plans.map((plan) => {
					const isCurrent = plan.id === currentPlanId;

					return (
						<form
							key={plan.id}
							action={changePlanAction}
							className={`relative overflow-hidden rounded-3xl border p-6 transition-all ${
								isCurrent
									? "border-emerald-500 bg-emerald-50 shadow-sm"
									: "border-slate-200 bg-white shadow-sm hover:border-emerald-200 hover:shadow-md"
							}`}
						>
							{isCurrent && (
								<div className="absolute top-0 right-0 rounded-bl-xl bg-emerald-500 px-3 py-1 text-xs font-black uppercase tracking-wider text-white">
									Current Plan
								</div>
							)}
							<input type="hidden" name="planId" value={plan.id} />
							<input type="hidden" name="slug" value={slug} />

							<h2 className="text-sm font-black text-slate-950 md:text-xl">
								{plan.name}
							</h2>
							<p className="mt-1 min-h-12 text-xs font-medium text-slate-600 md:mt-2 md:text-sm">
								{plan.description}
							</p>
							<p className="mt-4 text-xl font-black text-slate-950 md:mt-6 md:text-3xl">
								₦{Number(plan.monthlyPrice).toLocaleString()}
								<span className="text-xs font-medium text-slate-500 md:text-sm">
									/mo
								</span>
							</p>
							<SubmitButton
								disabled={isCurrent}
								loadingText="Processing..."
								successText="Redirecting..."
								className={`mt-4 h-11 w-full rounded-2xl px-4 text-xs font-black transition-colors md:mt-6 md:h-12 md:text-sm ${
									isCurrent
										? "bg-slate-100 text-slate-400 cursor-not-allowed"
										: "bg-emerald-700 text-white hover:bg-emerald-800"
								}`}
							>
								{isCurrent ? "Current Plan" : "Switch to this Plan"}
							</SubmitButton>
						</form>
					);
				})}
			</div>
		</div>
	);
}
