import Link from "next/link";
import { CreatePlanButton } from "@/components/super-admin/CreatePlanButton";
import { PlanEditor } from "@/components/super-admin/PlanEditor";
import { PlanRowActions } from "@/components/super-admin/PlanRowActions";
import { db } from "@/lib/db";

export default async function SuperAdminPlansPage() {
	const plans = await db.plan.findMany({
		orderBy: { monthlyPrice: "asc" },
		include: { _count: { select: { subscriptions: true } } },
	});

	return (
		<div className="grid gap-6">
			<div>
				<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
					Plans
				</h1>
				<p className="mt-1 text-sm font-medium text-slate-600">
					Manage subscription plans and feature gating.
				</p>
			</div>

			<div className="grid gap-3 sm:gap-4 md:grid-cols-3">
				{plans.map((plan) => (
					<div
						key={plan.id}
						className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5"
					>
						<div className="mb-2 flex items-center justify-between gap-2">
							<h2 className="text-base font-black text-slate-950 sm:text-lg">
								{plan.name}
							</h2>
							<div className="flex items-center gap-1">
								<span
									className={`rounded-full px-2 py-0.5 text-[11px] font-black sm:text-xs ${
										plan.isActive
											? "bg-emerald-100 text-emerald-700"
											: "bg-slate-100 text-slate-500"
									}`}
								>
									{plan.isActive ? "Active" : "Hidden"}
								</span>
								<PlanRowActions
									planId={plan.id}
									planName={plan.name}
									isActive={plan.isActive}
									subscriptionCount={plan._count.subscriptions}
								/>
							</div>
						</div>
						<p className="text-xl font-black text-slate-950 sm:text-2xl">
							₦{Number(plan.monthlyPrice).toLocaleString()}
							<span className="text-xs font-medium text-slate-500">/mo</span>
						</p>
						<div className="mt-2 grid gap-1 text-xs font-bold text-slate-500">
							<p>Quarterly: ₦{Number(plan.quarterlyPrice).toLocaleString()}</p>
							<p>Yearly: ₦{Number(plan.yearlyPrice).toLocaleString()}</p>
						</div>
						<p className="mt-2 text-xs font-medium leading-5 text-slate-500">
							{plan.description}
						</p>
						<Link
							href={`/super-admin/plans/${plan.id}`}
							className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 md:h-9"
						>
							Edit plan
						</Link>
					</div>
				))}
			</div>

			<CreatePlanButton />

			<div className="hidden md:block">
				<h2 className="mb-3 text-lg font-black text-slate-950">
					Create New Plan
				</h2>
				<PlanEditor />
			</div>
		</div>
	);
}
