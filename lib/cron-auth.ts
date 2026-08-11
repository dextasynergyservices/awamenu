import crypto from "node:crypto";
import { env } from "@/env";
import { verifyQstashSignature } from "@/lib/qstash";

/** Timing-safe compare that tolerates differing lengths. */
function safeEqual(a: string, b: string) {
	const aBuf = Buffer.from(a);
	const bBuf = Buffer.from(b);
	if (aBuf.length !== bBuf.length) return false;
	return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Extracts a caller-supplied cron secret.
 *
 * Several forms are accepted because external schedulers differ in what they
 * can send: cron-jobs.org can set custom headers, some free tiers only let you
 * craft a URL, and Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 */
function extractSecret(request: Request): string | null {
	const auth = request.headers.get("authorization");
	if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length).trim();

	const header = request.headers.get("x-cron-secret");
	if (header) return header.trim();

	const fromQuery = new URL(request.url).searchParams.get("secret");
	if (fromQuery) return fromQuery.trim();

	return null;
}

/**
 * Authorises a cron invocation.
 *
 * Accepts either a valid QStash signature (how these routes were originally
 * triggered) or a `CRON_SECRET` shared secret, so the schedule can be moved to
 * any external scheduler without giving up authentication.
 *
 * Fails closed: if neither `CRON_SECRET` nor the QStash signing keys are
 * configured, nothing is authorised rather than leaving the endpoint open.
 */
export async function isAuthorizedCronRequest(
	request: Request,
	body: string,
): Promise<boolean> {
	const configuredSecret = env.CRON_SECRET;
	if (configuredSecret) {
		const provided = extractSecret(request);
		if (provided && safeEqual(provided, configuredSecret)) return true;
	}

	if (env.QSTASH_CURRENT_SIGNING_KEY && env.QSTASH_NEXT_SIGNING_KEY) {
		return verifyQstashSignature({
			signature: request.headers.get("upstash-signature"),
			body,
			url: request.url,
		});
	}

	// Outside production a route with no scheduler configured at all stays
	// callable so it can be exercised locally; in production it must not.
	return process.env.NODE_ENV !== "production";
}
