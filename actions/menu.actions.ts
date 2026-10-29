"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, actionResult } from "@/lib/action-error";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { normalizeMenuTags } from "@/lib/menu-tags";
import { getRestaurantPlanFeatures } from "@/lib/plan-features";
import { revalidatePublicMenu } from "@/lib/public-menu";
import { assertRestaurantCanChange } from "@/lib/restaurant-access";
import { startOfNextDayIn } from "@/lib/restaurant-day";

const restaurantSchema = z.object({
	restaurantId: z.string().cuid(),
	slug: z.string().min(1),
});

const bannerSchema = restaurantSchema.extend({
	imageUrl: z.string().url(),
	title: z.string().max(80).optional(),
	subtitle: z.string().max(160).optional(),
	sortOrder: z.coerce.number().int().min(0).default(0),
	isActive: z.coerce.boolean().default(true),
});

const updateBannerSchema = bannerSchema.extend({
	bannerId: z.string().cuid(),
});

const removeBannerSchema = restaurantSchema.extend({
	bannerId: z.string().cuid(),
});

const categorySchema = restaurantSchema.extend({
	name: z.string().min(1).max(80),
	emoji: z.string().max(8).optional(),
	sortOrder: z.coerce.number().int().min(0).default(0),
});

const updateCategorySchema = categorySchema.extend({
	categoryId: z.string().cuid(),
	isActive: z.coerce.boolean().default(true),
});

const categoryIdSchema = restaurantSchema.extend({
	categoryId: z.string().cuid(),
});

const itemSchema = restaurantSchema.extend({
	categoryId: z.string().cuid(),
	name: z.string().min(1).max(120),
	description: z.string().max(300).optional(),
	price: z.coerce.number().min(0),
	imageUrl: z.string().url().optional(),
	sortOrder: z.coerce.number().int().min(0).default(0),
	isAvailable: z.coerce.boolean().default(true),
	isTodaySpecial: z.coerce.boolean().default(false),
});

/**
 * Tags only when the form actually has the tag picker (it sends a "tagsField"
 * marker). Quick-edit forms that post the other fields must not wipe them.
 */
function tagsFromForm(formData: FormData) {
	return formData.has("tagsField")
		? { tags: normalizeMenuTags(formData.getAll("tags")) }
		: {};
}

const updateItemSchema = itemSchema.extend({
	itemId: z.string().cuid(),
});

const itemIdSchema = restaurantSchema.extend({
	itemId: z.string().cuid(),
});

async function requireOwnedRestaurant(restaurantId: string) {
	const user = await requireUser();
	const restaurant = await db.restaurant.findFirst({
		where: { id: restaurantId, ownerId: user.id },
		select: {
			id: true,
			slug: true,
			subscription: {
				select: {
					plan: {
						select: { maxCategories: true, maxMenuItems: true },
					},
				},
			},
		},
	});

	if (!restaurant) {
		throw new ActionError("Restaurant not found.");
	}

	// Every menu change goes through here: a lapsed or suspended restaurant's
	// menu is read-only until the owner renews.
	await assertRestaurantCanChange(restaurant.id);

	return restaurant;
}

/**
 * Ownership check plus the limits the restaurant is entitled to *now*.
 *
 * Resolved through the shared plan resolver, which treats a lapsed paid plan as
 * Free — reading `subscription.plan` directly let a restaurant whose Pro plan
 * had expired keep creating categories and items without limit.
 */
async function getPlanLimits(restaurantId: string) {
	const restaurant = await requireOwnedRestaurant(restaurantId);
	const features = await getRestaurantPlanFeatures(restaurant.id);
	return {
		restaurant,
		maxCategories: features.maxCategories,
		maxMenuItems: features.maxMenuItems,
	};
}

function isWithinLimit(current: number, max: number) {
	return max < 0 || current < max;
}

export async function createCategoryAction(formData: FormData) {
	return actionResult(async () => {
		const input = categorySchema.parse({
			restaurantId: formData.get("restaurantId"),
			slug: formData.get("slug"),
			name: formData.get("name"),
			emoji: formData.get("emoji") || undefined,
			sortOrder: formData.get("sortOrder") || 0,
		});
		const { maxCategories } = await getPlanLimits(input.restaurantId);
		const categoryCount = await db.menuCategory.count({
			where: { restaurantId: input.restaurantId },
		});

		if (!isWithinLimit(categoryCount, maxCategories)) {
			throw new ActionError("Plan category limit reached.");
		}

		await db.menuCategory.create({
			data: {
				restaurantId: input.restaurantId,
				name: input.name,
				emoji: input.emoji,
				sortOrder: input.sortOrder,
			},
		});
		revalidatePath(`/dashboard/${input.slug}/menu`);
		revalidatePublicMenu(input.slug);
	});
}

