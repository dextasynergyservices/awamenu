import { NotificationAudience } from "@prisma/client";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { isSubscriptionActive } from "@/lib/subscription";
import { getThemeStyle } from "@/lib/theme-style";

export default async function DashboardLayout({
	children,
	params,
}: Readonly<{
	children: React.ReactNode;
	params: Promise<{ slug: string }>;
}>) {
	const user = await requireUser();
	const { slug } = await params;
	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		select: {
			id: true,
			name: true,
			slug: true,
			logoUrl: true,
			primaryColor: true,
		},
	});

	if (!restaurant) redirect("/onboarding/choose-plan");

	const subscription = await db.subscription.findFirst({
		where: { userId: user.id },
		orderBy: { createdAt: "desc" },
		include: { plan: true },
	});

	const isPaid = subscription?.plan
		? Number(subscription.plan.monthlyPrice) > 0 &&
			isSubscriptionActive(subscription)
		: false;

	// Get initial unread count for the notification bell
	const unreadCount = await db.notification.count({
		where: {
			restaurantId: restaurant.id,
			audience: { in: [NotificationAudience.ADMIN, NotificationAudience.BOTH] },
			reads: {
				none: {
					recipientType: "admin",
					recipientId: user.id,
				},
			},
		},
	});

	// Fetch initial notifications for the drawer
	const initialNotifications = await db.notification.findMany({
		where: {
			restaurantId: restaurant.id,
			audience: { in: [NotificationAudience.ADMIN, NotificationAudience.BOTH] },
		},
		orderBy: { createdAt: "desc" },
		take: 30,
		select: {
			id: true,
			type: true,
			audience: true,
			title: true,
			body: true,
			actionUrl: true,
			metadata: true,
			createdAt: true,
			reads: {
				where: {
					recipientType: "admin",
					recipientId: user.id,
				},
				select: { id: true },
			},
		},
	});

	const notifications = initialNotifications.map((n) => ({
		id: n.id,
		type: n.type,
		audience: n.audience,
		title: n.title,
		body: n.body,
		actionUrl: n.actionUrl ?? undefined,
		metadata: (n.metadata as Record<string, unknown> | null) ?? undefined,
		createdAt: n.createdAt.toISOString(),
		isRead: n.reads.length > 0,
	}));

	const style = getThemeStyle(restaurant.primaryColor);

	return (
		<div style={style} className="h-full">
			<AdminDashboardShell
				restaurantId={restaurant.id}
				restaurantName={restaurant.name}
				restaurantLogoUrl={restaurant.logoUrl}
				slug={restaurant.slug}
				userId={user.id}
				isPaid={isPaid}
				initialNotifications={notifications}
				initialUnreadCount={unreadCount}
			>
				{children}
			</AdminDashboardShell>
		</div>
	);
}
