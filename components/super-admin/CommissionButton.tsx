"use client";

import { useState } from "react";
import {
	CommissionDialog,
	type CommissionState,
} from "@/components/super-admin/CommissionDialog";

/** "Change" link that opens the commission dialog (restaurant detail page). */
export function CommissionButton(props: {
	restaurantId: string;
	restaurantName: string;
	current: CommissionState;
	platformPercent: number;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="text-xs font-black text-emerald-700 hover:underline"
			>
				Change
			</button>
			<CommissionDialog open={open} onOpenChange={setOpen} {...props} />
		</>
	);
}
