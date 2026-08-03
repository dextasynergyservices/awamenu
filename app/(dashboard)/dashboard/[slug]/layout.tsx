import { NotificationAudience } from "@prisma/client";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { SubscriptionExpiredGate } from "@/components/admin/SubscriptionExpiredGate";
import { RestaurantBrandProvider } from "@/components/shared/RestaurantBrandContext";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { LOGO_ICON_URL } from "@/lib/logo";
import { getRestaurantBrand } from "@/lib/restaurant-brand";
import { isSubscriptionActive } from "@/lib/subscription";
import { getThemeStyle } from "@/lib/theme-style";

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const restaurant = await getRestaurantBrand(slug);
	const icon = restaurant?.logoUrl ?? LOGO_ICON_URL;

	return { icons: { icon, shortcut: icon, apple: icon } };
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
			isActive: true,
		},
	});

	if (!restaurant) redirect("/onboarding/choose-plan");

	if (!restaurant.isActive) {
		return (
			<main className="grid min-h-screen place-items-center bg-[#f6faf7] px-4 py-8">
				<section className="mx-auto max-w-lg rounded-3xl border border-red-100 bg-white p-5 text-center shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
					<p className="text-sm font-black uppercase tracking-wide text-red-700">
						Restaurant Suspended
					</p>
					<h1 className="mt-3 text-2xl font-black text-slate-950">
						{restaurant.name} is currently suspended
					</h1>
					<p className="mt-3 text-sm font-bold leading-6 text-slate-600">
						Access to this dashboard has been paused by AwaMenu. Contact support
						for more information.
					</p>
				</section>
			</main>
		);
	}

	const subscription = await db.subscription.findFirst({
		where: { userId: user.id },
		orderBy: { createdAt: "desc" },
		include: { plan: true },
	});

	if (!isSubscriptionActive(subscription)) {
		const [freePlan, categories] = await Promise.all([
			db.plan.findUniqueOrThrow({ where: { tier: "FREE" } }),
			db.menuCategory.findMany({
				where: { restaurantId: restaurant.id },
				orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
				select: { id: true, name: true, emoji: true },
			}),
		]);
		const currentPlan = subscription?.plan ?? freePlan;

		// Only true upgrades (strictly pricier than the plan that just lapsed)
		// belong under "Upgrade" — anything cheaper is a downgrade and would be
		// mislabeled here; a lower-priced paid plan is still reachable via the
		// Free-plan flow's own upsell path once they're back in the dashboard.
		const upgradePlans = await db.plan.findMany({
			where: {
				isActive: true,
				tier: { not: "FREE" },
				id: { not: subscription?.planId },
				monthlyPrice: { gt: currentPlan.monthlyPrice },
			},
			orderBy: { monthlyPrice: "asc" },
			select: {
				id: true,
				name: true,
				monthlyPrice: true,
				quarterlyPrice: true,
				yearlyPrice: true,
			},
		});

		return (
			<SubscriptionExpiredGate
				restaurantId={restaurant.id}
				restaurantName={restaurant.name}
				slug={restaurant.slug}
				currentPlan={{
					id: currentPlan.id,
					name: currentPlan.name,
					monthlyPrice: Number(currentPlan.monthlyPrice),
					quarterlyPrice: Number(currentPlan.quarterlyPrice),
					yearlyPrice: Number(currentPlan.yearlyPrice),
				}}
				upgradePlans={upgradePlans.map((plan) => ({
					id: plan.id,
					name: plan.name,
					monthlyPrice: Number(plan.monthlyPrice),
					quarterlyPrice: Number(plan.quarterlyPrice),
					yearlyPrice: Number(plan.yearlyPrice),
				}))}
				categories={categories}
				freePlanMaxCategories={freePlan.maxCategories}
			/>
		);
	}

	const isPaid = subscription?.plan
		? Number(subscription.plan.monthlyPrice) > 0
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
	const brand = {
		name: restaurant.name,
		logoUrl: restaurant.logoUrl,
		primaryColor: restaurant.primaryColor,
		// The owner's own dashboard isn't a customer-facing surface, so it
		// never carries the attribution badge regardless of plan.
		showAwamenuBranding: false,
	};

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
				<RestaurantBrandProvider brand={brand}>
					{children}
				</RestaurantBrandProvider>
			</AdminDashboardShell>
		</div>
	);
}
