"use client";

import { useState } from "react";
import { assignRestaurantPlanAction } from "@/actions/super-admin.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { MobileModal } from "@/components/ui/MobileModal";

type PlanOption = { id: string; name: string };

export function ChangePlanButton({
	restaurantId,
	currentPlanId,
	currentPlanName,
	plans,
}: {
	restaurantId: string;
	currentPlanId?: string;
	currentPlanName: string;
	plans: PlanOption[];
}) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50 md:hidden"
			>
				Change Plan
				<span className="truncate text-xs font-medium text-slate-400">
					{currentPlanName}
				</span>
			</button>

			<MobileModal
				open={open}
				onClose={() => setOpen(false)}
				title="Change Plan"
				description={`Current plan: ${currentPlanName}`}
			>
				<form action={assignRestaurantPlanAction} className="grid gap-3 pb-2">
					<input type="hidden" name="restaurantId" value={restaurantId} />
					<select
						name="planId"
						defaultValue={currentPlanId ?? ""}
						required
						className="h-11 rounded-lg border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					>
						<option value="" disabled>
							Select a plan
						</option>
						{plans.map((plan) => (
							<option key={plan.id} value={plan.id}>
								{plan.name}
							</option>
						))}
					</select>
					<SubmitButton
						loadingText="Assigning..."
						successText="Assigned"
						onSuccess={() => setOpen(false)}
						className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
					>
						Confirm Plan Change
					</SubmitButton>
				</form>
			</MobileModal>
		</>
	);
}