export async function createBannerAction(formData: FormData) {
	return actionResult(async () => {
		const input = bannerSchema.parse({
			restaurantId: formData.get("restaurantId"),
			slug: formData.get("slug"),
			imageUrl: formData.get("imageUrl"),
			title: formData.get("title") || undefined,
			subtitle: formData.get("subtitle") || undefined,
			sortOrder: formData.get("sortOrder") || 0,
			isActive: formData.get("isActive") === "on",
		});
		await requireOwnedRestaurant(input.restaurantId);
		await db.restaurantBanner.create({
			data: {
				restaurantId: input.restaurantId,
				imageUrl: input.imageUrl,
				title: input.title,
				subtitle: input.subtitle,
				sortOrder: input.sortOrder,
				isActive: input.isActive,
			},
		});
		revalidatePath(`/dashboard/${input.slug}/menu`);
		revalidatePublicMenu(input.slug);
	});
}

export async function updateBannerAction(formData: FormData) {
	return actionResult(async () => {
		const input = updateBannerSchema.parse({
			restaurantId: formData.get("restaurantId"),
			slug: formData.get("slug"),
			bannerId: formData.get("bannerId"),
			imageUrl: formData.get("imageUrl"),
			title: formData.get("title") || undefined,
			subtitle: formData.get("subtitle") || undefined,
			sortOrder: formData.get("sortOrder") || 0,
			isActive: formData.get("isActive") === "on",
		});
		await requireOwnedRestaurant(input.restaurantId);
		await db.restaurantBanner.updateMany({
			where: { id: input.bannerId, restaurantId: input.restaurantId },
			data: {
				imageUrl: input.imageUrl,
				title: input.title,
				subtitle: input.subtitle,
				sortOrder: input.sortOrder,
				isActive: input.isActive,
			},
		});
		revalidatePath(`/dashboard/${input.slug}/menu`);
		revalidatePublicMenu(input.slug);
	});
}

export async function removeBannerAction(formData: FormData) {
	return actionResult(async () => {
		const input = removeBannerSchema.parse({
			restaurantId: formData.get("restaurantId"),
			slug: formData.get("slug"),
			bannerId: formData.get("bannerId"),
		});
		await requireOwnedRestaurant(input.restaurantId);
		await db.restaurantBanner.deleteMany({
			where: { id: input.bannerId, restaurantId: input.restaurantId },
		});
		revalidatePath(`/dashboard/${input.slug}/menu`);
		revalidatePublicMenu(input.slug);
	});
}

export async function updateCategoryAction(formData: FormData) {
	return actionResult(async () => {
		const input = updateCategorySchema.parse({
			restaurantId: formData.get("restaurantId"),
			slug: formData.get("slug"),
			categoryId: formData.get("categoryId"),
			name: formData.get("name"),
			emoji: formData.get("emoji") || undefined,
			sortOrder: formData.get("sortOrder") || 0,
			isActive: formData.get("isActive") === "on",
		});
		await requireOwnedRestaurant(input.restaurantId);
		await db.menuCategory.update({
			where: { id: input.categoryId, restaurantId: input.restaurantId },
			data: {
				name: input.name,
				emoji: input.emoji,
				sortOrder: input.sortOrder,
				isActive: input.isActive,
			},
		});
		revalidatePath(`/dashboard/${input.slug}/menu`);
		revalidatePublicMenu(input.slug);
	});
}

export async function deleteCategoryAction(formData: FormData) {
	return actionResult(async () => {
		const input = categoryIdSchema.parse({
			restaurantId: formData.get("restaurantId"),
			slug: formData.get("slug"),
			categoryId: formData.get("categoryId"),
		});
		await requireOwnedRestaurant(input.restaurantId);
		await db.menuCategory.delete({
			where: { id: input.categoryId, restaurantId: input.restaurantId },
		});
		revalidatePath(`/dashboard/${input.slug}/menu`);
		revalidatePublicMenu(input.slug);
	});
}

