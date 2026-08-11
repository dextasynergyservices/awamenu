"use client";

import { Check, Copy, Eye, EyeOff, Lock, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { revealStaffPasswordAction } from "@/actions/restaurant.actions";

const emptySubscribe = () => () => {};

/** True only after hydration, so the portal isn't attempted during SSR. */
function useMounted() {
	return useSyncExternalStore(
		emptySubscribe,
		() => true,
		() => false,
	);
}

type StaffPasswordRevealProps = {
	slug: string;
	hasPassword: boolean;
};

type PendingIntent = "view" | "copy";

/**
 * Shows the current staff dashboard password, masked, with reveal and copy
 * actions. Both are gated behind re-entering the owner's own account password,
 * so simply being signed in on an unattended device isn't enough to lift the
 * staff credential.
 *
 * The password is never sent to the browser until that check passes — the
 * server only returns it in response to a successful confirmation, so it isn't
 * sitting in the page source waiting to be read.
 */
export function StaffPasswordReveal({
	slug,
	hasPassword,
}: StaffPasswordRevealProps) {
	const [revealed, setRevealed] = useState<string | null>(null);
	const [visible, setVisible] = useState(false);
	const [copied, setCopied] = useState(false);
	const [intent, setIntent] = useState<PendingIntent | null>(null);
	const [adminPassword, setAdminPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const passwordInputRef = useRef<HTMLInputElement>(null);
	const mounted = useMounted();

	// Focused after the dialog mounts rather than via `autoFocus`, which fires
	// before assistive tech has announced the dialog.
	useEffect(() => {
		if (intent) passwordInputRef.current?.focus();
	}, [intent]);

	if (!hasPassword) return null;

	function closeDialog() {
		setIntent(null);
		setAdminPassword("");
		setError(null);
	}

	async function copyToClipboard(value: string) {
		await navigator.clipboard.writeText(value);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	function request(next: PendingIntent) {
		// Already unlocked this session — no need to re-confirm.
		if (revealed) {
			if (next === "copy") void copyToClipboard(revealed);
			else setVisible((v) => !v);
			return;
		}
		setIntent(next);
	}

	async function handleConfirm(event: React.FormEvent) {
		event.preventDefault();
		setLoading(true);
		setError(null);

		try {
			const result = await revealStaffPasswordAction({
				slug,
				adminPassword,
			});

			if ("error" in result) {
				setError(result.error);
				return;
			}

			setRevealed(result.password);
			if (intent === "copy") {
				await copyToClipboard(result.password);
			} else {
				setVisible(true);
			}
			closeDialog();
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<>
			<div className="mt-2">
				<p className="mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500">
					Current password
				</p>
				<div className="flex items-center gap-2">
					<code className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-bold tracking-wider text-slate-800">
						{revealed && visible ? revealed : "••••••••••"}
					</code>
					<button
						type="button"
						onClick={() => request("view")}
						aria-label={revealed && visible ? "Hide password" : "Show password"}
						title={revealed && visible ? "Hide password" : "Show password"}
						className="grid size-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
					>
						{revealed && visible ? (
							<EyeOff className="size-4" aria-hidden="true" />
						) : (
							<Eye className="size-4" aria-hidden="true" />
						)}
					</button>
					<button
						type="button"
						onClick={() => request("copy")}
						aria-label="Copy password"
						title="Copy password"
						className="grid size-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50"
					>
						{copied ? (
							<Check className="size-4 text-emerald-600" aria-hidden="true" />
						) : (
							<Copy className="size-4" aria-hidden="true" />
						)}
					</button>
				</div>
			</div>

			{/* Portaled to <body> rather than rendered in place. This component is
			    mounted inside the settings <form>, and HTML forbids nested forms —
			    the browser silently drops the inner one, which turned "Confirm"
			    into a submit button for the settings form and reloaded the page
			    instead of running the handler. */}
			{intent && mounted
				? createPortal(
						<div className="fixed inset-0 z-[120] grid place-items-end bg-slate-950/45 p-3 backdrop-blur-[2px] sm:place-items-center sm:p-4">
							<button
								type="button"
								className="absolute inset-0 cursor-default"
								aria-label="Cancel"
								onClick={closeDialog}
							/>
							<div className="relative z-10 w-full max-w-sm rounded-[1.5rem] bg-white p-5 shadow-2xl sm:p-6">
								<div className="flex items-start justify-between gap-3">
									<div className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
										<ShieldCheck className="size-5" aria-hidden="true" />
									</div>
									<button
										type="button"
										onClick={closeDialog}
										aria-label="Close"
										className="grid size-9 place-items-center rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100"
									>
										<X className="size-4" aria-hidden="true" />
									</button>
								</div>

								<h3 className="mt-4 text-lg font-black text-slate-950">
									Confirm it&apos;s you
								</h3>
								<p className="mt-1 text-sm font-medium text-slate-600">
									Enter your own account password to{" "}
									{intent === "copy" ? "copy" : "view"} the staff password.
								</p>

								<form onSubmit={handleConfirm} className="mt-4 grid gap-3">
									<label className="grid gap-1.5 text-xs font-black text-slate-700">
										Your account password
										<div className="relative">
											<Lock
												className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
												aria-hidden="true"
											/>
											<input
												ref={passwordInputRef}
												type="password"
												value={adminPassword}
												onChange={(event) =>
													setAdminPassword(event.target.value)
												}
												required
												autoComplete="current-password"
												className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
											/>
										</div>
									</label>

									{error ? (
										<p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
											{error}
										</p>
									) : null}

									<div className="mt-1 grid grid-cols-2 gap-2">
										<button
											type="button"
											onClick={closeDialog}
											className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
										>
											Cancel
										</button>
										<button
											type="submit"
											disabled={loading || !adminPassword}
											className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
										>
											{loading ? "Checking..." : "Confirm"}
										</button>
									</div>
								</form>
							</div>
						</div>,
						document.body,
					)
				: null}
		</>
	);
}
