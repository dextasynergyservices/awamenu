import type { Metadata } from "next";
import { RestaurantBrandProvider } from "@/components/shared/RestaurantBrandContext";
import { LOGO_ICON_URL } from "@/lib/logo";
import { getRestaurantBrand } from "@/lib/restaurant-brand";
import { getThemeStyle } from "@/lib/theme-style";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const restaurant = await getRestaurantBrand(slug);
	const icon = restaurant?.logoUrl ?? LOGO_ICON_URL;

	// Declared here, not in the root layout, so only signed-in users are
	// offered "Install app" — see the dashboard layout for why.
	return {
		manifest: "/manifest.webmanifest",
		title: restaurant ? `${restaurant.name} — Staff` : "Staff",
		// `apple` is the AwaMenu mark, not the restaurant's: iOS takes the
		// Home Screen icon from apple-touch-icon rather than the manifest, so
		// leaving it as the restaurant logo would install an app badged as one
		// restaurant. The browser-tab favicon stays restaurant-branded.
		icons: { icon, shortcut: icon, apple: LOGO_ICON_URL },
	};
}

/**
 * Supplies the restaurant's own branding to the staff area.
 *
 * Without this the staff dashboard fell back to the root layout's AwaMenu
 * favicon and the generic AwaMenu loader — so staff at a paid restaurant (which
 * has AwaMenu branding removed) saw AwaMenu's identity rather than their
 * employer's.
 */
export default async function StaffLayout({
	children,
	params,
}: Readonly<{
	children: React.ReactNode;
	params: Promise<{ slug: string }>;
}>) {
	const { slug } = await params;
	const restaurant = await getRestaurantBrand(slug);
	const style = getThemeStyle(restaurant?.primaryColor);

	const brand = {
		name: restaurant?.name ?? null,
		logoUrl: restaurant?.logoUrl ?? null,
		primaryColor: restaurant?.primaryColor ?? null,
		// Staff-facing, not customer-facing — no attribution badge regardless of
		// plan, matching how the owner's dashboard is treated.
		showAwamenuBranding: false,
	};

	return (
		<div style={style} className="h-full">
			<RestaurantBrandProvider brand={brand}>
				{children}
			</RestaurantBrandProvider>
		</div>
	);
}
