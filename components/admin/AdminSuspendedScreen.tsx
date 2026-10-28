"use client";

import { LogOut, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * A restaurant the Super Admin suspended. Billing never lands here (a lapsed
 * plan is read-only instead), so this is about the account, not payment.
 */
export function AdminSuspendedScreen({
	restaurantName,
	reason,
	since,
	supportEmail,
}: {
	restaurantName: string;
	reason: string | null;
	/** "11 Sep 2026" */
	since: string | null;
	supportEmail: string;
}) {
	const router = useRouter();
	const [signingOut, setSigningOut] = useState(false);

	return (
		<main className="grid min-h-screen place-items-center bg-[#f6faf7] px-4 py-8">
			<section className="mx-auto w-full max-w-lg rounded-3xl border border-red-100 bg-white p-6 text-center shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
				<span className="mx-auto grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600">
					<ShieldAlert className="size-7" aria-hidden="true" />
				</span>
				<p className="mt-4 text-xs font-black uppercase tracking-widest text-red-700">
					Restaurant suspended
				</p>
				<h1 className="mt-2 text-2xl font-black text-slate-950">
					{restaurantName} is suspended by AwaMenu
				</h1>
				<p className="mt-3 text-sm font-medium leading-6 text-slate-600">
					Your menu and dashboard are unavailable
					{since ? ` since ${since}` : ""}. This isn&apos;t about payment.
				</p>
				{reason ? (
					<p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700">
						<span className="font-black">Reason:</span> {reason}
					</p>
				) : null}
				<div className="mt-6 grid gap-2 sm:grid-cols-2">
					<a
						href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Suspension: ${restaurantName}`)}`}
						className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white"
					>
						Contact support
					</a>
					<button
						type="button"
						disabled={signingOut}
						onClick={async () => {
							setSigningOut(true);
							await authClient.signOut();
							router.push("/login");
							router.refresh();
						}}
						className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700 disabled:opacity-60"
					>
						<LogOut className="size-4" aria-hidden="true" />
						{signingOut ? "Signing out…" : "Sign out"}
					</button>
				</div>
			</section>
		</main>
	);
}
