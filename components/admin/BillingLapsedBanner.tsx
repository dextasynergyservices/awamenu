"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { renewOrUpgradeAction } from "@/actions/subscription-lifecycle.actions";
import { SubmitButton } from "@/components/ui/action-button";

const naira = new Intl.NumberFormat("en-NG", {
	style: "currency",
	currency: "NGN",
	maximumFractionDigits: 0,
});

/**
 * Shown on every dashboard page while a paid plan is lapsed (or no plan was
 * ever chosen). The dashboard stays open read-only; this says why, what
 * customers see, and offers one-tap payment of what's owed.
 */
export function BillingLapsedBanner({
	restaurantId,
	slug,
	plan,
	intervalLabel,
	expiredOn,
}: {
	restaurantId: string;
	slug: string;
	/** The plan to renew; null when there's no plan at all. */
	plan: { id: string; name: string; price: number; interval: string } | null;
	intervalLabel: string | null;
	/** "11 Sep 2026" */
	expiredOn: string | null;
}) {
	return (
		<section
			role="alert"
			className="mb-4 rounded-2xl border border-red-200 print:hidden bg-red-50 p-4 text-red-950 shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
		>
			<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div className="flex items-start gap-3">
					<span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white/80 text-red-700">
						<Lock className="size-4" aria-hidden="true" />
					</span>
					<div className="min-w-0">
						<p className="text-sm font-black">
							{plan
								? `Your ${plan.name} plan expired${expiredOn ? ` on ${expiredOn}` : ""}. Your restaurant is read-only.`
								: "Choose a plan to start using your restaurant."}
						</p>
						<p className="mt-1 text-xs font-medium leading-5 text-red-900/80">
							Customers can still see your menu but can&apos;t order or book.
							You can finish orders and bookings already in progress, but
							changes are paused. Everything comes back the moment you pay.
						</p>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-2 lg:shrink-0">
					{plan && plan.price > 0 ? (
						<form action={renewOrUpgradeAction}>
							<input type="hidden" name="restaurantId" value={restaurantId} />
							<input type="hidden" name="planId" value={plan.id} />
							<input
								type="hidden"
								name="billingInterval"
								value={plan.interval}
							/>
							<input type="hidden" name="slug" value={slug} />
							<SubmitButton
								loadingText="Opening payment..."
								className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
							>
								Pay {naira.format(plan.price)}
								{intervalLabel ? ` · ${intervalLabel}` : ""} and reactivate
							</SubmitButton>
						</form>
					) : null}
					<Link
						href={`/dashboard/${slug}/renew`}
						className="inline-flex min-h-11 items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-sm font-black text-red-800 hover:bg-red-100/50"
					>
						{plan ? "Other options" : "Choose a plan"}
					</Link>
				</div>
			</div>
		</section>
	);
}
