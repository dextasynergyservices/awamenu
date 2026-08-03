/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import { NetworkOnly, type PrecacheEntry, Serwist } from "serwist";
import { LOGO_ICON_URL } from "@/lib/logo";

declare const self: ServiceWorkerGlobalScope & {
	__SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
};

/**
 * Serwist's `defaultCache` ends with catch-all NetworkFirst rules that store
 * RSC payloads, HTML documents and every other same-origin response for 24
 * hours. That is wrong for this app in two ways:
 *
 *  1. Correctness — dashboard/staff/super-admin routes are per-request and
 *     tied to a build id. After a deploy (or once an entry goes stale) the
 *     worker can hand React an RSC payload from a previous build, which it
 *     cannot reconcile, and the root error boundary renders "Something went
 *     wrong" a few seconds into the page.
 *  2. Privacy — those caches key on URL alone, with no notion of who is
 *     signed in. On a shared restaurant device, one account's cached
 *     dashboard could be served to the next person to sign in.
 *
 * So the page-level entries are dropped and replaced with NetworkOnly. Static
 * assets (fonts, images, /_next/static bundles) keep their original handlers —
 * they are content-hashed and identical for every user, which is what makes
 * them safe to cache. The PWA install + push-notification behaviour this app
 * actually relies on is unaffected; only offline page replay is given up.
 */
// Only caches whose contents are content-hashed or otherwise identical for
// every visitor. Deliberately excludes "pages", "pages-rsc",
// "pages-rsc-prefetch", "apis", "next-data", "static-data-assets", "others"
// and "cross-origin" — those are the per-user/per-build ones.
const CACHEABLE_ASSET_CACHES = new Set([
	"google-fonts-webfonts",
	"google-fonts-stylesheets",
	"static-font-assets",
	"static-image-assets",
	"next-static-js-assets",
	"next-image",
	"static-audio-assets",
	"static-video-assets",
	"static-js-assets",
	"static-style-assets",
]);

const staticAssetCaching = defaultCache.filter((entry) => {
	const cacheName = (
		entry.handler as Partial<{ cacheName: string }> | undefined
	)?.cacheName;
	return typeof cacheName === "string" && CACHEABLE_ASSET_CACHES.has(cacheName);
});

const serwist = new Serwist({
	precacheEntries: self.__SW_MANIFEST,
	skipWaiting: true,
	clientsClaim: true,
	navigationPreload: true,
	runtimeCaching: [
		...staticAssetCaching,
		// Everything else — navigations, RSC payloads, API calls — always goes
		// to the network. No stale payloads, no cross-account bleed.
		{ matcher: () => true, handler: new NetworkOnly() },
	],
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
