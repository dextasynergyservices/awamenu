import { OrderStatus, SubscriptionStatus } from "@prisma/client";
import { PlatformStats } from "@/components/super-admin/PlatformStats";
import { db } from "@/lib/db";

export default async function SuperAdminOverviewPage() {
	const [
		totalRestaurants,
		activeRestaurants,
		totalUsers,
		totalOrders,
		revenueAgg,
		activeSubscriptions,
		plans,
	] = await Promise.all([
		db.restaurant.count(),
		db.restaurant.count({ where: { isActive: true } }),
		db.user.count(),
		db.order.count({ where: { status: { not: OrderStatus.CANCELLED } } }),
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
	]);

	const mrr = activeSubscriptions.reduce(
		(sum, sub) => sum + Number(sub.plan.monthlyPrice),
		0,
	);

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
				totalUsers={totalUsers}
				totalOrders={totalOrders}
				totalRevenue={Number(revenueAgg._sum.total ?? 0)}
				mrr={mrr}
				planCounts={plans.map((plan) => ({
					tier: plan.tier,
					name: plan.name,
					count: plan._count.subscriptions,
				}))}
			/>
		</div>
	);
}
