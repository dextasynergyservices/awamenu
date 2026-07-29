import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { getRedis } from "@/lib/redis";

export type RatelimitKind =
	| "order"
	| "reservation"
	| "staffPin"
	| "sse"
	| "admin";

function createLimiter(kind: RatelimitKind, redis: Redis): Ratelimit {
	switch (kind) {
		case "order":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(5, "1 h"),
				prefix: "ratelimit:order",
			});
		case "reservation":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(5, "1 h"),
				prefix: "ratelimit:reservation",
			});
		case "staffPin":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(10, "5 m"),
				prefix: "ratelimit:staff-pin",
			});
		case "sse":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(10, "1 m"),
				prefix: "ratelimit:sse",
			});
		case "admin":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(30, "1 m"),
				prefix: "ratelimit:admin",
			});
	}
}

const limiters = new Map<RatelimitKind, Ratelimit | null>();

/**
 * Returns a shared Ratelimit instance for the given kind, or `null` if Redis
 * isn't configured. Mirrors `getRedis()`'s defensive pattern — callers treat
 * `null` as "rate limiting disabled" and allow the request through, so the
 * app still works in environments without Upstash Redis set up.
 */
export function getRatelimiter(kind: RatelimitKind): Ratelimit | null {
	if (!limiters.has(kind)) {
		const redis = getRedis();
		limiters.set(kind, redis ? createLimiter(kind, redis) : null);
	}
	return limiters.get(kind) ?? null;
}

/**
 * Checks the limiter for `kind` against `key` and throws if the limit is
 * exceeded. No-ops (always allows) when Redis isn't configured.
 */
export async function enforceRateLimit(kind: RatelimitKind, key: string) {
	const limiter = getRatelimiter(kind);
	if (!limiter) return;

	const { success } = await limiter.limit(key);
	if (!success) {
		throw new Error("Too many requests. Please try again shortly.");
	}
}

/**
 * Best-effort client IP extraction for use inside Server Actions (no direct
 * access to the Request object there). Falls back to "unknown" so rate
 * limiting still applies a single shared bucket rather than throwing.
 */
export async function getClientIp(): Promise<string> {
	const h = await headers();
	const forwarded = h.get("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
	return h.get("x-real-ip") ?? "unknown";
}

export function getClientIpFromRequest(request: Request): string {
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
	return request.headers.get("x-real-ip") ?? "unknown";
}
