import { cache } from "react";
import { db } from "@/lib/db";

/**
 * Minimal, request-deduped restaurant lookup for branding purposes (favicon,
 * loading screens) — kept separate from the fuller per-page queries so
 * `loading.tsx` files can resolve fast, well before the rest of that route's
 * data is ready.
 */
export const getRestaurantBrand = cache(async (slug: string) => {
	return db.restaurant.findFirst({
		where: { slug },
		select: { name: true, logoUrl: true, primaryColor: true },
	});
});
