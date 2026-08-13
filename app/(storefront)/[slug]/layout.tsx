import type { Metadata } from "next";
import { PoweredByAwaMenu } from "@/components/shared/PoweredByAwaMenu";
import { RestaurantBrandProvider } from "@/components/shared/RestaurantBrandContext";
import { LOGO_ICON_URL } from "@/lib/logo";
import { getRestaurantPlanFeaturesBySlug } from "@/lib/plan-features";
import { getRestaurantBrand } from "@/lib/restaurant-brand";
import { getThemeStyle } from "@/lib/theme-style";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const [restaurant, planFeatures] = await Promise.all([
		getRestaurantBrand(slug),
		getRestaurantPlanFeaturesBySlug(slug),
	]);

	// "Remove AwaMenu branding" is a paid entitlement, and the favicon is
	// branding — a Free restaurant showing its own mark here was the one place
	// the rule wasn't applied.
	const icon = planFeatures.showAwamenuBranding
		? LOGO_ICON_URL
		: (restaurant?.logoUrl ?? LOGO_ICON_URL);

	return { icons: { icon, shortcut: icon, apple: icon } };
}

export default async function StorefrontLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const [restaurant, planFeatures] = await Promise.all([
		getRestaurantBrand(slug),
		getRestaurantPlanFeaturesBySlug(slug),
	]);
	const style = getThemeStyle(restaurant?.primaryColor);

	const brand = {
		name: restaurant?.name ?? null,
		// Withheld on Free so RestaurantLoadingScreen falls back to the AwaMenu
		// mark. Menu pages take the logo from their own props, so this only
		// affects the branding surfaces.
		logoUrl: planFeatures.showAwamenuBranding
			? null
			: (restaurant?.logoUrl ?? null),
		primaryColor: restaurant?.primaryColor ?? null,
		showAwamenuBranding: planFeatures.showAwamenuBranding,
	};

	return (
		<div style={style} className="flex min-h-full flex-col">
			<RestaurantBrandProvider brand={brand}>
				<div className="flex-1">{children}</div>
				{/* Rendered once here rather than per-page: every route under
				    the storefront is customer-facing, and several of them have
				    multiple early-return branches that would each need their
				    own copy (and would drift apart over time). */}
				{planFeatures.showAwamenuBranding ? <PoweredByAwaMenu /> : null}
			</RestaurantBrandProvider>
		</div>
	);
}
