import { db } from "@/lib/db";
import { getClientIp, getRatelimiter } from "@/lib/ratelimit";

/**
 * Finds an order or reservation from what a customer typed or followed.
 *
 * Accepted:
 * - the full id (the link we send them), or
 * - exactly the 6-character code shown on their receipt ("#AB12CD").
 *
 * Anything else finds nothing. This used to match any *suffix* of any length,
 * so "/{slug}/track/a" resolved to whichever order happened to end in "a" —
 * handing out its full private link, and with it the ability to view the order
 * or cancel the booking. Short-code lookups are also rate-limited per IP, so
 * guessing six-character codes is impractical.
 */

const SHORT_CODE = /^[a-z0-9]{6}$/;
/** cuid ids are 25 characters; anything this long is treated as a full id. */
const MIN_FULL_ID_LENGTH = 20;

export function normalizeTrackingCode(value: string) {
	return decodeURIComponent(value).replace(/^#/, "").trim().toLowerCase();
}

type Kind = "order" | "reservation";

async function shortCodeAllowed() {
	const limiter = getRatelimiter("trackingLookup");
	if (!limiter) return true;
	const ip = await getClientIp();
	return limiter
		.limit(ip)
		.then((result) => result.success)
		.catch(() => true);
}

/** Returns the full id, or null when the code doesn't identify exactly one. */
export async function resolveTrackingCode(
	kind: Kind,
	slug: string,
	rawCode: string,
): Promise<string | null> {
	const code = normalizeTrackingCode(rawCode);
	const restaurant = { slug, isActive: true };

	if (code.length >= MIN_FULL_ID_LENGTH) {
		const row =
			kind === "order"
				? await db.order.findFirst({
						where: { id: code, restaurant },
						select: { id: true },
					})
				: await db.reservation.findFirst({
						where: { id: code, restaurant },
						select: { id: true },
					});
		return row?.id ?? null;
	}

	if (!SHORT_CODE.test(code) || !(await shortCodeAllowed())) return null;

	// Two matches for one short code would be ambiguous: refuse rather than
	// guess which customer this is.
	const rows =
		kind === "order"
			? await db.order.findMany({
					where: { id: { endsWith: code }, restaurant },
					select: { id: true },
					take: 2,
				})
			: await db.reservation.findMany({
					where: { id: { endsWith: code }, restaurant },
					select: { id: true },
					take: 2,
				});
	return rows.length === 1 ? rows[0].id : null;
}
