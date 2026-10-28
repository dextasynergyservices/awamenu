import { NotificationAudience } from "@prisma/client";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminSuspendedScreen } from "@/components/admin/AdminSuspendedScreen";
import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { BillingLapsedBanner } from "@/components/admin/BillingLapsedBanner";
import { SubscriptionExpiryBanner } from "@/components/admin/SubscriptionExpiryBanner";
import { RestaurantBrandProvider } from "@/components/shared/RestaurantBrandContext";
import { requireUser } from "@/lib/auth-guards";
import { BILLING_INTERVAL_DETAILS, parseBillingInterval } from "@/lib/billing";
import {
	billingStateOf,
	canTrade,
	GRACE_DAYS,
	isAutoRenewing,
	subscriptionPrice,
} from "@/lib/billing-state";
import { db } from "@/lib/db";
import { LOGO_ICON_URL } from "@/lib/logo";
import { getRestaurantBrand } from "@/lib/restaurant-brand";
import { getThemeStyle } from "@/lib/theme-style";

function formatDay(date: Date) {
	return new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "Africa/Lagos",
	}).format(date);
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const restaurant = await getRestaurantBrand(slug);
	const icon = restaurant?.logoUrl ?? LOGO_ICON_URL;

	// Declared here, not in the root layout, so only signed-in users are
	// offered "Install app". This is one AwaMenu manifest with `start_url: "/"`,
	// so a customer installing from a restaurant's menu would get an app that
	// opens AwaMenu's homepage rather than that restaurant — worse than no
	// prompt at all.
	return {
		manifest: "/manifest.webmanifest",
		// `apple` is the AwaMenu mark, not the restaurant's: iOS takes the
		// Home Screen icon from apple-touch-icon rather than the manifest, so
		// leaving it as the restaurant logo would install an app badged as one
		// restaurant. The browser-tab favicon stays restaurant-branded.
		icons: { icon, shortcut: icon, apple: LOGO_ICON_URL },
	};
}

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
			timezone: true,
			isActive: true,
			suspensionReason: true,
			suspendedAt: true,
			// This restaurant's own subscription: an owner with two restaurants
			// has two, and "the owner's newest" was the wrong one for the other.
			subscription: {
				select: {
					status: true,
					currentPeriodEnd: true,
					billingInterval: true,
					paystackSubscriptionCode: true,
					plan: {
						select: {
							id: true,
							name: true,
							monthlyPrice: true,
							quarterlyPrice: true,
							yearlyPrice: true,
						},
					},
				},
			},
		},
	});

	if (!restaurant) redirect("/onboarding/choose-plan");

	// Suspended by the Super Admin: the only case that closes the dashboard.
	// An unpaid plan never lands here; it's read-only instead (below).
	if (!restaurant.isActive) {
		const settings = await db.platformSetting.findFirst({
			select: { legalContactEmail: true },
		});
		return (
			<AdminSuspendedScreen
				restaurantName={restaurant.name}
				reason={restaurant.suspensionReason}
				since={
					restaurant.suspendedAt ? formatDay(restaurant.suspendedAt) : null
				}
				supportEmail={settings?.legalContactEmail || "hello@awamenu.com"}
			/>
		);
	}

	const subscription = restaurant.subscription;
	const billingState = billingStateOf(subscription);
	const isPaid = subscription ? subscriptionPrice(subscription) > 0 : false;
	const interval = subscription
		? parseBillingInterval(subscription.billingInterval)
		: null;

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
	const brand = {
		name: restaurant.name,
		logoUrl: restaurant.logoUrl,
		primaryColor: restaurant.primaryColor,
		// The owner's own dashboard isn't a customer-facing surface, so it
		// never carries the attribution badge regardless of plan.
		showAwamenuBranding: false,
		timeZone: restaurant.timezone,
	};

	return (
		<div style={style} className="h-full">
			<AdminDashboardShell
				restaurantId={restaurant.id}
				restaurantName={restaurant.name}
				restaurantLogoUrl={restaurant.logoUrl}
				slug={restaurant.slug}
				userId={user.id}
				userName={user.name || user.email}
				userEmail={user.email}
				isPaid={isPaid}
				initialNotifications={notifications}
				initialUnreadCount={unreadCount}
			>
				<RestaurantBrandProvider brand={brand}>
					{subscription &&
					isPaid &&
					(billingState === "EXPIRING_SOON" || billingState === "GRACE") ? (
						<SubscriptionExpiryBanner
							slug={restaurant.slug}
							planName={subscription.plan.name}
							currentPeriodEnd={subscription.currentPeriodEnd.toISOString()}
							graceDays={GRACE_DAYS}
							autoRenew={isAutoRenewing(subscription)}
						/>
					) : null}
					{!canTrade(billingState) ? (
						<BillingLapsedBanner
							restaurantId={restaurant.id}
							slug={restaurant.slug}
							plan={
								subscription && interval
									? {
											id: subscription.plan.id,
											name: subscription.plan.name,
											price: subscriptionPrice(subscription),
											interval,
										}
									: null
							}
							intervalLabel={
								interval ? BILLING_INTERVAL_DETAILS[interval].label : null
							}
							expiredOn={
								subscription ? formatDay(subscription.currentPeriodEnd) : null
							}
						/>
					) : null}
					{children}
				</RestaurantBrandProvider>
			</AdminDashboardShell>
		</div>
	);
}
