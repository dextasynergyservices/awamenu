import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

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
	// geolocation) are used anywhere — Content-Security-Policy is
	// deliberately left out here since a wrong CSP could silently break
	// Turnstile/Paystack/Cloudinary/Sentry in ways that need live browser
	// testing to catch, not a blind config change.
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
