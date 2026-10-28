"use client";

import { useState } from "react";
import { toggleUserActiveAction } from "@/actions/super-admin.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";

/** Asks for the reason, then suspends the account (blocks sign-in). */
export function SuspendUserDialog({
	userId,
	userEmail,
	open,
	onOpenChange,
}: {
	userId: string;
	userEmail: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange} variant="center" size="sm">
			<DialogHeader title="Suspend account" description={userEmail} bordered />
			<DialogBody>
				<ActionForm action={toggleUserActiveAction} className="grid gap-3">
					<input type="hidden" name="userId" value={userId} />
					<input type="hidden" name="isActive" value="false" />
					<div>
						<label
							htmlFor={`reason-${userId}`}
							className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500"
						>
							Reason
						</label>
						<textarea
							id={`reason-${userId}`}
							name="reason"
							required
							rows={3}
							placeholder="Why is this account being suspended?"
							className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base font-medium text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 md:text-sm"
						/>
						<p className="mt-1 text-xs font-medium text-slate-400">
							Shown to the owner when they try to sign in. Their restaurant
							isn&apos;t affected; suspend that separately if needed.
						</p>
					</div>
					<SubmitButton
						loadingText="Suspending..."
						successText="Suspended"
						onSuccess={() => onOpenChange(false)}
						className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-red-600 text-xs font-black text-white hover:bg-red-700"
					>
						Suspend account
					</SubmitButton>
				</ActionForm>
			</DialogBody>
		</Dialog>
	);
}

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
				className="inline-flex h-9 items-center justify-center rounded-lg border border-red-100 bg-white px-2.5 text-xs font-bold text-red-600 hover:bg-red-50"
			>
				Suspend account
			</button>
			<SuspendUserDialog
				userId={userId}
				userEmail={userEmail}
				open={open}
				onOpenChange={setOpen}
			/>
		</>
	);
}
