"use client";

import { CreditCard } from "lucide-react";
import { useState } from "react";
import { ManageBillingModal } from "@/components/admin/ManageBillingModal";

/** Opens the existing card / auto-renew / cancel controls. */
export function BillingManageButton({
	planName,
	status,
	currentPeriodEnd,
	hasCard,
	slug,
	label = "Payment method & auto-renew",
}: {
	planName: string;
	status: string;
	currentPeriodEnd: string | null;
	hasCard: boolean;
	slug: string;
	label?: string;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
			>
				<CreditCard className="size-3.5" aria-hidden="true" />
				{label}
			</button>
			{open ? (
				<ManageBillingModal
					planName={planName}
					status={status}
					currentPeriodEnd={
						currentPeriodEnd ? new Date(currentPeriodEnd) : null
					}
					hasCard={hasCard}
					slug={slug}
					onClose={() => setOpen(false)}
				/>
			) : null}
		</>
	);
}
