"use client";

import Link from "next/link";

type ErrorPageProps = {
	error: Error & { digest?: string };
	reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorPageProps) {
	return (
		<main className="min-h-screen bg-[#f6faf7] px-4 py-8 text-slate-950">
			<section className="mx-auto max-w-lg rounded-3xl border border-red-100 bg-white p-5 text-center shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
				<p className="text-sm font-black uppercase tracking-wide text-red-700">
					Something went wrong
				</p>
				<h1 className="mt-3 text-2xl font-black">
					We could not load this page
				</h1>
				<p className="mt-3 text-sm font-bold leading-6 text-slate-600">
					Please try again. If it still does not work, contact the restaurant
					with the code or link you are trying to open.
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
						href="/"
						className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700"
					>
						Go home
					</Link>
				</div>
			</section>
		</main>
	);
}
