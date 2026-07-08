"use client";

import { Bell, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

import { usePushSubscription } from "@/hooks/usePushSubscription";

type PushPermissionPromptProps = {
	restaurantId: string;
	recipientType: "admin" | "staff";
	recipientId: string;
};

export function PushPermissionPrompt({
	restaurantId,
	recipientType,
	recipientId,
}: PushPermissionPromptProps) {
	const { permission, isSubscribed, subscribe } = usePushSubscription({
		restaurantId,
		recipientType,
		recipientId,
	});
	const [dismissed, setDismissed] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const mounted = useSyncExternalStore(
		emptySubscribe,
		() => true,
		() => false,
	);

	// Don't render anything until mounted on the client to avoid hydration mismatch
	if (!mounted) return null;

	// Don't show if already subscribed, denied, or dismissed
	if (isSubscribed || permission === "denied" || dismissed) return null;

	// Don't show if push is not supported
	if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
		return null;
	}

	async function handleEnable() {
		setIsLoading(true);
		await subscribe();
		setIsLoading(false);
	}

	return (
		<div className="relative mx-auto mb-4 max-w-2xl overflow-hidden rounded-xl sm:rounded-2xl border border-emerald-200 bg-linear-to-r from-emerald-50 to-lime-50 px-3 py-2 sm:px-5 sm:py-4 shadow-sm">
			<button
				type="button"
				onClick={() => setDismissed(true)}
				className="absolute top-1 right-1 grid size-6 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-slate-600 sm:top-3 sm:right-3"
				aria-label="Dismiss"
			>
				<X className="size-3.5 sm:size-4" />
			</button>
			<div className="flex items-start gap-2 sm:gap-3">
				<span className="grid size-7 shrink-0 place-items-center rounded-lg sm:rounded-xl bg-emerald-100 text-emerald-700 sm:size-10">
					<Bell className="size-3.5 sm:size-5" />
				</span>
				<div className="min-w-0 flex-1 pr-4 sm:pr-5">
					<p className="text-[12px] sm:text-sm font-black text-slate-800 leading-tight">
						Enable push notifications
					</p>
					<p className="mt-0.5 sm:mt-1 text-[10px] sm:text-[13px] leading-snug text-slate-600">
						Get alerts for orders and reservations.
					</p>
				</div>
			</div>
			<div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
				<button
					type="button"
					onClick={handleEnable}
					disabled={isLoading}
					className="flex-1 sm:flex-none inline-flex min-h-7 sm:min-h-9 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-700 px-3 sm:px-4 text-[10px] sm:text-[13px] font-bold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
				>
					{isLoading ? "Enabling…" : "Enable"}
				</button>
				<button
					type="button"
					onClick={() => setDismissed(true)}
					className="flex-1 sm:flex-none inline-flex min-h-7 sm:min-h-9 items-center justify-center rounded-lg sm:rounded-xl px-3 sm:px-4 text-[10px] sm:text-[13px] font-bold text-slate-500 transition-colors hover:bg-emerald-100/50"
				>
					Not now
				</button>
			</div>
		</div>
	);
}
