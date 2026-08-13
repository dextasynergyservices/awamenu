"use client";

import { useEffect } from "react";

/**
 * Registers the service worker once, for the whole app.
 *
 * Registration used to live inside `PushPermissionPrompt`, so a service worker
 * only ever existed on pages where someone opened that prompt — and browsers
 * refuse to offer "Install app" without an active worker. That is why the PWA
 * never appeared. Push permission is a separate concern and stays there; this
 * only makes sure the worker is running.
 *
 * Deliberately fire-and-forget: a failed registration must not break the page,
 * and there is nothing useful to show a customer about it.
 */
export function ServiceWorkerRegistrar() {
	useEffect(() => {
		if (!("serviceWorker" in navigator)) return;

		// Waits for load so registration never competes with the first paint for
		// bandwidth on a slow connection.
		const register = () => {
			navigator.serviceWorker
				.register("/sw.js", { scope: "/" })
				.catch(() => {});
		};

		if (document.readyState === "complete") {
			register();
			return;
		}

		window.addEventListener("load", register);
		return () => window.removeEventListener("load", register);
	}, []);

	return null;
}
