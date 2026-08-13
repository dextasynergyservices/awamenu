import { db } from "@/lib/db";

export type SetupTask = {
	id: string;
	label: string;
	/** What they get by doing it, not what the field is called. */
	why: string;
	href: string;
	done: boolean;
	/** Blocks the restaurant from trading at all until it's done. */
	blocking: boolean;
};

/**
 * What a new restaurant still has to do, worked out from the data itself.
 *
 * Every item is derived from a real row rather than a "has seen this" flag.
 * Flags drift — someone opens the payments page, the flag flips, and the
 * checklist starts claiming work that never happened. A checklist that lies is
 * worse than none, because it stops people looking.
 *
 * Ordered by consequence: things that stop them taking orders or money first,
 * polish afterwards.
 */
export async function getSetupTasks(slug: string): Promise<SetupTask[]> {
	const restaurant = await db.restaurant.findFirst({
		where: { slug },
		select: {
			id: true,
			logoUrl: true,
			phone: true,
			address: true,
			staffDashboardPassword: true,
		},
	});
	if (!restaurant) return [];

	const base = `/dashboard/${slug}`;

	// One round trip for every count rather than six in sequence.
	const [items, categories, payouts, ownGateway, manualPayment, hours] =
		await Promise.all([
			db.menuItem.count({
				where: { category: { restaurantId: restaurant.id } },
			}),
			db.menuCategory.count({ where: { restaurantId: restaurant.id } }),
			db.restaurantPayoutAccount.count({
				where: { restaurantId: restaurant.id, isEnabled: true },
			}),
			db.restaurantPaymentMethod.count({
				where: {
					restaurantId: restaurant.id,
					channel: "OWN_GATEWAY",
					isEnabled: true,
					NOT: { secretKeyEncrypted: null },
				},
			}),
			db.restaurantPaymentMethod.count({
				where: {
					restaurantId: restaurant.id,
					channel: { in: ["BANK_TRANSFER", "CASH"] },
					isEnabled: true,
				},
			}),
			db.restaurantOpeningHour.count({
				where: { restaurantId: restaurant.id },
			}),
		]);

	return [
		{
			id: "menu",
			label: "Add your first menu items",
			why: "Customers can't order from an empty menu.",
			href: `${base}/menu`,
			done: categories > 0 && items > 0,
			blocking: true,
		},
		{
			id: "payments",
			label: "Choose how you get paid",
			why: "Online payment stays hidden at checkout until a payout account is connected.",
			href: `${base}/settings#payments`,
			done: payouts > 0 || ownGateway > 0 || manualPayment > 0,
			blocking: true,
		},
		{
			id: "hours",
			label: "Set your opening hours",
			why: "Your menu shows Open now around the clock until you do.",
			href: `${base}/settings#hours`,
			done: hours > 0,
			blocking: false,
		},
		{
			id: "contact",
			label: "Add your phone number and address",
			why: "Customers use these to find you and ask about orders.",
			href: `${base}/settings#contact`,
			done: Boolean(restaurant.phone && restaurant.address),
			blocking: false,
		},
		{
			id: "branding",
			label: "Upload your logo",
			why: "It becomes your menu's icon and loading screen on paid plans.",
			href: `${base}/settings#branding`,
			done: Boolean(restaurant.logoUrl),
			blocking: false,
		},
		{
			id: "staff",
			label: "Set a staff password",
			why: "Lets your team take orders from their own devices.",
			href: `${base}/settings#staff`,
			done: Boolean(restaurant.staffDashboardPassword),
			blocking: false,
		},
	];
}
