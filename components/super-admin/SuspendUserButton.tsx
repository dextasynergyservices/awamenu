"use client";

import { useState } from "react";
import { toggleUserActiveAction } from "@/actions/super-admin.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";

export function SuspendUserButton({
	userId,
	userEmail,
}: {
	userId: string;
	userEmail: string;
}) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="inline-flex h-11 items-center justify-center rounded-lg border border-red-100 bg-white px-2.5 text-xs font-black text-red-600 hover:bg-red-50"
			>
				Suspend
			</button>

			<Dialog open={open} onOpenChange={setOpen} variant="center" size="sm">
				<DialogHeader
					title="Suspend Account"
					description={userEmail}
					bordered
				/>
				<DialogBody>
					<form action={toggleUserActiveAction} className="grid gap-3">
						<input type="hidden" name="userId" value={userId} />
						<input type="hidden" name="isActive" value="false" />
						<div>
							<label
								htmlFor="reason"
								className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500"
							>
								Reason
							</label>
							<textarea
								id="reason"
								name="reason"
								required
								rows={3}
								placeholder="Why is this account being suspended?"
								className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base font-medium text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							/>
							<p className="mt-1 text-xs font-medium text-slate-400">
								Shown to the owner when they try to log in.
							</p>
						</div>
						<SubmitButton
							loadingText="Suspending..."
							successText="Suspended"
							onSuccess={() => setOpen(false)}
							className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-red-100 bg-white text-xs font-black text-red-600 hover:bg-red-50"
						>
							Confirm Suspension
						</SubmitButton>
					</form>
				</DialogBody>
			</Dialog>
		</>
	);
}
