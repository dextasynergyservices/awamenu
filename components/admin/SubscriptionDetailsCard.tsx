"use client";

import { ArrowUpRight, Crown, FileText } from "lucide-react";
import Link from "next/link";
import { SettingsCard } from "@/components/admin/SettingsCard";
import { BillingStateBadge } from "@/components/super-admin/BillingStateBadge";
import type { BillingState } from "@/lib/billing-state";

/**
 * Plan summary in Settings. Only facts about this restaurant's plan (it used
 * to list "Advanced analytics" and "Priority support" on every plan); the
 * details, invoices and payment controls live on the Billing page.
 */
export function SubscriptionDetailsCard({
	planName,
	state,
	periodEnd,
	autoRenew,
	slug,
}: {
	planName: string | null;
	state: BillingState;
	/** ISO, paid plans only. */
	periodEnd: string | null;
	autoRenew: boolean;
	slug: string;
}) {
	const ended = state === "GRACE" || state === "LAPSED";
	return (
		<SettingsCard
			title="Plan & billing"
			description="Your subscription, invoices and payment method."
			icon={Crown}
		>
			<div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4">
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-lg font-black text-slate-950">
						{planName ?? "No plan"}
					</span>
					<BillingStateBadge state={state} />
				</div>
				{periodEnd ? (
					<p className="mt-1 text-xs font-medium text-slate-600">
						{ended
							? "Ended"
							: autoRenew
								? "Renews automatically on"
								: "Ends on"}{" "}
						{new Intl.DateTimeFormat("en-GB", {
							day: "numeric",
							month: "long",
							year: "numeric",
						}).format(new Date(periodEnd))}
					</p>
				) : null}
				<div className="mt-3 flex flex-wrap gap-2">
					<Link
						href={`/dashboard/${slug}/billing`}
						className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"
					>
						<FileText className="size-3.5" aria-hidden="true" />
						Billing & invoices
					</Link>
					<Link
						href={`/dashboard/${slug}/settings/plan`}
						className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
					>
						<ArrowUpRight className="size-3.5" aria-hidden="true" />
						Change plan
					</Link>
				</div>
			</div>
		</SettingsCard>
	);
}
