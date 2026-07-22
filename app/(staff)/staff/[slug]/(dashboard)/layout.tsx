import { redirect } from "next/navigation";
import {
	fetchNotificationsAction,
	getUnreadCountAction,
} from "@/actions/notification.actions";
import { StaffDashboardShell } from "@/components/staff/StaffDashboardShell";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/staff-auth";

export default async function StaffDashboardLayout({
	children,
	params,
}: Readonly<{
	children: React.ReactNode;
	params: Promise<{ slug: string }>;
}>) {
	const { slug } = await params;

	await requireStaffSession(slug);

	const restaurant = await db.restaurant.findUnique({
		where: { slug },
		select: {
			id: true,
			name: true,
			slug: true,
			logoUrl: true,
			currency: true,
			staffDefaultDineIn: true,
			staffDefaultPickup: true,
			staffDefaultDelivery: true,
			staffDefaultCashPayment: true,
			staffDefaultApproveReservations: true,
		},
	});

	if (!restaurant) {
		redirect(`/`);
	}

	const permissions = {
		dineIn: restaurant.staffDefaultDineIn,
		pickup: restaurant.staffDefaultPickup,
		delivery: restaurant.staffDefaultDelivery,
		cashPayment: restaurant.staffDefaultCashPayment,
		approveReservations: restaurant.staffDefaultApproveReservations,
	};

	const unreadCount = await getUnreadCountAction({
		restaurantId: restaurant.id,
		recipientType: "staff",
		recipientId: "shared",
	});

	const { items: notifications } = await fetchNotificationsAction({
		restaurantId: restaurant.id,
		recipientType: "staff",
		recipientId: "shared",
		limit: 30,
	});

	return (
		<StaffDashboardShell
			restaurantId={restaurant.id}
			restaurantName={restaurant.name}
			restaurantLogoUrl={restaurant.logoUrl}
			slug={restaurant.slug}
			staffId="shared"
			staffName="Staff Terminal"
			staffCode="ACTIVE"
			currency={restaurant.currency}
			permissions={permissions}
			initialNotifications={notifications.map((n) => ({
				...n,
				actionUrl: n.actionUrl ?? undefined,
				metadata: n.metadata ?? undefined,
			}))}
			initialUnreadCount={unreadCount}
		>
			{children}
		</StaffDashboardShell>
	);
}
