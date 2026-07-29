import { OrderStatus, PlanTier, SubscriptionStatus } from "@prisma/client";
import { PlatformStats } from "@/components/super-admin/PlatformStats";
import {
	type ActivityEntry,
	RecentActivity,
} from "@/components/super-admin/RecentActivity";
import { db } from "@/lib/db";

const RECENT_ACTIVITY_PER_TYPE = 5;
const RECENT_ACTIVITY_LIMIT = 10;

export default async function SuperAdminOverviewPage() {
	const [
		totalRestaurants,
		activeRestaurants,
		totalUsers,
		totalOrders,
		totalReviews,
		revenueAgg,
		activeSubscriptions,
		plans,
		recentRestaurants,
		recentUpgrades,
		recentCancellations,
	] = await Promise.all([
		db.restaurant.count(),
		db.restaurant.count({ where: { isActive: true } }),
		db.user.count(),
		db.order.count({ where: { status: { not: OrderStatus.CANCELLED } } }),
		db.rating.count(),
		db.order.aggregate({
			where: { status: OrderStatus.COMPLETED },
			_sum: { total: true },
		}),
		db.subscription.findMany({
			where: {
				status: {
					in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
				},
			},
			select: { plan: { select: { monthlyPrice: true } } },
		}),
		db.plan.findMany({
			orderBy: { monthlyPrice: "asc" },
			select: {
				id: true,
				tier: true,
				name: true,
				_count: { select: { subscriptions: true } },
			},
		}),
		db.restaurant.findMany({
			orderBy: { createdAt: "desc" },
			take: RECENT_ACTIVITY_PER_TYPE,
			select: { name: true, createdAt: true },
		}),
		db.subscription.findMany({
			where: {
				restaurantId: { not: null },
				status: {
					in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
				},
				plan: { tier: { not: PlanTier.FREE } },
			},
			orderBy: { updatedAt: "desc" },
			take: RECENT_ACTIVITY_PER_TYPE,
			select: {
				updatedAt: true,
				plan: { select: { name: true } },
				restaurant: { select: { name: true } },
			},
		}),
		db.subscription.findMany({
			where: {
				restaurantId: { not: null },
				status: SubscriptionStatus.CANCELLED,
			},
			orderBy: { updatedAt: "desc" },
			take: RECENT_ACTIVITY_PER_TYPE,
			select: {
				updatedAt: true,
				restaurant: { select: { name: true } },
			},
		}),
	]);

	const mrr = activeSubscriptions.reduce(
		(sum, sub) => sum + Number(sub.plan.monthlyPrice),
		0,
	);

	const activity: ActivityEntry[] = [
		...recentRestaurants.map(
			(restaurant): ActivityEntry => ({
				type: "registered",
				label: `${restaurant.name} registered`,
				timestamp: restaurant.createdAt,
			}),
		),
		...recentUpgrades
			.filter((entry) => entry.restaurant)
			.map(
				(entry): ActivityEntry => ({
					type: "upgraded",
					label: `${entry.restaurant?.name} upgraded to ${entry.plan.name}`,
					timestamp: entry.updatedAt,
				}),
			),
		...recentCancellations
			.filter((entry) => entry.restaurant)
			.map(
				(entry): ActivityEntry => ({
					type: "cancelled",
					label: `${entry.restaurant?.name} subscription cancelled`,
					timestamp: entry.updatedAt,
				}),
			),
	]
		.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
		.slice(0, RECENT_ACTIVITY_LIMIT);

	return (
		<div className="grid gap-6">
			<div>
				<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
					Platform Overview
				</h1>
				<p className="mt-1 text-sm font-medium text-slate-600">
					Monitor restaurants, subscriptions, and platform-wide activity.
				</p>
			</div>
			<PlatformStats
				totalRestaurants={totalRestaurants}
				activeRestaurants={activeRestaurants}
				activeSubscriptions={activeSubscriptions.length}
				totalUsers={totalUsers}
				totalOrders={totalOrders}
				totalReviews={totalReviews}
				totalRevenue={Number(revenueAgg._sum.total ?? 0)}
				mrr={mrr}
				planCounts={plans.map((plan) => ({
					tier: plan.tier,
					name: plan.name,
					count: plan._count.subscriptions,
				}))}
			/>
			<RecentActivity activity={activity} />
		</div>
	);
}
