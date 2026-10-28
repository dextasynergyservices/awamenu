/**
 * Who an email looks like it comes from.
 *
 * Two kinds, never mixed:
 * - "restaurant": anything a guest receives about one restaurant (orders,
 *   bookings, sign-in codes). It wears the restaurant's name, logo and colour.
 *   "Powered by AwaMenu" appears only on plans that keep AwaMenu branding.
 * - "platform": AwaMenu writing to a restaurant owner (accounts, billing, new
 *   orders). Always AwaMenu's own branding.
 *
 * Pure (no database), so previews can build brands from sample data.
 */

export type EmailBrand = {
	kind: "restaurant" | "platform";
	name: string;
	/** Absolute https URL, or null to show a monogram instead. */
	logoUrl: string | null;
	/** Background of buttons and the card's top rule. */
	accent: string;
	/** Text on top of `accent`. */
	onAccent: string;
	/** `accent` when it's readable on white, otherwise near-black. */
	accentText: string;
	address: string | null;
	phone: string | null;
	/** Restaurant emails only: the plan shows "Powered by AwaMenu". */
	poweredBy: boolean;
	/** Where the logo/name links: the restaurant's menu, or AwaMenu. */
	homeUrl: string;
};

const AWAMENU_GREEN = "#047857";
const INK = "#0f172a";

/** "#abc" / "abc" / "#aabbcc" → "#aabbcc"; anything else → null. */
export function normalizeHex(value: string | null | undefined): string | null {
	const match = value?.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
	if (!match) return null;
	const hex =
		match[1].length === 3 ? [...match[1]].map((c) => c + c).join("") : match[1];
	return `#${hex.toLowerCase()}`;
}

function luminance(hex: string) {
	const channel = (i: number) => {
		const v = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

/**
 * Colours derived from a restaurant's brand colour, kept legible: a pale
 * yellow brand still gets dark button text and dark links.
 */
export function brandColors(primary: string | null | undefined) {
	const accent = normalizeHex(primary) ?? AWAMENU_GREEN;
	return {
		accent,
		onAccent:
			contrast(accent, "#ffffff") >= contrast(accent, INK) ? "#ffffff" : INK,
		accentText: contrast(accent, "#ffffff") >= 4.5 ? accent : INK,
	};
}

/** Only absolute https images load reliably in mail clients. */
function safeLogo(url: string | null | undefined) {
	return url && /^https:\/\//i.test(url) ? url : null;
}

export function restaurantBrand(input: {
	name: string;
	slug: string;
	logoUrl: string | null;
	primaryColor: string | null;
	address: string | null;
	phone: string | null;
	poweredBy: boolean;
	appUrl: string;
}): EmailBrand {
	return {
		kind: "restaurant",
		name: input.name,
		logoUrl: safeLogo(input.logoUrl),
		...brandColors(input.primaryColor),
		address: input.address,
		phone: input.phone,
		poweredBy: input.poweredBy,
		homeUrl: `${input.appUrl}/${input.slug}`,
	};
}

export function platformBrand(
	appUrl: string,
	logoUrl: string | null = null,
): EmailBrand {
	return {
		kind: "platform",
		name: "AwaMenu",
		logoUrl: safeLogo(logoUrl),
		...brandColors(AWAMENU_GREEN),
		address: null,
		phone: null,
		poweredBy: false,
		homeUrl: appUrl,
	};
}
