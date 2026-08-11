import { redirect } from "next/navigation";
import {
	fetchNotificationsAction,
	getUnreadCountAction,
} from "@/actions/notification.actions";
import { StaffDashboardShell } from "@/components/staff/StaffDashboardShell";
import { db } from "@/lib/db";
import { requireStaffSession } from "@/lib/staff-auth";
import { isSubscriptionActive } from "@/lib/subscription";

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
			subscription: {
				select: { status: true, currentPeriodEnd: true },
			},
		},
	});

	if (!restaurant) {
		redirect(`/`);
	}

	if (!isSubscriptionActive(restaurant.subscription)) {
		return (
			<main className="grid min-h-screen place-items-center bg-[#f6faf7] px-4 py-8">
				<section className="mx-auto max-w-lg rounded-3xl border border-slate-100 bg-white p-6 text-center shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
					<p className="text-sm font-black uppercase tracking-wide text-slate-500">
						Temporarily Unavailable
					</p>
					<h1 className="mt-3 text-2xl font-black text-slate-950">
						{restaurant.name}&apos;s staff dashboard is locked
					</h1>
					<p className="mt-3 text-sm font-bold leading-6 text-slate-600">
						This restaurant&apos;s subscription has lapsed. Please ask your
						restaurant admin to renew or update the plan before using the staff
						dashboard again.
					</p>
				</section>
			</main>
		);
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
			{children}
		</StaffDashboardShell>
	);
}
