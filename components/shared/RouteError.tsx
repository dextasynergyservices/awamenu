"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

type RouteErrorProps = {
	error: Error & { digest?: string };
	reset: () => void;
	title?: string;
	message?: string;
	homeHref?: string;
	homeLabel?: string;
	/** "page" — full-screen card (public customer routes).
	 *  "panel" — fits inside an existing dashboard/staff/admin shell. */
	variant?: "page" | "panel";
};

/**
 * Shared route-level error boundary body. Each route's `error.tsx` is a
 * thin wrapper around this so the fallback UI stays consistent across the
 * app instead of every route hand-rolling its own.
 */
export function RouteError({
	error,
	reset,
	title = "We could not load this page",
	message = "Please try again. If it still does not work, refresh or come back later.",
	homeHref = "/",
	homeLabel = "Go home",
	variant = "page",
}: RouteErrorProps) {
	// Server-render errors already reach Sentry via `onRequestError` in
	// instrumentation.ts, but errors thrown during client rendering never did —
	// they only ever painted this card, which is why some production failures
	// had no corresponding Sentry event to diagnose from.
	useEffect(() => {
		Sentry.captureException(error);
	}, [error]);

	const card = (
		<section className="mx-auto max-w-lg rounded-3xl border border-red-100 bg-white p-5 text-center shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
			<p className="text-sm font-black uppercase tracking-wide text-red-700">
				Something went wrong
			</p>
			<h1 className="mt-3 text-2xl font-black">{title}</h1>
			<p className="mt-3 text-sm font-bold leading-6 text-slate-600">
				{message}
			</p>
			{error.digest ? (
				<p className="mt-4 break-all rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-500">
					Error reference: {error.digest}
				</p>
			) : null}
			<div className="mt-5 grid gap-2 sm:grid-cols-2">
				<button
					type="button"
					onClick={reset}
					className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-black text-white"
				>
					Try again
				</button>
				<Link
					href={homeHref}
					className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700"
				>
					{homeLabel}
				</Link>
			</div>
		</section>
	);

	if (variant === "panel") {
		return <div className="py-6">{card}</div>;
	}

	return (
		<main className="min-h-screen bg-[#f6faf7] px-4 py-8 text-slate-950">
			{card}
		</main>
	);
}
