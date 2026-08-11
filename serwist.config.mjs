import { serwist } from "@serwist/next/config";

/**
 * Service worker build configuration ("configurator mode").
 *
 * The plugin form (`withSerwistInit` in next.config.ts) only runs under
 * webpack, and Next 16 builds with Turbopack by default — so the service
 * worker was silently never generated. No `public/sw.js` meant no PWA install
 * prompt and, more importantly, no push notifications, despite the VAPID keys
 * and push handlers all being wired up.
 *
 * Configurator mode builds the worker as its own step (see the `build` script),
 * which is bundler-independent and therefore Turbopack-safe.
 */
export default serwist.withNextConfig((nextConfig) => ({
	swSrc: "app/sw.ts",
	swDest: "public/sw.js",
	globDirectory: nextConfig.distDir ?? ".next",
	// Prerendered routes are already served by Next; precaching them here would
	// duplicate them and risk serving stale HTML for authenticated pages.
	precachePrerendered: false,
}));
