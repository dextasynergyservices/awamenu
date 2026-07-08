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

export default withSerwist(nextConfig);
