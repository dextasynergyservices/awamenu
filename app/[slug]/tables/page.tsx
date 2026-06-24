import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TableReservationFlow } from "@/components/reservation/TableReservationFlow";
import { db } from "@/lib/db";
import { resolveEffectivePolicy } from "@/lib/reservation-policy";

type TablesPageProps = {
	params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({
	params,
}: TablesPageProps): Promise<Metadata> {
	const { slug } = await params;
	const restaurant = await db.restaurant.findFirst({
		where: { slug, isActive: true, tableReservationEnabled: true },
		select: { name: true, description: true },
	});

	if (!restaurant) return {};

	return {
		title: `Reserve a Table | ${restaurant.name}`,
		description:
			restaurant.description ??
			`Reserve a table and pre-order food at ${restaurant.name}.`,
	};
}

export default async function TablesPage({ params }: TablesPageProps) {
	const { slug } = await params;
	const restaurant = await db.restaurant.findFirst({
		where: { slug, isActive: true, tableReservationEnabled: true },
		select: {
			id: true,
			name: true,
			slug: true,
			logoUrl: true,
			currency: true,
			reservationSetting: true,
			tables: {
				where: { isActive: true },
				orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
				select: {
					id: true,
					label: true,
					description: true,
					capacity: true,
					bookingModeOverride: true,
					paymentTimingOverride: true,
					inclusionTypeOverride: true,
					tableFee: true,
					reservations: {
						where: { status: "ACTIVE" },
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
		const policy = resolveEffectivePolicy(setting, table);

		return {
			id: table.id,
			label: table.label,
			description: table.description,
			capacity: table.capacity,
			policy: {
				bookingMode: policy.bookingMode,
				paymentTiming: policy.paymentTiming,
				inclusionType: policy.inclusionType,
				tableFee: Number(policy.tableFee ?? 0),
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

	return (
		<TableReservationFlow
			restaurantName={restaurant.name}
			restaurantSlug={restaurant.slug}
			logoUrl={restaurant.logoUrl}
			currency={restaurant.currency}
			setting={{
				bookingDescription: setting.bookingDescription,
				advanceBookingHours: setting.advanceBookingHours,
				holdDurationMinutes: setting.holdDurationMinutes,
				minPartySize: setting.minPartySize,
				maxPartySize: setting.maxPartySize,
				cancellationPolicy: setting.cancellationPolicy,
			}}
			tables={tables}
			categories={categories}
		/>
	);
}
