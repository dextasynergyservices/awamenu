/**
 * Catalog of the menu layouts the app implements.
 *
 * Deliberately free of any Prisma/database import so it can be shared by
 * client components (the super-admin plan editor and the layout picker are
 * both reachable from `"use client"` trees). Server-side entitlement logic
 * lives in `lib/plan-features.ts`, which builds on this.
 */
export const MENU_TEMPLATES = [
	{
		id: "classic",
		name: "Classic",
		description: "Row list with photo, name, and price.",
	},
	{
		id: "grid",
		name: "Grid",
		description: "2-column photo-forward card grid.",
	},
	{
		id: "compact",
		name: "Compact",
		description: "Dense text list, no photos.",
	},
	{
		id: "magazine",
		name: "Magazine",
		description: "Large hero-style photo cards.",
	},
] as const;

export type MenuTemplateId = (typeof MENU_TEMPLATES)[number]["id"];

export const MENU_TEMPLATE_IDS = MENU_TEMPLATES.map(
	(template) => template.id,
) as MenuTemplateId[];

/**
 * Every plan can render the base layout, so it's never something a plan has
 * to explicitly grant — the resolver always adds it back.
 */
export const BASE_MENU_TEMPLATE: MenuTemplateId = "classic";

export function isMenuTemplateId(value: string): value is MenuTemplateId {
	return (MENU_TEMPLATE_IDS as string[]).includes(value);
}
