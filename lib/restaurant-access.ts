import { ActionError } from "@/lib/action-error";
import {
	type BillingState,
	billingStateOf,
	canTrade,
} from "@/lib/billing-state";
import { db } from "@/lib/db";

/**
 * Server-side enforcement of a restaurant's access state (lib/billing-state.ts).
 *
 * Hiding buttons isn't enforcement: server actions are public endpoints, so
 * every action that changes a restaurant or takes a new order/booking checks
 * here first.
 *
 * - **Suspended by the Super Admin** (`Restaurant.isActive = false`): nothing.
 * - **Lapsed** (paid plan unpaid past grace): read-only. Work already in
 *   progress can be finished (existing orders, confirmed bookings, refunds),
 *   nothing new starts and nothing is reconfigured until the owner pays.
 */

const subscriptionSelect = {
	currentPeriodEnd: true,
	billingInterval: true,
	plan: {
		select: {
			name: true,
			monthlyPrice: true,
			quarterlyPrice: true,
			yearlyPrice: true,
		},
	},
} as const;

export type RestaurantAccess = {
	restaurantId: string;
	name: string;
	adminSuspended: boolean;
	state: BillingState;
	canTrade: boolean;
};

async function loadAccess(where: {
	id?: string;
	slug?: string;
	ownerId?: string;
}): Promise<RestaurantAccess | null> {
	const restaurant = await db.restaurant.findFirst({
		where,
		select: {
			id: true,
			name: true,
			isActive: true,
			subscription: { select: subscriptionSelect },
		},
	});
	if (!restaurant) return null;
	const state = billingStateOf(restaurant.subscription);
	return {
		restaurantId: restaurant.id,
		name: restaurant.name,
		adminSuspended: !restaurant.isActive,
		state,
		canTrade: restaurant.isActive && canTrade(state),
	};
}

export function getRestaurantAccess(where: { id: string } | { slug: string }) {
	return loadAccess(where);
}

function sourceOf(source: FormData | { slug?: string; restaurantId?: string }) {
	if (source instanceof FormData) {
		const restaurantId = source.get("restaurantId");
		const slug = source.get("slug");
		return {
			restaurantId:
				typeof restaurantId === "string" && restaurantId
					? restaurantId
					: undefined,
			slug: typeof slug === "string" && slug ? slug : undefined,
		};
	}
	return source;
}

/**
 * Owner changing their restaurant: menu, settings, staff, tables, payment
 * setup, accepting new orders, approving new bookings. Scoped to the owner's
 * own restaurant, so it reveals nothing about anyone else's. If the
 * restaurant can't be identified the action's own ownership check fails it.
 */
export async function assertOwnerCanChange(
	userId: string,
	source: FormData | { slug?: string; restaurantId?: string },
) {
	const { restaurantId, slug } = sourceOf(source);
	if (!restaurantId && !slug) return;
	const access = await loadAccess({
		...(restaurantId ? { id: restaurantId } : { slug }),
		ownerId: userId,
	});
	if (!access) return;
	if (access.adminSuspended) {
		throw new ActionError(
			"This restaurant is suspended by AwaMenu. Contact support to restore it.",
		);
	}
	if (!access.canTrade) {
		throw new ActionError(
			access.state === "NONE"
				? "Choose a plan to start using your restaurant."
				: "Your subscription has lapsed, so changes are paused. Renew your plan to continue — everything comes back the moment you pay.",
		);
	}
}

/** Staff starting something new (approving a booking, changing the menu). */
export async function assertStaffCanChange(restaurantId: string) {
	const access = await loadAccess({ id: restaurantId });
	if (access && !access.canTrade) {
		throw new ActionError(
			"This restaurant isn't taking new orders or bookings right now. Ask the owner to renew the subscription.",
		);
	}
}

/** A customer placing a new order or booking. */
export async function assertCustomerCanOrder(restaurantId: string) {
	const access = await loadAccess({ id: restaurantId });
	if (access && !access.canTrade) {
		throw new ActionError(
			`${access.name} isn't taking online orders or bookings right now. Please contact the restaurant directly.`,
		);
	}
}

/** Same rule as `assertOwnerCanChange`, for code that has already checked
 *  ownership and holds the restaurant's id. */
export async function assertRestaurantCanChange(restaurantId: string) {
	const access = await loadAccess({ id: restaurantId });
	if (!access) return;
	if (access.adminSuspended) {
		throw new ActionError(
			"This restaurant is suspended by AwaMenu. Contact support to restore it.",
		);
	}
	if (!access.canTrade) {
		throw new ActionError(
			"Your subscription has lapsed, so changes are paused. Renew your plan to continue — everything comes back the moment you pay.",
		);
	}
}
