import { Redis } from "@upstash/redis";

// Singleton Upstash Redis client used for publishing notification events
// and for the SSE polling-based stream.
//
// Upstash Redis is HTTP-based, so it works well in serverless
// environments. We use it both for:
//   1. Publishing notification events (LPUSH + PUBLISH)
//   2. SSE polling (SUBSCRIBE equivalent via list polling)

let redis: Redis | null = null;

export function getRedis(): Redis | null {
	if (redis) return redis;

	const url = process.env.UPSTASH_REDIS_REST_URL;
	const token = process.env.UPSTASH_REDIS_REST_TOKEN;

	if (!url || !token || url.includes("...") || token.includes("..."))
		return null;

	redis = new Redis({ url, token });
	return redis;
}

/**
 * Channel key for a restaurant's notification stream.
 * Notifications are pushed to a Redis list keyed by this.
 */
export function notificationChannelKey(restaurantId: string) {
	return `notifications:${restaurantId}`;
}

/**
 * Publish a notification event to Redis for real-time delivery.
 * Uses a capped list so old events don't accumulate forever.
 */
export async function publishNotificationEvent(
	restaurantId: string,
	payload: Record<string, unknown>,
) {
	const client = getRedis();
	if (!client) return;

	const key = notificationChannelKey(restaurantId);
	const message = JSON.stringify({ ...payload, _ts: Date.now() });

	// Push to the head of the list and cap at 100 events
	await client.lpush(key, message);
	await client.ltrim(key, 0, 99);
	// Set a TTL of 24 hours so stale keys don't linger
	await client.expire(key, 86_400);
}
