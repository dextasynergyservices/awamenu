import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { getRestaurantPlanFeatures } from "@/lib/plan-features";

/**
 * The public menu's data, cached per restaurant.
 *
 * The menu is the page every QR scan opens, and it was a full set of database
 * queries on each one — at a database in Frankfurt, for customers in Lagos.
 * Now one load serves every scan until the menu changes:
 *
 * - Menu, branding and settings actions purge it immediately
 *   (`revalidatePublicMenu`), so owners see edits at once.
 * - Anything that changes it without an explicit purge (a plan lapsing, a
 *   super-admin suspension) shows within `MAX_AGE_SECONDS` at most.
 *
 * Only data that is the same for every visitor is cached. Time-dependent
 * answers — open or closed, subscription still valid — are worked out per
 * request from the cached facts.
 */

const MAX_AGE_SECONDS = 60;

export const publicMenuTag = (slug: string) => `public-menu:${slug}`;

/** Purges the cached menu and the page itself. Use wherever a public menu
 *  change is saved. */
export function revalidatePublicMenu(slug: string) {
	revalidateTag(publicMenuTag(slug), { expire: 0 });
	revalidatePath(`/${slug}`);
}

async function loadPublicMenu(slug: string) {
	// Includes suspended restaurants: the page shows them as unavailable
	// rather than a 404, so a printed QR code never lands on "not found".
	const restaurant = await db.restaurant.findFirst({
		where: { slug },
		select: {
			id: true,
			isActive: true,
			phone: true,
			name: true,
			description: true,
			logoUrl: true,
			// For share previews (link cards on WhatsApp, Instagram, Google).
			coverUrl: true,
			address: true,
			primaryColor: true,
			timezone: true,
			openingHours: {
				select: { dayOfWeek: true, opensAt: true, closesAt: true },
			},
			currency: true,
			whatsappNumber: true,
			tableReservationEnabled: true,
			activeTemplate: true,
			subscription: {
				select: {
					currentPeriodEnd: true,
					billingInterval: true,
					plan: {
						select: {
							monthlyPrice: true,
							quarterlyPrice: true,
							yearlyPrice: true,
						},
					},
				},
			},
			categories: {
				where: { isActive: true },
				orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
				select: {
					id: true,
					name: true,
					emoji: true,
					items: {
						where: { isAvailable: true },
						orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
						select: {
							id: true,
							name: true,
							description: true,
							price: true,
							imageUrl: true,
							isTodaySpecial: true,
							tags: true,
							soldOutUntil: true,
						},
					},
				},
			},
			banners: {
				where: { isActive: true },
				orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
				select: {
					id: true,
					imageUrl: true,
					title: true,
					subtitle: true,
					sortOrder: true,
					isActive: true,
				},
			},
		},
	});
	if (!restaurant) return null;

	const planFeatures = await getRestaurantPlanFeatures(restaurant.id);

	// The cache stores JSON: Decimals become numbers and dates ISO strings here,
	// explicitly, rather than whatever the serializer happens to do.
	return {
		...restaurant,
		subscription: restaurant.subscription
			? {
					billingInterval: restaurant.subscription.billingInterval,
					plan: {
						monthlyPrice: Number(restaurant.subscription.plan.monthlyPrice),
						quarterlyPrice: Number(restaurant.subscription.plan.quarterlyPrice),
						yearlyPrice: Number(restaurant.subscription.plan.yearlyPrice),
					},
					currentPeriodEnd:
						restaurant.subscription.currentPeriodEnd.toISOString(),
				}
			: null,
		categories: restaurant.categories.map((category) => ({
			...category,
			items: category.items.map((item) => ({
				...item,
				price: Number(item.price),
				// Compared with the clock per request (isSoldOut), never cached as a flag.
				soldOutUntil: item.soldOutUntil?.toISOString() ?? null,
			})),
		})),
		planFeatures,
	};
}

export async function getPublicMenu(slug: string) {
	const cached = await unstable_cache(loadPublicMenu, ["public-menu", slug], {
		tags: [publicMenuTag(slug)],
		revalidate: MAX_AGE_SECONDS,
	})(slug);
	if (!cached) return null;

	return {
		...cached,
		subscription: cached.subscription
			? {
					...cached.subscription,
					currentPeriodEnd: new Date(cached.subscription.currentPeriodEnd),
				}
			: null,
	};
}
