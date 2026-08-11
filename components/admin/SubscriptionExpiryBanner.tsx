"use client";

import { AlertTriangle, ArrowRight, CalendarClock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type SubscriptionExpiryBannerProps = {
	slug: string;
	planName: string;
	/** ISO string — serialisable across the server/client boundary. */
	currentPeriodEnd: string;
	/** Days of grace granted after expiry before suspension. */
	graceDays: number;
	/** Whether Paystack will charge them automatically. */
	autoRenew: boolean;
};

type Remaining = {
	days: number;
	hours: number;
	minutes: number;
	seconds: number;
	totalMs: number;
};

function getRemaining(target: number): Remaining {
	const totalMs = Math.max(0, target - Date.now());
	const totalSeconds = Math.floor(totalMs / 1000);
	return {
		days: Math.floor(totalSeconds / 86400),
		hours: Math.floor((totalSeconds % 86400) / 3600),
		minutes: Math.floor((totalSeconds % 3600) / 60),
		seconds: totalSeconds % 60,
		totalMs,
	};
}

function Unit({ value, label }: { value: number; label: string }) {
	return (
		<div className="flex min-w-[3.25rem] flex-col items-center rounded-xl bg-white/70 px-2 py-1.5">
			<span className="font-black text-lg tabular-nums leading-none">
				{String(value).padStart(2, "0")}
			</span>
			<span className="mt-0.5 text-[10px] font-bold uppercase tracking-wide opacity-70">
				{label}
			</span>
		</div>
	);
}

/**
 * Countdown shown in the restaurant dashboard once a paid plan is within a
 * week of expiring, and through the grace period after it lapses.
 *
 * Ticks on the client so the countdown is live, but the *decision* to render is
 * made server-side — the dashboard layout only mounts this when the plan is
 * genuinely inside the window, so nothing here can be spoofed into hiding or
 * showing itself.
 */
export function SubscriptionExpiryBanner({
	slug,
	planName,
	currentPeriodEnd,
	graceDays,
	autoRenew,
}: SubscriptionExpiryBannerProps) {
	const expiresAt = new Date(currentPeriodEnd).getTime();
	const suspendsAt = expiresAt + graceDays * 86400 * 1000;

	const [now, setNow] = useState<number | null>(null);

	useEffect(() => {
		// Seeded in an effect rather than during render so the server-rendered
		// markup and first client render agree (no hydration mismatch), then
		// ticks every second.
		setNow(Date.now());
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);

	const hasExpired = now !== null && now >= expiresAt;
	const target = hasExpired ? suspendsAt : expiresAt;
	const remaining = getRemaining(target);

	const tone = hasExpired
		? "border-red-200 bg-red-50 text-red-900"
		: remaining.days <= 2
			? "border-orange-200 bg-orange-50 text-orange-900"
			: "border-amber-200 bg-amber-50 text-amber-900";

	const Icon = hasExpired ? AlertTriangle : CalendarClock;

	const heading = hasExpired
		? `${planName} has expired — grace period ends in`
		: autoRenew
			? `${planName} renews in`
			: `${planName} expires in`;

	const detail = hasExpired
		? "Renew now to avoid your menu going offline and your dashboard being locked."
		: autoRenew
			? "Your saved card will be charged automatically. Make sure it's still valid."
			: "Auto-renewal is off, so your menu will go offline unless you renew.";

	return (
		<section
			className={`mb-4 rounded-2xl border p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)] ${tone}`}
			aria-live="polite"
		>
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-start gap-3">
					<span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white/70">
						<Icon className="size-4" aria-hidden="true" />
					</span>
					<div className="min-w-0">
						<p className="text-sm font-black">{heading}</p>
						<p className="mt-0.5 text-xs font-medium opacity-80">{detail}</p>
					</div>
				</div>

				<div className="flex items-center gap-3">
					{now === null ? (
						// Placeholder of the same footprint until the clock starts.
						<div className="h-[3.25rem] w-[14rem] animate-pulse rounded-xl bg-white/50" />
					) : (
						<div className="flex items-center gap-1.5">
							<Unit value={remaining.days} label="days" />
							<Unit value={remaining.hours} label="hrs" />
							<Unit value={remaining.minutes} label="min" />
							<Unit value={remaining.seconds} label="sec" />
						</div>
					)}

					<Link
						href={`/dashboard/${slug}/settings`}
						className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-800"
					>
						Renew
						<ArrowRight className="size-4" aria-hidden="true" />
					</Link>
				</div>
			</div>
		</section>
	);
}
