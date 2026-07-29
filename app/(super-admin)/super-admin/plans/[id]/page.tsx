import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlanEditor } from "@/components/super-admin/PlanEditor";
import { db } from "@/lib/db";

export default async function SuperAdminPlanEditPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const plan = await db.plan.findUnique({ where: { id } });

	if (!plan) notFound();

	return (
		<div className="grid max-w-2xl gap-6">
			<div>
				<Link
					href="/super-admin/plans"
					className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900"
				>
					<ArrowLeft className="size-3.5" /> Back to Plans
				</Link>
				<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
					Edit {plan.name}
				</h1>
			</div>
			<PlanEditor plan={plan} />
		</div>
	);
}
