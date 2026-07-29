import { choosePlanAction } from "@/actions/onboarding.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { db } from "@/lib/db";

export default async function ChoosePlanPage() {
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
				<div className="grid gap-4 md:grid-cols-3">
					{plans.map((plan) => (
						<form
							key={plan.id}
							action={choosePlanAction}
							className="border border-emerald-800/20 bg-white p-5 shadow-[0_10px_30px_rgba(22,101,52,0.06)]"
						>
							<input type="hidden" name="planId" value={plan.id} />
							<h2 className="text-xl font-semibold text-zinc-950">
								{plan.name}
							</h2>
							<p className="mt-2 min-h-12 text-sm text-zinc-600">
								{plan.description}
							</p>
							<p className="mt-5 text-2xl font-semibold text-zinc-950">
								₦{Number(plan.monthlyPrice).toLocaleString()}
								<span className="text-sm font-normal text-emerald-700">
									/mo
								</span>
							</p>
							<SubmitButton
								loadingText="Selecting..."
								successText="Selected"
								className="mt-5 h-11 w-full bg-emerald-700 px-4 text-sm font-semibold uppercase tracking-widest text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
							>
								Select
							</SubmitButton>
						</form>
					))}
				</div>
			</section>
		</main>
	);
}
