import {
	type EmailBrand,
	platformBrand,
	restaurantBrand,
} from "@/emails/brand";
import { env, requireEnv } from "@/env";
import { db } from "@/lib/db";
import { getRestaurantPlanFeatures } from "@/lib/plan-features";

/** Quotes a display name safely for a From header. */
function displayName(name: string) {
	return `"${name.replace(/["<>\\\r\n]/g, "").trim() || "Restaurant"}"`;
}

/**
 * How a restaurant's guest emails look and who they come from.
 *
 * The From name is the restaurant's ("… via AwaMenu" only on plans that keep
 * AwaMenu branding). The address stays on AwaMenu's verified domain: a
 * restaurant hasn't authorised us to send as theirs, and SPF/DKIM would fail
 * if we tried. Replies go to the owner, not to us.
 */
export async function getRestaurantEmailIdentity(restaurantId: string) {
	const restaurant = await db.restaurant.findUniqueOrThrow({
		where: { id: restaurantId },
		select: {
			name: true,
			slug: true,
			logoUrl: true,
			primaryColor: true,
			address: true,
			phone: true,
			owner: { select: { email: true } },
		},
	});
	const { showAwamenuBranding } = await getRestaurantPlanFeatures(restaurantId);
	const brand = restaurantBrand({
		...restaurant,
		poweredBy: showAwamenuBranding,
		appUrl: env.NEXT_PUBLIC_APP_URL ?? "https://awamenu.com",
	});
	const name = showAwamenuBranding
		? `${restaurant.name} via AwaMenu`
		: restaurant.name;
	return {
		brand,
		from: `${displayName(name)} <${requireEnv("RESEND_FROM_EMAIL")}>`,
		replyTo: restaurant.owner.email,
	};
}

export type RestaurantEmailIdentity = Awaited<
	ReturnType<typeof getRestaurantEmailIdentity>
>;

/**
 * AwaMenu's own brand, with the logo uploaded in Super Admin → Settings
 * (a monogram until one is uploaded).
 */
export async function getPlatformBrand(): Promise<EmailBrand> {
	const settings = await db.platformSetting.findFirst({
		select: { logoUrl: true },
	});
	return platformBrand(
		env.NEXT_PUBLIC_APP_URL ?? "https://awamenu.com",
		settings?.logoUrl ?? null,
	);
}
