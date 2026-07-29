"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Banner that auto-prompts "Add to Home Screen" using the
 * beforeinstallprompt event on supported browsers.
 */
export function InstallPWAPrompt() {
	const [deferredPrompt, setDeferredPrompt] =
		useState<BeforeInstallPromptEvent | null>(null);
	const [dismissed, setDismissed] = useState(false);
	const [installed, setInstalled] = useState(
		() =>
			typeof window !== "undefined" &&
			window.matchMedia("(display-mode: standalone)").matches,
	);

	useEffect(() => {
		if (installed) return;

		function handleBeforeInstallPrompt(e: Event) {
			e.preventDefault();
			setDeferredPrompt(e as BeforeInstallPromptEvent);
		}

		function handleAppInstalled() {
			setInstalled(true);
			setDeferredPrompt(null);
		}

		window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
		window.addEventListener("appinstalled", handleAppInstalled);

		return () => {
			window.removeEventListener(
				"beforeinstallprompt",
				handleBeforeInstallPrompt,
			);
			window.removeEventListener("appinstalled", handleAppInstalled);
		};
	}, [installed]);

	if (!deferredPrompt || dismissed || installed) return null;

	async function handleInstall() {
		if (!deferredPrompt) return;
		deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		if (outcome === "accepted") {
			setInstalled(true);
		}
		setDeferredPrompt(null);
	}

	return (
		<div className="relative mx-auto mb-4 max-w-2xl overflow-hidden rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 shadow-sm">
			<button
				type="button"
				onClick={() => setDismissed(true)}
				className="absolute top-3 right-3 grid size-7 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-white hover:text-slate-600"
				aria-label="Dismiss"
			>
				<X className="size-4" />
			</button>
			<div className="flex items-center gap-3">
				<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-700">
					<Download className="size-5" />
				</span>
				<div className="min-w-0 flex-1">
					<p className="text-sm font-black text-slate-800">Install AwaMenu</p>
					<p className="mt-0.5 text-sm text-slate-600">
						Add to your home screen for faster access and offline support.
					</p>
				</div>
			</div>
			<div className="mt-3 flex gap-2">
				<button
					type="button"
					onClick={handleInstall}
					className="inline-flex min-h-9 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition-colors hover:bg-blue-700"
				>
					Install app
				</button>
				<button
					type="button"
					onClick={() => setDismissed(true)}
					className="inline-flex min-h-9 items-center justify-center rounded-xl px-4 text-sm font-bold text-slate-500 transition-colors hover:bg-white"
				>
					Not now
				</button>
			</div>
		</div>
	);
}

/**
 * Type declaration for the non-standard beforeinstallprompt event.
 */
interface BeforeInstallPromptEvent extends Event {
	readonly platforms: string[];
	readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
	prompt(): Promise<void>;
}

declare global {
	interface WindowEventMap {
		beforeinstallprompt: BeforeInstallPromptEvent;
	}
}
