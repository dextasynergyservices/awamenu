import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RestaurantUnavailable } from "@/components/menu/RestaurantUnavailable";
import { TableReservationFlow } from "@/components/reservation/TableReservationFlow";
import { billingStateOf, canTrade } from "@/lib/billing-state";
import { db } from "@/lib/db";
import { holdingReservationWhere } from "@/lib/reservation-booking";
import { resolveEffectivePolicy } from "@/lib/reservation-policy";
import {
	getStorefrontShare,
	shareDescription,
	storefrontMetadata,
} from "@/lib/storefront-share";
import { wallClockIn } from "@/lib/zoned-time";

type TablesPageProps = {
	params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

/** The earliest bookable moment, on the restaurant's wall clock — not the
 *  server's, which on Vercel is UTC and put Lagos an hour behind. */
function getMinimumDateTime(advanceBookingHours: number, timeZone: string) {
	const earliest = new Date(Date.now() + advanceBookingHours * 60 * 60 * 1000);
	// Round up to the next whole minute so "now" is never offered.
	earliest.setSeconds(60, 0);
	return wallClockIn(timeZone, earliest);
}

export async function generateMetadata({
	params,
}: TablesPageProps): Promise<Metadata> {
	const { slug } = await params;
	const share = await getStorefrontShare(slug);
	if (!share?.bookings) return {};
	return storefrontMetadata(share, {
		page: "Book a table",
		description: shareDescription(share, "tables"),
		path: "/tables",
	});
}

export default async function TablesPage({ params }: TablesPageProps) {
	const { slug } = await params;
	const restaurant = await db.restaurant.findFirst({
		where: { slug },
		select: {
			id: true,
			isActive: true,
			tableReservationEnabled: true,
			name: true,
			slug: true,
			logoUrl: true,
			phone: true,
			whatsappNumber: true,
			currency: true,
			timezone: true,
			reservationSetting: true,
			openingHours: {
				select: { dayOfWeek: true, opensAt: true, closesAt: true },
			},
			blackoutDates: { select: { date: true } },
			subscription: {
				select: {
					currentPeriodEnd: true,
					billingInterval: true,
					plan: {
						select: {
							monthlyPrice: true,
							quarterlyPrice: true,
							yearlyPrice: true,
						},
					},
				},
			},
			tables: {
				where: { isActive: true },
				orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
				select: {
					id: true,
					label: true,
					description: true,
					imageUrl: true,
					capacity: true,
					bookingMode: true,
					paymentTiming: true,
					inclusionType: true,
					holdMinutes: true,
					depositPercent: true,
					minPartySize: true,
					maxPartySize: true,
					tableFee: true,
					minimumSpend: true,
					// Everything that holds the table — the same rule the server
					// enforces, so the page can't offer a slot the booking will then
					// refuse. Future only: this used to send every ACTIVE booking ever
					// made, growing with each sitting.
					reservations: {
						where: {
							expiresAt: { gt: new Date() },
							AND: [holdingReservationWhere()],
						},
						select: { startsAt: true, expiresAt: true },
					},
				},
			},
			categories: {
				where: { isActive: true },
				orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
				select: {
					id: true,
					name: true,
					items: {
						where: { isAvailable: true },
						orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
						select: {
							id: true,
							name: true,
							description: true,
							price: true,
							imageUrl: true,
						},
					},
				},
			},
		},
	});

	if (!restaurant) notFound();
	// Bookings switched off: the menu, not a 404 (old links and QR codes).
	if (!restaurant.tableReservationEnabled) redirect(`/${slug}`);

	// Suspended: the menu page explains.
	if (!restaurant.isActive) redirect(`/${slug}`);
	// Lapsed: bookings paused; the menu is still there to browse.
	if (!canTrade(billingStateOf(restaurant.subscription))) {
		return (
			<RestaurantUnavailable
				name={restaurant.name}
				logoUrl={restaurant.logoUrl}
				phone={restaurant.phone ?? restaurant.whatsappNumber}
				title="Table bookings are paused"
				message={`${restaurant.name} isn't taking online bookings right now. Please call the restaurant to book.`}
				backHref={`/${slug}`}
			/>
		);
	}

	const setting =
		restaurant.reservationSetting ??
		({
			bookingMode: "FREE_BOOKING",
			paymentTiming: "PAY_ON_ARRIVAL",
			inclusionType: "TABLE_FEE_ONLY",
			defaultTableFee: null,
			advanceBookingHours: 0,
			holdDurationMinutes: 60,
			minPartySize: 1,
			maxPartySize: 0,
			cancellationPolicy: null,
			bookingDescription: null,
		} as const);
	const tables = restaurant.tables.map((table) => {
		const policy = resolveEffectivePolicy(table);

		return {
			id: table.id,
			label: table.label,
			description: table.description,
			imageUrl: table.imageUrl,
			capacity: table.capacity,
			// Every booking rule now travels with the table it belongs to, so the
			// customer sees the terms for the table they're actually choosing.
			policy: {
				bookingMode: policy.bookingMode,
				paymentTiming: policy.paymentTiming,
				inclusionType: policy.inclusionType,
				tableFee: Number(policy.tableFee ?? 0),
				depositPercent: policy.depositPercent,
				minimumSpend: Number(policy.minimumSpend ?? 0),
				holdMinutes: policy.holdMinutes,
				minPartySize: policy.minPartySize,
				maxPartySize: policy.maxPartySize,
			},
			reservations: table.reservations.map((reservation) => ({
				startsAt: reservation.startsAt.toISOString(),
				expiresAt: reservation.expiresAt.toISOString(),
			})),
		};
	});
	const categories = restaurant.categories.map((category) => ({
		...category,
		items: category.items.map((item) => ({
			...item,
			price: Number(item.price),
		})),
	}));
	const initialReservationDateTime = getMinimumDateTime(
		setting.advanceBookingHours,
		restaurant.timezone,
	);

	return (
		<TableReservationFlow
			openingHours={restaurant.openingHours}
			blackoutDates={restaurant.blackoutDates.map((d) => d.date)}
			restaurantName={restaurant.name}
			restaurantSlug={restaurant.slug}
			logoUrl={restaurant.logoUrl}
			phone={restaurant.phone}
			whatsappNumber={restaurant.whatsappNumber}
			currency={restaurant.currency}
			timeZone={restaurant.timezone}
			setting={{
				bookingDescription: setting.bookingDescription,
				advanceBookingHours: setting.advanceBookingHours,
				slotIntervalMinutes:
					"slotIntervalMinutes" in setting ? setting.slotIntervalMinutes : 30,
				graceMinutes: "graceMinutes" in setting ? setting.graceMinutes : 15,
				cancellationPolicy: setting.cancellationPolicy,
				refundPolicy: "refundPolicy" in setting ? setting.refundPolicy : null,
			}}
			initialReservationDateTime={initialReservationDateTime}
			tables={tables}
			categories={categories}
		/>
	);
}
