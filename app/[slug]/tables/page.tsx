import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TableReservationFlow } from "@/components/reservation/TableReservationFlow";
import { db } from "@/lib/db";
import { resolveEffectivePolicy } from "@/lib/reservation-policy";

type TablesPageProps = {
	params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

function getMinimumDateTime(advanceBookingHours: number) {
	const date = new Date(Date.now() + advanceBookingHours * 60 * 60 * 1000);
	if (date.getSeconds() > 0 || date.getMilliseconds() > 0) {
		date.setMinutes(date.getMinutes() + 1);
	}
	date.setSeconds(0, 0);
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	const hh = String(date.getHours()).padStart(2, "0");
	const min = String(date.getMinutes()).padStart(2, "0");
	return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

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
			phone: true,
			whatsappNumber: true,
			currency: true,
			reservationSetting: true,
			tables: {
				where: { isActive: true },
				orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
				select: {
					id: true,
					label: true,
					description: true,
					imageUrl: true,
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
			imageUrl: table.imageUrl,
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
	const initialReservationDateTime = getMinimumDateTime(
		setting.advanceBookingHours,
	);

	return (
		<TableReservationFlow
			restaurantName={restaurant.name}
			restaurantSlug={restaurant.slug}
			logoUrl={restaurant.logoUrl}
			phone={restaurant.phone}
			whatsappNumber={restaurant.whatsappNumber}
			currency={restaurant.currency}
			setting={{
				bookingDescription: setting.bookingDescription,
				advanceBookingHours: setting.advanceBookingHours,
				holdDurationMinutes: setting.holdDurationMinutes,
				minPartySize: setting.minPartySize,
				maxPartySize: setting.maxPartySize,
				cancellationPolicy: setting.cancellationPolicy,
			}}
			initialReservationDateTime={initialReservationDateTime}
			tables={tables}
			categories={categories}
		/>
	);
}
