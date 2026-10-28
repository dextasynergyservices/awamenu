import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

/**
 * Content Security Policy — enforced in production.
 *
 * Every origin the browser talks to is listed: Turnstile, Cloudinary (images
 * and signed uploads), Sentry, PostHog, and the payment providers' hosted
 * checkout pages (redirects). Violations are reported to Sentry's CSP endpoint
 * (derived from the DSN), so anything missed shows up there.
 *
 * Development stays report-only: Next's dev server and React's dev tooling use
 * eval and a HMR websocket that the production policy rightly refuses.
 *
 * Adding a third-party script, image host or API called from the browser means
 * adding its origin here, or the browser will block it.
 */
function sentryCspReportUri() {
	const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
	if (!dsn) return null;
	try {
		const url = new URL(dsn);
		const projectId = url.pathname.replace(/^\//, "");
		return `${url.protocol}//${url.host}/api/${projectId}/security/?sentry_key=${url.username}`;
	} catch {
		return null;
	}
}

const isProduction = process.env.NODE_ENV === "production";
const reportUri = sentryCspReportUri();
const contentSecurityPolicy = [
	"default-src 'self'",
	// Next's hydration uses inline scripts; nonces would be needed to drop
	// 'unsafe-inline', which is a bigger change than this first step.
	"script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://*.posthog.com",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob: https://res.cloudinary.com",
	"font-src 'self' data:",
	"connect-src 'self' https://api.cloudinary.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://*.posthog.com",
	"frame-src https://challenges.cloudflare.com",
	"worker-src 'self' blob:",
	"manifest-src 'self'",
	"object-src 'none'",
	"base-uri 'self'",
	"frame-ancestors 'none'",
	// Checkout redirects to the payment providers' hosted pages.
	"form-action 'self' https://checkout.paystack.com https://checkout.flutterwave.com https://*.monnify.com",
	...(isProduction ? ["upgrade-insecure-requests"] : []),
	...(reportUri ? [`report-uri ${reportUri}`] : []),
].join("; ");

const nextConfig: NextConfig = {
	turbopack: {},
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "res.cloudinary.com",
			},
		],
	},
	// No page in this app is meant to be framed by another origin (no embed
	// widget exists), and none of these browser features (camera, mic,
	// geolocation) are used anywhere. The CSP is defined above.
	async headers() {
		return [
			{
				source: "/:path*",
				headers: [
					{ key: "X-Content-Type-Options", value: "nosniff" },
					{ key: "X-Frame-Options", value: "DENY" },
					{
						key: "Referrer-Policy",
						value: "strict-origin-when-cross-origin",
					},
					{
						key: "Permissions-Policy",
						value: "camera=(), microphone=(), geolocation=()",
					},
					{
						key: "Strict-Transport-Security",
						value: "max-age=63072000; includeSubDomains",
					},
					{
						key: isProduction
							? "Content-Security-Policy"
							: "Content-Security-Policy-Report-Only",
						value: contentSecurityPolicy,
					},
				],
			},
		];
	},
};

// Serwist is no longer wired in here — the plugin form is webpack-only and
// Next 16 builds with Turbopack, so it never ran. The service worker is now
// built as a separate step from serwist.config.mjs (see the `build` script).
export default withSentryConfig(nextConfig, {
	org: process.env.SENTRY_ORG,
	project: process.env.SENTRY_PROJECT,
	authToken: process.env.SENTRY_AUTH_TOKEN,
	silent: true,
	widenClientFileUpload: true,
	webpack: {
		treeshake: { removeDebugLogging: true },
	},
});