export async function createMenuItemAction(formData: FormData) {
	return actionResult(async () => {
		const input = itemSchema.parse({
			restaurantId: formData.get("restaurantId"),
			slug: formData.get("slug"),
			categoryId: formData.get("categoryId"),
			name: formData.get("name"),
			description: formData.get("description") || undefined,
			price: formData.get("price"),
			imageUrl: formData.get("imageUrl") || undefined,
			sortOrder: formData.get("sortOrder") || 0,
			isAvailable: formData.get("isAvailable") === "on",
			isTodaySpecial: formData.get("isTodaySpecial") === "on",
		});
		const { maxMenuItems } = await getPlanLimits(input.restaurantId);
		const menuItemCount = await db.menuItem.count({
			where: { category: { restaurantId: input.restaurantId } },
		});

		if (!isWithinLimit(menuItemCount, maxMenuItems)) {
			throw new ActionError("Plan menu item limit reached.");
		}

		const category = await db.menuCategory.findFirst({
			where: { id: input.categoryId, restaurantId: input.restaurantId },
			select: { id: true },
		});

		if (!category) {
			throw new ActionError("Category not found.");
		}

		await db.menuItem.create({
			data: {
				categoryId: input.categoryId,
				name: input.name,
				description: input.description,
				price: input.price,
				imageUrl: input.imageUrl,
				sortOrder: input.sortOrder,
				isAvailable: input.isAvailable,
				isTodaySpecial: input.isTodaySpecial,
				...tagsFromForm(formData),
			},
		});
		revalidatePath(`/dashboard/${input.slug}/menu`);
		revalidatePublicMenu(input.slug);
	});
}

export async function updateMenuItemAction(formData: FormData) {
	return actionResult(async () => {
		const input = updateItemSchema.parse({
			restaurantId: formData.get("restaurantId"),
			slug: formData.get("slug"),
			itemId: formData.get("itemId"),
			categoryId: formData.get("categoryId"),
			name: formData.get("name"),
			description: formData.get("description") || undefined,
			price: formData.get("price"),
			imageUrl: formData.get("imageUrl") || undefined,
			sortOrder: formData.get("sortOrder") || 0,
			isAvailable: formData.get("isAvailable") === "on",
			isTodaySpecial: formData.get("isTodaySpecial") === "on",
		});
		await requireOwnedRestaurant(input.restaurantId);
		const item = await db.menuItem.findFirst({
			where: {
				id: input.itemId,
				category: { restaurantId: input.restaurantId },
			},
			select: { id: true },
		});

		if (!item) {
			throw new ActionError("Menu item not found.");
		}

		// The destination category must be this restaurant's too. Only the item
		// was checked before, so an owner could move their own item into another
		// restaurant's category — publishing it on that restaurant's menu.
		const category = await db.menuCategory.findFirst({
			where: { id: input.categoryId, restaurantId: input.restaurantId },
			select: { id: true },
		});
		if (!category) {
			throw new ActionError("Category not found.");
		}

		await db.menuItem.update({
			where: { id: input.itemId },
			data: {
				categoryId: input.categoryId,
				name: input.name,
				description: input.description,
				price: input.price,
				imageUrl: input.imageUrl,
				sortOrder: input.sortOrder,
				isAvailable: input.isAvailable,
				isTodaySpecial: input.isTodaySpecial,
				...tagsFromForm(formData),
			},
		});
		revalidatePath(`/dashboard/${input.slug}/menu`);
		revalidatePublicMenu(input.slug);
	});
}

const soldOutSchema = itemIdSchema.extend({
	soldOut: z.enum(["today", "off"]),
});

/**
 * "Sold out today": the dish stays on the menu, greyed out and unorderable,
 * until the restaurant's next day starts. Clears itself; no cron involved.
 */
export async function setMenuItemSoldOutAction(formData: FormData) {
	return actionResult(async () => {
		const input = soldOutSchema.parse({
			restaurantId: formData.get("restaurantId"),
			slug: formData.get("slug"),
			itemId: formData.get("itemId"),
			soldOut: formData.get("soldOut"),
		});
		await requireOwnedRestaurant(input.restaurantId);
		const item = await db.menuItem.findFirst({
			where: {
				id: input.itemId,
				category: { restaurantId: input.restaurantId },
			},
			select: {
				id: true,
				category: { select: { restaurant: { select: { timezone: true } } } },
			},
		});
		if (!item) throw new ActionError("Menu item not found.");

		const timeZone = item.category.restaurant.timezone;
		await db.menuItem.update({
			where: { id: item.id },
			data: {
				soldOutUntil:
					input.soldOut === "today" ? startOfNextDayIn(timeZone) : null,
			},
		});
		revalidatePath(`/dashboard/${input.slug}/menu`);
		revalidatePublicMenu(input.slug);
	});
}

export async function deleteMenuItemAction(formData: FormData) {
	return actionResult(async () => {
		const input = itemIdSchema.parse({
			restaurantId: formData.get("restaurantId"),
			slug: formData.get("slug"),
			itemId: formData.get("itemId"),
		});
		await requireOwnedRestaurant(input.restaurantId);
		const item = await db.menuItem.findFirst({
			where: {
				id: input.itemId,
				category: { restaurantId: input.restaurantId },
			},
			select: { id: true },
		});

		if (!item) {
			throw new ActionError("Menu item not found.");
		}

		await db.menuItem.delete({ where: { id: input.itemId } });
		revalidatePath(`/dashboard/${input.slug}/menu`);
		revalidatePublicMenu(input.slug);
	});
}
