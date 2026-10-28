import { after } from "next/server";
import { PostHog } from "posthog-node";
import { env } from "@/env";

let client: PostHog | null = null;
let attempted = false;

/**
 * Server-side PostHog. The project key is the same public `phc_` key the
 * browser uses, so `NEXT_PUBLIC_POSTHOG_KEY` is enough; a separate
 * `POSTHOG_PROJECT_API_KEY` is only needed to send server events to another
 * project. (Before, server events needed that second key, which wasn't set,
 * so none were ever sent.)
 */
function getClient(): PostHog | null {
	if (attempted) return client;
	attempted = true;

	const key = env.POSTHOG_PROJECT_API_KEY ?? env.NEXT_PUBLIC_POSTHOG_KEY;
	if (!key) return null;

	client = new PostHog(key, {
		host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
		flushAt: 1,
		flushInterval: 0,
	});
	return client;
}

/**
 * Business events the browser can't see: an order placed, a subscription
 * paid. Sent after the response (a serverless function can otherwise be
 * frozen before the event leaves), and never allowed to fail the caller.
 */
export function captureServerEvent(
	event: string,
	distinctId: string,
	properties?: Record<string, unknown>,
) {
	const posthog = getClient();
	if (!posthog || !distinctId) return;

	const send = () =>
		posthog
			.captureImmediate({
				distinctId,
				event,
				properties: { ...properties, source: "server" },
			})
			.catch(() => {});
	try {
		after(send);
	} catch {
		// Outside a request (a script, a cron run without request context).
		void send();
	}
}
