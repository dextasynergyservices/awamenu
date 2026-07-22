import Link from "next/link";
import { PlanEditor } from "@/components/super-admin/PlanEditor";
import { db } from "@/lib/db";

export default async function SuperAdminPlansPage() {
	const plans = await db.plan.findMany({ orderBy: { monthlyPrice: "asc" } });

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

			<div className="grid gap-4 md:grid-cols-3">
				{plans.map((plan) => (
					<div
						key={plan.id}
						className="rounded-2xl border border-slate-100 bg-white p-5"
					>
						<div className="mb-2 flex items-center justify-between">
							<h2 className="text-lg font-black text-slate-950">{plan.name}</h2>
							<span
								className={`rounded-full px-2 py-0.5 text-xs font-black ${
									plan.isActive
										? "bg-emerald-100 text-emerald-700"
										: "bg-slate-100 text-slate-500"
								}`}
							>
								{plan.isActive ? "Active" : "Hidden"}
							</span>
						</div>
						<p className="text-2xl font-black text-slate-950">
							₦{Number(plan.monthlyPrice).toLocaleString()}
							<span className="text-xs font-medium text-slate-500">/mo</span>
						</p>
						<p className="mt-2 text-xs font-medium leading-5 text-slate-500">
							{plan.description}
						</p>
						<Link
							href={`/super-admin/plans/${plan.id}`}
							className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50"
						>
							Edit Plan
						</Link>
					</div>
				))}
			</div>

			<div>
				<h2 className="mb-3 text-lg font-black text-slate-950">
					Create New Plan
				</h2>
				<PlanEditor />
			</div>
		</div>
	);
}
