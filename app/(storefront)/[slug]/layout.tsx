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
	const restaurant = await getRestaurantBrand(slug);
	const style = getThemeStyle(restaurant?.primaryColor);

	const brand = {
		name: restaurant?.name ?? null,
		logoUrl: restaurant?.logoUrl ?? null,
		primaryColor: restaurant?.primaryColor ?? null,
	};

	return (
		<div style={style} className="h-full">
			<RestaurantBrandProvider brand={brand}>
				{children}
			</RestaurantBrandProvider>
		</div>
	);
}
