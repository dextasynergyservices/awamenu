import * as Sentry from "@sentry/nextjs";
import { Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { ActionError } from "@/lib/action-error";
import { getRedis } from "@/lib/redis";

export type RatelimitKind =
	| "order"
	| "orderIp"
	| "reservation"
	| "reservationIp"
	| "staffPin"
	| "staffLogin"
	| "staffLoginRestaurant"
	| "otpSendIdentifier"
	| "otpSendIp"
	| "otpVerify"
	| "qrScan"
	| "resetVerify"
	| "trackingLookup"
	| "admin";

function createLimiter(kind: RatelimitKind, redis: Redis): Ratelimit {
	switch (kind) {
		// Keyed on the customer's phone, not the IP: a full restaurant on its own
		// Wi-Fi shares one IP, and a 5-per-IP limit refused the sixth table.
		// The per-IP limits below are only a ceiling against floods, set well
		// above a busy service; Turnstile handles bots on the order form.
		case "order":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(10, "1 h"),
				prefix: "ratelimit:order-phone",
			});
		case "orderIp":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(150, "1 h"),
				prefix: "ratelimit:order-ip",
			});
		case "reservation":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(5, "1 h"),
				prefix: "ratelimit:reservation-phone",
			});
		case "reservationIp":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(40, "1 h"),
				prefix: "ratelimit:reservation-ip",
			});
		case "staffPin":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(10, "5 m"),
				prefix: "ratelimit:staff-pin",
			});
		case "staffLogin":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(5, "5 m"),
				prefix: "ratelimit:staff-login",
			});
		// Per restaurant, whatever the IP: the shared staff password must not be
		// guessable by spreading attempts across many addresses.
		case "staffLoginRestaurant":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(20, "15 m"),
				prefix: "ratelimit:staff-login-restaurant",
			});
		// Sending a code costs money (Twilio) and can be used to spam a
		// stranger's phone, so it is capped per recipient and per sender.
		case "otpSendIdentifier":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(3, "15 m"),
				prefix: "ratelimit:otp-send-id",
			});
		case "otpSendIp":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(10, "1 h"),
				prefix: "ratelimit:otp-send-ip",
			});
		case "otpVerify":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(10, "15 m"),
				prefix: "ratelimit:otp-verify",
			});
		// Not a block — over the limit, a scan simply isn't counted again, so one
		// phone (or a bot) re-opening the QR link can't inflate analytics or fill
		// the ScanEvent table.
		// Owner password-reset code attempts, per email.
		// Looking up an order or booking by its 6-character code. Generous for a
		// person (who types their code once), hopeless for someone guessing.
		case "trackingLookup":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(20, "10 m"),
				prefix: "ratelimit:tracking-lookup",
			});
		case "resetVerify":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(5, "15 m"),
				prefix: "ratelimit:owner-reset-verify",
			});
		case "qrScan":
			return new Ratelimit({
				redis,
				limiter: Ratelimit.slidingWindow(3, "30 m"),
				prefix: "ratelimit:qr-scan",
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

	let success: boolean;
	try {
		({ success } = await limiter.limit(key));
	} catch (error) {
		// An unreachable limiter must not take sign-in and checkout down with it.
		// Fail open and report; the flows that matter most also enforce a cap
		// from the database (e.g. OTP sends), which holds without Redis.
		Sentry.captureException(error, { tags: { component: "ratelimit" } });
		return;
	}
	if (!success) {
		// ActionError so the person sees why. A plain Error reached them as
		// Next's generic production digest ("Something went wrong").
		throw new ActionError(
			"Too many attempts. Please wait a few minutes and try again.",
		);
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
