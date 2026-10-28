/**
 * Dietary and allergen labels an owner can put on a dish. A fixed list, so
 * customers see consistent wording and the menu can't fill with free text.
 * Stored on MenuItem.tags by key.
 */

export const MENU_TAGS = [
	{ key: "VEGETARIAN", label: "Vegetarian", short: "Veg" },
	{ key: "VEGAN", label: "Vegan", short: "Vegan" },
	{ key: "SPICY", label: "Spicy", short: "Spicy" },
	{ key: "GLUTEN_FREE", label: "Gluten-free", short: "GF" },
	{ key: "DAIRY_FREE", label: "Dairy-free", short: "DF" },
	{ key: "CONTAINS_NUTS", label: "Contains nuts", short: "Nuts" },
	{ key: "HALAL", label: "Halal", short: "Halal" },
] as const;

export type MenuTagKey = (typeof MENU_TAGS)[number]["key"];

const KEYS = new Set<string>(MENU_TAGS.map((tag) => tag.key));

/** Keeps known keys only, in the list's order, without duplicates. */
export function normalizeMenuTags(values: unknown[]): MenuTagKey[] {
	const given = new Set(values.map(String));
	return MENU_TAGS.map((tag) => tag.key).filter(
		(key) => given.has(key) && KEYS.has(key),
	);
}

export function menuTagLabel(key: string): string | null {
	return MENU_TAGS.find((tag) => tag.key === key)?.label ?? null;
}

/** Sold out right now? `soldOutUntil` may be a Date or an ISO string (cache). */
export function isSoldOut(
	soldOutUntil: Date | string | null | undefined,
	now: number = Date.now(),
): boolean {
	if (!soldOutUntil) return false;
	return new Date(soldOutUntil).getTime() > now;
}

/** A dish as the public menu renders it. `soldOut` is worked out per request. */
export type PublicMenuItem = {
	id: string;
	name: string;
	description: string | null;
	price: number;
	imageUrl: string | null;
	isTodaySpecial: boolean;
	tags: string[];
	soldOut: boolean;
};

/** Case- and accent-insensitive match on name, description and tag labels. */
export function matchesMenuSearch(
	item: Pick<PublicMenuItem, "name" | "description" | "tags">,
	query: string,
): boolean {
	const fold = (text: string) =>
		text
			.normalize("NFD")
			.replace(/\p{Diacritic}/gu, "")
			.toLowerCase();
	const words = fold(query).split(/\s+/).filter(Boolean);
	if (words.length === 0) return true;
	const haystack = fold(
		[
			item.name,
			item.description ?? "",
			...item.tags.map((key) => menuTagLabel(key) ?? ""),
		].join(" "),
	);
	return words.every((word) => haystack.includes(word));
}
