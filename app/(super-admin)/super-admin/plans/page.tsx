import Link from "next/link";
import {
	deletePlanAction,
	togglePlanActiveAction,
} from "@/actions/super-admin.actions";
import { CreatePlanButton } from "@/components/super-admin/CreatePlanButton";
import { PlanEditor } from "@/components/super-admin/PlanEditor";
import { SubmitButton } from "@/components/ui/action-button";
import { ConfirmForm } from "@/components/ui/confirm-form";
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
						<div className="mb-2 flex items-center justify-between">
							<h2 className="text-base font-black text-slate-950 sm:text-lg">
								{plan.name}
							</h2>
							<span
								className={`rounded-full px-2 py-0.5 text-[11px] font-black sm:text-xs ${
									plan.isActive
										? "bg-emerald-100 text-emerald-700"
										: "bg-slate-100 text-slate-500"
								}`}
							>
								{plan.isActive ? "Active" : "Hidden"}
							</span>
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
							className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50 md:h-9"
						>
							Edit Plan
						</Link>
						<div className="mt-2 grid grid-cols-2 gap-2">
							<form action={togglePlanActiveAction}>
								<input type="hidden" name="planId" value={plan.id} />
								<input
									type="hidden"
									name="isActive"
									value={(!plan.isActive).toString()}
								/>
								<SubmitButton
									loadingText="Updating..."
									successText="Updated"
									className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-slate-200 text-xs font-black text-slate-700 hover:bg-slate-50 md:h-9"
								>
									{plan.isActive ? "Disable" : "Enable"}
								</SubmitButton>
							</form>
							<ConfirmForm
								action={deletePlanAction}
								hiddenFields={{ planId: plan.id }}
								confirmMessage={`Delete the "${plan.name}" plan? This cannot be undone.`}
							>
								<SubmitButton
									loadingText="Deleting..."
									successText="Deleted"
									disabled={plan._count.subscriptions > 0}
									title={
										plan._count.subscriptions > 0
											? "Cannot delete a plan with active subscriptions"
											: undefined
									}
									className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-red-100 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-40 md:h-9"
								>
									Delete
								</SubmitButton>
							</ConfirmForm>
						</div>
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
