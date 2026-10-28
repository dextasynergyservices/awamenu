"use client";

import { useState } from "react";
import { toggleRestaurantActiveAction } from "@/actions/super-admin.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";

/**
 * Suspend a restaurant (Super Admin only), with a reason the owner sees.
 * Not for unpaid plans: those go read-only by themselves.
 */
export function SuspendRestaurantButton({
	restaurantId,
	restaurantName,
}: {
	restaurantId: string;
	restaurantName: string;
}) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<SuspendRestaurantDialog
				open={open}
				onOpenChange={setOpen}
				restaurantId={restaurantId}
				restaurantName={restaurantName}
			/>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="inline-flex h-10 items-center justify-center rounded-lg border border-red-100 bg-white px-3 text-xs font-black text-red-600 hover:bg-red-50"
			>
				Suspend restaurant
			</button>
		</>
	);
}

/** The suspend form on its own, for opening from a menu. */
export function SuspendRestaurantDialog({
	open,
	onOpenChange,
	restaurantId,
	restaurantName,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	restaurantId: string;
	restaurantName: string;
}) {
	const setOpen = onOpenChange;
	return (
		<Dialog open={open} onOpenChange={setOpen} variant="center" size="sm">
			<DialogHeader
				title="Suspend restaurant"
				description={restaurantName}
				bordered
			/>
			<DialogBody>
				<ActionForm
					action={toggleRestaurantActiveAction}
					onSuccess={() => setOpen(false)}
					className="grid gap-3"
				>
					<input type="hidden" name="restaurantId" value={restaurantId} />
					<input type="hidden" name="isActive" value="false" />
					<p className="text-sm font-medium text-slate-600">
						The menu, ordering and the owner&apos;s dashboard close until you
						restore it. Unpaid plans don&apos;t need this: they go read-only on
						their own.
					</p>
					<label className="grid gap-1.5 text-sm font-black text-slate-800">
						Reason (shown to the owner)
						<textarea
							name="reason"
							required
							minLength={3}
							maxLength={300}
							rows={3}
							className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
						/>
					</label>
					<SubmitButton
						loadingText="Suspending..."
						successText="Suspended"
						className="inline-flex min-h-11 items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-black text-white hover:bg-red-700"
					>
						Suspend
					</SubmitButton>
				</ActionForm>
			</DialogBody>
		</Dialog>
	);
}
