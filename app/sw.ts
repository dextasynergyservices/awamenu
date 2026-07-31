/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import { type PrecacheEntry, Serwist } from "serwist";
import { LOGO_ICON_URL } from "@/lib/logo";

declare const self: ServiceWorkerGlobalScope & {
	__SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

const serwist = new Serwist({
	precacheEntries: self.__SW_MANIFEST,
	skipWaiting: true,
	clientsClaim: true,
	navigationPreload: true,
	runtimeCaching: defaultCache,
});

// ─── Push Notification Handler ────────────────────────

self.addEventListener("push", (event) => {
	if (!event.data) return;

	try {
		const data = event.data.json() as {
			title?: string;
			body?: string;
			url?: string;
		};

		const title = data.title ?? "AwaMenu";
		const options: NotificationOptions = {
			body: data.body ?? "",
			icon: LOGO_ICON_URL,
			badge: LOGO_ICON_URL,
			tag: `awamenu-${Date.now()}`,
			data: { url: data.url },
		};

		event.waitUntil(self.registration.showNotification(title, options));
	} catch {
		// Ignore malformed push data
	}
});

// ─── Notification Click Handler ───────────────────────

self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	const url = (event.notification.data as { url?: string })?.url;

	if (url) {
		event.waitUntil(
			self.clients
				.matchAll({ type: "window", includeUncontrolled: true })
				.then((clientList) => {
					// Focus an existing window if one is already open
					for (const client of clientList) {
						if ("focus" in client) {
							client.focus();
							client.navigate(url);
							return;
						}
					}
					// Otherwise open a new window
					return self.clients.openWindow(url);
				}),
		);
	}
});

serwist.addEventListeners();
