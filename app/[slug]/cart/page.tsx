import { notFound } from "next/navigation";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { bannerRecordToItem } from "@/lib/banners";
import { db } from "@/lib/db";

type CartPageProps = {
	params: Promise<{ slug: string }>;
	searchParams?: Promise<{ orderId?: string }>;
};

export default async function CartPage({
	params,
	searchParams,
}: CartPageProps) {
	const { slug } = await params;
	const { orderId } = (await searchParams) ?? {};
	const restaurant = await db.restaurant.findFirst({
		where: { slug, isActive: true },
		select: {
			name: true,
			logoUrl: true,
			slug: true,
			currency: true,
			dineInPaymentPolicy: true,
			dineInEnabled: true,
			pickupEnabled: true,
			deliveryEnabled: true,
			tableReservationEnabled: true,
			banners: {
				where: { isActive: true },
				orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
				select: {
					id: true,
					imageUrl: true,
					title: true,
					subtitle: true,
					sortOrder: true,
					isActive: true,
				},
			},
		},
	});

	if (!restaurant) notFound();
	const bannerItems = restaurant.banners.map(bannerRecordToItem);

	return (
		<CheckoutFlow
			name={restaurant.name}
			logoUrl={restaurant.logoUrl}
			bannerItems={bannerItems}
			slug={restaurant.slug}
			currency={restaurant.currency}
			dineInPaymentPolicy={restaurant.dineInPaymentPolicy}
			enabledOrderTypes={{
				DINE_IN: restaurant.dineInEnabled,
				PICKUP: restaurant.pickupEnabled,
				DELIVERY: restaurant.deliveryEnabled,
				TABLE_RESERVATION: restaurant.tableReservationEnabled,
			}}
			existingOrderId={orderId}
		/>
	);
}
