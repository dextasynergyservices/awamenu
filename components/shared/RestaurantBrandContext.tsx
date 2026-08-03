"use client";

import { createContext, useContext } from "react";

export type RestaurantBrand = {
	name: string | null;
	logoUrl: string | null;
	primaryColor: string | null;
	/** Whether this restaurant's plan still carries AwaMenu attribution.
	 * Carried here (rather than resolved where it's used) so the loading
	 * screen — which can't run a query — can render the badge on its first
	 * paint instead of popping it in later. */
	showAwamenuBranding: boolean;
};

const RestaurantBrandContext = createContext<RestaurantBrand | null>(null);

/**
 * Carries a restaurant's own branding (name/logo/color) down from a layout
 * that has already resolved it server-side, so a `loading.tsx` fallback
 * nested underneath can render the correct brand on its very first paint.
 *
 * This exists because the fallback itself can't fetch this data: fetching
 * it client-side after mount races the actual page content (which usually
 * wins, so the fallback never visibly updates), and fetching it server-side
 * inside `loading.tsx` breaks React's streaming renderer (fallbacks must
 * render synchronously). Reading it from context — data the parent layout
 * already had in hand before the fallback was ever shown — has neither
 * problem.
 */
export function RestaurantBrandProvider({
	brand,
	children,
}: {
	brand: RestaurantBrand;
	children: React.ReactNode;
}) {
	return (
		<RestaurantBrandContext.Provider value={brand}>
			{children}
		</RestaurantBrandContext.Provider>
	);
}

export function useRestaurantBrand(): RestaurantBrand | null {
	return useContext(RestaurantBrandContext);
}
