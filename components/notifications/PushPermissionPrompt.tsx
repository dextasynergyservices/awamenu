"use client";

import { Bell, Share, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

import { usePushSubscription } from "@/hooks/usePushSubscription";

type PushPermissionPromptProps = {
	restaurantId: string;
	recipientType: "admin" | "staff";
	recipientId: string;
};

/**
 * True on an iPhone or iPad browsing normally, rather than from an installed
 * Home Screen app. Feature detection isn't possible here: Safari exposes
 * `PushManager` either way and simply never resolves the permission request,
 * so the platform has to be detected directly.
 */
function isIosSafariNotInstalled() {
	if (typeof window === "undefined") return false;
	const ua = window.navigator.userAgent;
	const isIos =
		/iPad|iPhone|iPod/.test(ua) ||
		// iPadOS 13+ reports itself as a Mac; the touch points give it away.
		(ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
	if (!isIos) return false;

	const installed =
		window.matchMedia("(display-mode: standalone)").matches ||
		(window.navigator as { standalone?: boolean }).standalone === true;
	return !installed;
}

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
	const [needsInstall, setNeedsInstall] = useState(false);
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
		// iOS refuses push outright until the site is installed to the Home
		// Screen — `Notification.requestPermission()` never resolves in Safari,
		// which is exactly why the button sat on "Enabling…" forever. Tell them
		// what to do instead of spinning.
		if (isIosSafariNotInstalled()) {
			setNeedsInstall(true);
			return;
		}

		setIsLoading(true);
		try {
			await subscribe();
		} finally {
			// In a finally block so a rejected permission prompt can't strand the
			// button in its loading state.
			setIsLoading(false);
		}
	}

	if (needsInstall) {
		return (
			<div className="relative mx-auto mb-4 max-w-2xl overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 shadow-sm sm:rounded-2xl sm:px-5 sm:py-4">
				<button
					type="button"
					onClick={() => setDismissed(true)}
					className="absolute top-1 right-1 grid size-6 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-slate-600 sm:top-3 sm:right-3"
					aria-label="Dismiss"
				>
					<X className="size-3.5 sm:size-4" />
				</button>
				<div className="flex items-start gap-2 sm:gap-3">
					<span className="grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700 sm:size-10 sm:rounded-xl">
						<Share className="size-3.5 sm:size-5" />
					</span>
					<div className="min-w-0 flex-1 pr-4 sm:pr-5">
						<p className="text-xs font-black leading-tight text-slate-800 sm:text-sm">
							Add AwaMenu to your Home Screen first
						</p>
						<p className="mt-1 text-xs leading-snug text-slate-600 sm:text-sm">
							iPhone only allows notifications for installed apps. Tap{" "}
							<strong className="font-black">Share</strong> at the bottom of
							Safari, choose{" "}
							<strong className="font-black">Add to Home Screen</strong>, then
							open AwaMenu from your Home Screen and tap Enable again.
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="relative mx-auto mb-4 max-w-2xl overflow-hidden rounded-xl sm:rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 sm:px-5 sm:py-4 shadow-sm">
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
					<p className="text-xs sm:text-sm font-black text-slate-800 leading-tight">
						Enable push notifications
					</p>
					<p className="mt-0.5 sm:mt-1 text-xs sm:text-sm leading-snug text-slate-600">
						Get alerts for orders and reservations.
					</p>
				</div>
			</div>
			<div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
				<button
					type="button"
					onClick={handleEnable}
					disabled={isLoading}
					className="flex-1 sm:flex-none inline-flex min-h-7 sm:min-h-9 items-center justify-center rounded-lg sm:rounded-xl bg-emerald-700 px-3 sm:px-4 text-xs sm:text-sm font-bold text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
				>
					{isLoading ? "Enabling…" : "Enable"}
				</button>
				<button
					type="button"
					onClick={() => setDismissed(true)}
					className="flex-1 sm:flex-none inline-flex min-h-7 sm:min-h-9 items-center justify-center rounded-lg sm:rounded-xl px-3 sm:px-4 text-xs sm:text-sm font-bold text-slate-500 transition-colors hover:bg-emerald-100/50"
				>
					Not now
				</button>
			</div>
		</div>
	);
}
