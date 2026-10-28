import { createHash } from "node:crypto";
import type { Metadata } from "next";
import { env } from "@/env";
import { getPublicMenu } from "@/lib/public-menu";

/**
 * How a restaurant's links look when shared: the title, description and
 * preview card on WhatsApp, Instagram, X and in Google results.
 *
 * Follows the branding rule: on plans that remove AwaMenu branding, nothing
 * here mentions AwaMenu; on other plans the title ends "| AwaMenu".
 *
 * Reads the same cached load as the menu page, so it costs no extra query.
 */

/** Bump when the card's design changes, so every restaurant gets a new URL. */
const CARD_DESIGN = "2";

export async function getStorefrontShare(slug: string) {
	const menu = await getPublicMenu(slug);
	if (!menu) return null;
	const card = {
		name: menu.name,
		description: menu.description,
		address: menu.address,
		logoUrl: menu.logoUrl,
		coverUrl: menu.coverUrl,
		primaryColor: menu.primaryColor,
		bookings: menu.tableReservationEnabled,
		// For the preview card when there's no cover photo: today's specials
		// first, then the menu in order.
		dishPhotos: menu.categories
			.flatMap((c) => c.items)
			.filter((item) => item.imageUrl)
			.sort((a, b) => Number(b.isTodaySpecial) - Number(a.isTodaySpecial))
			.slice(0, 3)
			.map((item) => item.imageUrl as string),
		branded: !menu.planFeatures.showAwamenuBranding,
	};
	return {
		...card,
		slug,
		phone: menu.phone,
		isActive: menu.isActive,
		openingHours: menu.openingHours,
		/**
		 * Fingerprint of everything drawn on the preview card. Any change (a new
		 * logo, cover, dish photo, name, colour, plan) gives the card a new URL,
		 * so it shows on the very next share. The menu cache is purged on every
		 * one of those saves, so this is current immediately.
		 */
		imageVersion: createHash("sha256")
			.update(JSON.stringify([CARD_DESIGN, card]))
			.digest("hex")
			.slice(0, 12),
	};
}

export type StorefrontShare = NonNullable<
	Awaited<ReturnType<typeof getStorefrontShare>>
>;

/** "Edis Bar", or "Edis Bar · Book a table"; "| AwaMenu" only on unbranded plans. */
export function shareTitle(share: StorefrontShare, page?: string) {
	const base = page ? `${share.name} · ${page}` : share.name;
	return share.branded ? base : `${base} | AwaMenu`;
}

/** The restaurant's own description, or one built from what it offers. */
export function shareDescription(share: StorefrontShare, page?: "tables") {
	if (page === "tables") {
		return `Book a table at ${share.name}${share.address ? `, ${share.address}` : ""}. Choose your time and pre-order food.`;
	}
	const own = share.description?.trim();
	if (own) return own.length > 180 ? `${own.slice(0, 177).trimEnd()}…` : own;
	return `See ${share.name}'s menu and prices and order online${share.bookings ? " or book a table" : ""}${share.address ? `. ${share.address}` : ""}.`;
}

/**
 * Full metadata for a storefront page, including the preview card
 * (share-image/route.tsx) at a versioned URL.
 */
export function storefrontMetadata(
	share: StorefrontShare,
	options: { page?: string; description?: string; path?: string } = {},
): Metadata {
	const title = shareTitle(share, options.page);
	const description = options.description ?? shareDescription(share);
	const url = `${env.NEXT_PUBLIC_APP_URL ?? ""}/${share.slug}${options.path ?? ""}`;
	const image = {
		url: `/${share.slug}/share-image?v=${share.imageVersion}`,
		width: 1200,
		height: 630,
		type: "image/jpeg",
		alt: `${share.name}: menu, prices and online ordering`,
	};
	return {
		title,
		description,
		alternates: { canonical: url },
		openGraph: {
			type: "website",
			url,
			title,
			description,
			siteName: share.name,
			locale: "en_NG",
			images: [image],
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
			images: [image],
		},
		// "Add to home screen" shows the restaurant, not AwaMenu.
		appleWebApp: {
			capable: true,
			title: share.name,
			statusBarStyle: "default",
		},
		...(share.isActive ? {} : { robots: { index: false, follow: false } }),
	};
}

/**
 * Pages only the customer should see (their order, booking, rating, cart):
 * branded title, link preview kept, never indexed by search engines.
 */
export async function privateStorefrontMetadata(
	slug: string,
	page: string,
): Promise<Metadata> {
	const share = await getStorefrontShare(slug);
	if (!share) return { robots: { index: false, follow: false } };
	return {
		...storefrontMetadata(share, { page }),
		alternates: undefined,
		robots: { index: false, follow: false },
	};
}
