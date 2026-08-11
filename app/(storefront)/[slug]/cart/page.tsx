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

	// Only the manual channels are surfaced here — they're the ones the customer
	// has to act on themselves. Online channels are handled by the gateway
	// redirect after the order is placed.
	const enabledMethods = await db.restaurantPaymentMethod.findMany({
		where: { restaurant: { slug }, isEnabled: true },
		select: {
			channel: true,
			bankName: true,
			accountNumber: true,
			accountName: true,
		},
	});

	const transfer = enabledMethods.find((m) => m.channel === "BANK_TRANSFER");
	const manualPayments = {
		bankTransfer:
			transfer?.bankName && transfer.accountNumber && transfer.accountName
				? {
						bankName: transfer.bankName,
						accountNumber: transfer.accountNumber,
						accountName: transfer.accountName,
					}
				: null,
		cashEnabled: enabledMethods.some((m) => m.channel === "CASH"),
		hasOnlineOption: enabledMethods.some(
			(m) => m.channel === "AWAMENU_PAY" || m.channel === "OWN_GATEWAY",
		),
	};

	return (
		<CheckoutFlow
			manualPayments={manualPayments}
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
