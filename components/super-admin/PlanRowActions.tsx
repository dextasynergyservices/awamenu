"use client";

import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import {
	deletePlanAction,
	togglePlanActiveAction,
} from "@/actions/super-admin.actions";
import {
	RowActionForm,
	RowActionLink,
	RowActionSeparator,
	RowActions,
} from "@/components/ui/RowActions";

/** The "⋯" menu on a plan card. Client-side: its items take icon components. */
export function PlanRowActions({
	planId,
	planName,
	isActive,
	subscriptionCount,
}: {
	planId: string;
	planName: string;
	isActive: boolean;
	subscriptionCount: number;
}) {
	return (
		<RowActions label={`Actions for ${planName}`}>
			<RowActionLink href={`/super-admin/plans/${planId}`} icon={Pencil}>
				Edit plan
			</RowActionLink>
			<RowActionForm
				action={togglePlanActiveAction}
				fields={{ planId, isActive: String(!isActive) }}
				icon={isActive ? EyeOff : Eye}
			>
				{isActive ? "Hide from sign-up" : "Show on sign-up"}
			</RowActionForm>
			<RowActionSeparator />
			<RowActionForm
				action={deletePlanAction}
				fields={{ planId }}
				confirm={`Delete the "${planName}" plan? This cannot be undone.`}
				tone="danger"
				icon={Trash2}
				disabled={subscriptionCount > 0}
				title={
					subscriptionCount > 0
						? "Can't delete a plan that has subscriptions"
						: undefined
				}
			>
				Delete plan
			</RowActionForm>
		</RowActions>
	);
}
