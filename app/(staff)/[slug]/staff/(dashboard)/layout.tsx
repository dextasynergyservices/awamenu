import { redirect } from "next/navigation";
import {
	fetchNotificationsAction,
	getUnreadCountAction,
} from "@/actions/notification.actions";
import { StaffDashboardShell } from "@/components/staff/StaffDashboardShell";
import { billingStateOf, canTrade } from "@/lib/billing-state";
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
			isActive: true,
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
		},
	});

	if (!restaurant) {
		redirect(`/`);
	}

	// Suspended by the Super Admin: the terminal is closed. (An unpaid plan
	// isn't this: staff can still finish orders and bookings in progress.)
	if (!restaurant.isActive) {
		return (
			<main className="grid min-h-screen place-items-center bg-[#f6faf7] px-4 py-8">
				<section className="mx-auto max-w-lg rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
					<p className="text-sm font-black uppercase tracking-wide text-slate-500">
						Temporarily Unavailable
					</p>
					<h1 className="mt-3 text-2xl font-black text-slate-950">
						{restaurant.name}&apos;s staff dashboard is unavailable
					</h1>
					<p className="mt-3 text-sm font-bold leading-6 text-slate-600">
						This restaurant is suspended. Please speak to the restaurant owner.
					</p>
				</section>
			</main>
		);
	}

	const tradingPaused = !canTrade(billingStateOf(restaurant.subscription));

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
			staffName="Staff"
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
			{tradingPaused ? (
				<p
					role="status"
					className="mx-auto mb-3 max-w-7xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900"
				>
					New orders and bookings are paused because the restaurant&apos;s
					subscription has lapsed. You can still finish orders and bookings
					already in progress. Ask the owner to renew.
				</p>
			) : null}
			{children}
		</StaffDashboardShell>
	);
}
