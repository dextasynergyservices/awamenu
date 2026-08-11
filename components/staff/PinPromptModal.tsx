"use client";

import { IdCard } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";

/**
 * Asks which staff member is performing an action, so it can be attributed to
 * them on the order timeline.
 *
 * This asks for the Staff ID, not a separate PIN. The dashboard is already
 * unlocked by the restaurant's shared password, so a second secret here read as
 * another login and confused staff — and the Staff ID is the code the owner
 * already has in front of them to hand out.
 */
export function PinPromptModal({
	onPinEnter,
	onClose,
}: {
	/** Receives the entered Staff ID. */
	onPinEnter: (staffId: string) => void;
	onClose: () => void;
}) {
	const [staffId, setStaffId] = useState("");
	const trimmed = staffId.trim();

	function handleFormSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (trimmed.length >= 4) onPinEnter(trimmed.toUpperCase());
	}

	return (
		<Dialog
			open
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			size="sm"
		>
			<DialogHeader title="Who's doing this?" />
			<DialogBody>
				<form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
					<div className="w-full">
						<label
							htmlFor="staff-id"
							className="mb-2 block text-center text-xs font-bold text-slate-700"
						>
							Enter your Staff ID
						</label>
						<div className="relative">
							<IdCard
								className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
								aria-hidden="true"
							/>
							<input
								id="staff-id"
								type="text"
								inputMode="text"
								autoCapitalize="characters"
								autoComplete="off"
								maxLength={12}
								value={staffId}
								onChange={(e) =>
									setStaffId(e.target.value.replace(/\s/g, "").toUpperCase())
								}
								placeholder="e.g. 7K2M9Q"
								className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 text-center text-xl font-black tracking-widest text-slate-950 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200 sm:py-3 sm:text-2xl"
								required
							/>
						</div>
						<p className="mt-2 text-center text-xs font-medium text-slate-500">
							Ask your manager if you don&apos;t know yours.
						</p>
					</div>
					<button
						type="submit"
						disabled={trimmed.length < 4}
						className="min-h-10 w-full rounded-xl bg-emerald-700 text-sm font-black text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
					>
						Confirm
					</button>
				</form>
			</DialogBody>
		</Dialog>
	);
}
