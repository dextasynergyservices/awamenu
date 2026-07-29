"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { PlanEditor } from "@/components/super-admin/PlanEditor";
import { MobileModal } from "@/components/ui/MobileModal";

export function CreatePlanButton() {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 md:hidden"
			>
				<Plus className="size-4" aria-hidden="true" />
				Create New Plan
			</button>

			<MobileModal
				open={open}
				onClose={() => setOpen(false)}
				title="Create New Plan"
			>
				<div className="pb-2">
					<PlanEditor onSaved={() => setOpen(false)} />
				</div>
			</MobileModal>
		</>
	);
}
