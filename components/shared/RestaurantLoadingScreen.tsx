"use client";

import Image from "next/image";
import { useRestaurantBrand } from "@/components/shared/RestaurantBrandContext";
import { FlipText } from "@/components/ui/FlipText";
import { LOGO_ICON_URL } from "@/lib/logo";
import { getThemeStyle } from "@/lib/theme-style";

type RestaurantLoadingScreenProps = {
	/** "page" — full-screen (no shell mounted yet).
	 *  "panel" — fits inside an already-mounted dashboard shell. */
	variant?: "page" | "panel";
};

/**
 * Branded loader for a specific restaurant's public menu or dashboard.
 *
 * Reads the restaurant's name/logo/color from `RestaurantBrandContext`,
 * which the parent layout (already resolved by the time this fallback can
 * even show) supplies — not a client-side fetch. A fetch started here would
 * race the actual page content loading underneath it, and the real content
 * usually wins that race, so the fallback would never visibly update in
 * time. Context data is already available on this component's very first
 * render, so there's nothing to race.
 */
export function RestaurantLoadingScreen({
	variant = "page",
}: RestaurantLoadingScreenProps) {
	const brand = useRestaurantBrand();

	const content = (
		<div
			style={getThemeStyle(brand?.primaryColor)}
			className="flex flex-col items-center gap-5"
		>
			<Image
				src={brand?.logoUrl ?? LOGO_ICON_URL}
				alt={brand?.name ?? "AwaMenu"}
				width={72}
				height={72}
				className="size-16 rounded-2xl object-contain shadow-[0_16px_40px_rgba(6,78,59,0.14)]"
				priority
			/>
			<FlipText
				className="text-xl font-black tracking-tight text-emerald-800 sm:text-2xl"
				duration={0.9}
			>
				Loading
			</FlipText>
		</div>
	);

	if (variant === "panel") {
		return (
			<div className="grid min-h-[60vh] place-items-center py-6">{content}</div>
		);
	}

	return (
		<main className="grid min-h-screen place-items-center bg-[#f6faf7] px-4">
			{content}
		</main>
	);
}
