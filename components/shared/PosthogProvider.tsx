"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import { env } from "@/env";

let initialized = false;

/**
 * Initializes posthog-js once on mount. Renders nothing — mount near the
 * root layout. No-ops entirely if `NEXT_PUBLIC_POSTHOG_KEY` isn't set, so
 * this is safe to ship before real Posthog credentials exist.
 */
export function PosthogProvider() {
	useEffect(() => {
		const key = env.NEXT_PUBLIC_POSTHOG_KEY;
		if (!key || initialized) return;
		initialized = true;

		posthog.init(key, {
			api_host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
			person_profiles: "identified_only",
			capture_pageview: true,
		});
	}, []);

	return null;
}
