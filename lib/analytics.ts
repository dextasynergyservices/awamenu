import { PostHog } from "posthog-node";
import { env } from "@/env";

let client: PostHog | null = null;
let attempted = false;

function getClient(): PostHog | null {
	if (attempted) return client;
	attempted = true;

	const key = env.POSTHOG_PROJECT_API_KEY;
	if (!key) return null;

	client = new PostHog(key, {
		host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
		flushAt: 1,
		flushInterval: 0,
	});
	return client;
}

export function captureServerEvent(
	event: string,
	distinctId: string,
	properties?: Record<string, unknown>,
) {
	const posthog = getClient();
	if (!posthog) return;

	posthog.capture({ distinctId, event, properties });
}
