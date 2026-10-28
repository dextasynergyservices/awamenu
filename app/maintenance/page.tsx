import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Down for maintenance | AwaMenu",
	robots: { index: false },
};

/**
 * Shown for every page while maintenance mode is on (see proxy.ts). Also
 * reachable directly, which is harmless.
 */
export default function MaintenancePage() {
	return (
		<main className="min-h-screen bg-[#f6faf7] px-4 py-8 text-slate-950">
			<section className="mx-auto mt-16 max-w-lg rounded-3xl border border-emerald-100 bg-white p-6 text-center shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
				<p className="text-sm font-black uppercase tracking-wide text-emerald-700">
					Back shortly
				</p>
				<h1 className="mt-3 text-2xl font-black">
					AwaMenu is down for maintenance
				</h1>
				<p className="mt-3 text-sm font-bold leading-6 text-slate-600">
					We&apos;re making some improvements and will be back in a few minutes.
					Payments you have already made are safe and will be confirmed
					automatically.
				</p>
			</section>
		</main>
	);
}
