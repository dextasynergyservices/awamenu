import type { PlanTier } from "@prisma/client";
import { cache } from "react";
import { db } from "@/lib/db";
import {
	BASE_MENU_TEMPLATE,
	isMenuTemplateId,
	type MenuTemplateId,
} from "@/lib/menu-templates";
import { isSubscriptionActive } from "@/lib/subscription";

// `Plan.availableTemplates` is free-form text in the database, so anything
// outside the implemented catalog is filtered out rather than trusted — a typo
// in the super-admin plan editor shouldn't put a restaurant on a layout that
// doesn't render.

export type PlanFeatures = {
	planName: string;
	tier: PlanTier;
	maxCategories: number;
	maxTables: number;
	maxMenuItems: number;
	advancedAnalytics: boolean;
	whatsappIntegration: boolean;
	prioritySupport: boolean;
	basicSupport: boolean;
	/** Inverted from `Plan.removeAwamenuBranding` so every call site reads as
	 * "should I show the badge?" instead of a double negative. */
	showAwamenuBranding: boolean;
	/** Always includes "classic" — every plan can render the base layout, so a
	 * misconfigured plan row can never leave a restaurant with zero options. */
	availableTemplates: MenuTemplateId[];
};

/**
 * Last-resort defaults, used only if the Free plan row is missing from the
 * database entirely. Deliberately the most restrictive possible answer: an
 * unknown plan must never accidentally unlock paid features.
 */
const FALLBACK_FREE: PlanFeatures = {
	planName: "Free",
	tier: "FREE",
	maxCategories: 1,
	maxTables: 1,
	maxMenuItems: 8,
	advancedAnalytics: false,
	whatsappIntegration: true,
	prioritySupport: false,
	basicSupport: false,
	showAwamenuBranding: true,
	availableTemplates: [BASE_MENU_TEMPLATE],
};

type PlanRow = {
	name: string;
	tier: PlanTier;
	maxCategories: number;
	maxTables: number;
	maxMenuItems: number;
	advancedAnalytics: boolean;
	whatsappIntegration: boolean;
	prioritySupport: boolean;
	basicSupport: boolean;
	removeAwamenuBranding: boolean;
	availableTemplates: string[];
};

const planSelect = {
	name: true,
	tier: true,
	maxCategories: true,
	maxTables: true,
	maxMenuItems: true,
	advancedAnalytics: true,
	whatsappIntegration: true,
	prioritySupport: true,
	basicSupport: true,
	removeAwamenuBranding: true,
	availableTemplates: true,
} as const;

function toFeatures(plan: PlanRow): PlanFeatures {
	const allowed = plan.availableTemplates.filter(isMenuTemplateId);

	return {
		planName: plan.name,
		tier: plan.tier,
		maxCategories: plan.maxCategories,
		maxTables: plan.maxTables,
		maxMenuItems: plan.maxMenuItems,
		advancedAnalytics: plan.advancedAnalytics,
		whatsappIntegration: plan.whatsappIntegration,
		prioritySupport: plan.prioritySupport,
		basicSupport: plan.basicSupport,
		showAwamenuBranding: !plan.removeAwamenuBranding,
		availableTemplates: Array.from(
			new Set<MenuTemplateId>([BASE_MENU_TEMPLATE, ...allowed]),
		),
	};
}

const getFreePlanFeatures = cache(async (): Promise<PlanFeatures> => {
	const freePlan = await db.plan.findUnique({
		where: { tier: "FREE" },
		select: planSelect,
	});

	return freePlan ? toFeatures(freePlan) : FALLBACK_FREE;
});

/**
 * Resolves the features a restaurant is *actually* entitled to right now.
 *
 * This is the single source of truth for plan enforcement — every gate
 * (branding, templates, analytics, WhatsApp, limits) should read from here
 * rather than inspecting `subscription.plan` directly, so a lapsed or missing
 * subscription degrades to Free consistently everywhere instead of each call
 * site inventing its own fallback.
 *
 * Request-deduped via `cache()`, so multiple gates on one page cost one query.
 */
export const getRestaurantPlanFeatures = cache(
	async (restaurantId: string): Promise<PlanFeatures> => {
		const subscription = await db.subscription.findFirst({
			where: { restaurantId },
			select: {
				status: true,
				currentPeriodEnd: true,
				plan: { select: planSelect },
			},
		});

		// A lapsed subscription keeps the row but loses the entitlements — the
		// restaurant falls back to Free rather than retaining paid features.
		if (!subscription || !isSubscriptionActive(subscription)) {
			return getFreePlanFeatures();
		}

		return toFeatures(subscription.plan);
	},
);

/**
 * Same resolution as `getRestaurantPlanFeatures`, keyed by slug for the public
 * storefront (which routes by slug and often hasn't loaded the id yet).
 */
export const getRestaurantPlanFeaturesBySlug = cache(
	async (slug: string): Promise<PlanFeatures> => {
		const restaurant = await db.restaurant.findFirst({
			where: { slug },
			select: { id: true },
		});

		if (!restaurant) return getFreePlanFeatures();

		return getRestaurantPlanFeatures(restaurant.id);
	},
);
