import { withSentryConfig } from "@sentry/nextjs";
import withSerwistInit from "@serwist/next";
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
};

const withSerwist = withSerwistInit({
	swSrc: "app/sw.ts",
	swDest: "public/sw.js",
	disable: process.env.NODE_ENV === "development",
});

export default withSentryConfig(withSerwist(nextConfig), {
	org: process.env.SENTRY_ORG,
	project: process.env.SENTRY_PROJECT,
	authToken: process.env.SENTRY_AUTH_TOKEN,
	silent: true,
	widenClientFileUpload: true,
	webpack: {
		treeshake: { removeDebugLogging: true },
	},
});
