"use client";

import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useUIStore } from "@/stores/ui.store";

/**
 * Fixed banner shown when the user goes offline.
 * Driven by the UI Zustand store which tracks navigator.onLine.
 */
export function OfflineBanner() {
	const isOnline = useUIStore((s) => s.isOnline);
	const setOnline = useUIStore((s) => s.setOnline);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		const initTimeout = setTimeout(() => {
			setMounted(true);
			setOnline(navigator.onLine);
		}, 0);

		function handleOnline() {
			setOnline(true);
		}
		function handleOffline() {
			setOnline(false);
		}

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			clearTimeout(initTimeout);
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, [setOnline]);

	if (!mounted || isOnline) return null;

	return (
		<div className="fixed inset-x-0 top-0 z-100 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-lg">
			<WifiOff className="size-4" />
			<span>You&apos;re offline — some features may be unavailable</span>
		</div>
	);
}
