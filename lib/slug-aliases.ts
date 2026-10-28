import { db } from "@/lib/db";

/**
 * Old restaurant slugs → current slug, for redirects in proxy.ts.
 *
 * A restaurant that changes its web address has QR codes printed on tables and
 * links in customers' inboxes pointing at the old one. Rather than breaking
 * them, every path starting with an old slug is redirected.
 *
 * The map is tiny (only restaurants that have ever renamed) and cached in
 * memory per server for a minute, so the proxy doesn't query on every request.
 */

const CACHE_MS = 60_000;
let cached: { map: Map<string, string>; at: number } | null = null;

export async function getSlugAliases(): Promise<Map<string, string>> {
	if (cached && Date.now() - cached.at < CACHE_MS) return cached.map;

	try {
		const rows = await db.restaurant.findMany({
			where: { previousSlugs: { isEmpty: false } },
			select: { slug: true, previousSlugs: true },
		});
		const map = new Map<string, string>();
		for (const row of rows) {
			for (const old of row.previousSlugs) map.set(old, row.slug);
		}
		cached = { map, at: Date.now() };
	} catch (error) {
		console.error("[slug-aliases] could not load", error);
		cached = { map: cached?.map ?? new Map(), at: Date.now() };
	}
	return cached.map;
}

export function clearSlugAliasCache() {
	cached = null;
}

/** Whether a slug is free: not a current slug, and not anyone's old one. */
export async function isSlugAvailable(
	slug: string,
	exceptRestaurantId?: string,
) {
	const taken = await db.restaurant.findFirst({
		where: {
			OR: [{ slug }, { previousSlugs: { has: slug } }],
			...(exceptRestaurantId ? { NOT: { id: exceptRestaurantId } } : {}),
		},
		select: { id: true },
	});
	return !taken;
}
