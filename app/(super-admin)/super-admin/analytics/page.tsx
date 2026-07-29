import { OrderStatus, SubscriptionStatus } from "@prisma/client";
import { PlatformAnalytics } from "@/components/super-admin/PlatformAnalytics";
import { db } from "@/lib/db";

const MONTHS_IN_WINDOW = 6;

function monthBuckets(count: number) {
	const now = new Date();
	const buckets: { key: string; label: string; start: Date; end: Date }[] = [];

	for (let i = count - 1; i >= 0; i--) {
		const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
		const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
		buckets.push({
			key: `${start.getFullYear()}-${start.getMonth()}`,
			label: start.toLocaleDateString("en-US", { month: "short" }),
			start,
			end,
		});
	}

	return buckets;
}

export default async function SuperAdminAnalyticsPage() {
	const buckets = monthBuckets(MONTHS_IN_WINDOW);
	const windowStart = buckets[0].start;

	const [
		completedOrdersInWindow,
		ordersInWindow,
		baselineRestaurantCount,
		restaurantsInWindow,
		baselineSubscriptionCount,
		subscriptionsInWindow,
	] = await Promise.all([
		db.order.findMany({
			where: { status: OrderStatus.COMPLETED, createdAt: { gte: windowStart } },
			select: { createdAt: true, total: true },
		}),
		db.order.findMany({
			where: {
				status: { not: OrderStatus.CANCELLED },
				createdAt: { gte: windowStart },
			},
			select: { createdAt: true },
		}),
		db.restaurant.count({ where: { createdAt: { lt: windowStart } } }),
		db.restaurant.findMany({
			where: { createdAt: { gte: windowStart } },
			select: { createdAt: true },
		}),
		db.subscription.count({
			where: {
				createdAt: { lt: windowStart },
				status: {
					in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
				},
			},
		}),
		db.subscription.findMany({
			where: {
				createdAt: { gte: windowStart },
				status: {
					in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
				},
			},
			select: { createdAt: true },
		}),
	]);

	function bucketKeyFor(date: Date) {
		return `${date.getFullYear()}-${date.getMonth()}`;
	}

	const revenueByBucket = new Map<string, number>();
	for (const order of completedOrdersInWindow) {
		const key = bucketKeyFor(order.createdAt);
		revenueByBucket.set(
			key,
			(revenueByBucket.get(key) ?? 0) + Number(order.total),
		);
	}

	const orderCountByBucket = new Map<string, number>();
	for (const order of ordersInWindow) {
		const key = bucketKeyFor(order.createdAt);
		orderCountByBucket.set(key, (orderCountByBucket.get(key) ?? 0) + 1);
	}

	const newRestaurantsByBucket = new Map<string, number>();
	for (const restaurant of restaurantsInWindow) {
		const key = bucketKeyFor(restaurant.createdAt);
		newRestaurantsByBucket.set(key, (newRestaurantsByBucket.get(key) ?? 0) + 1);
	}

	const newSubscriptionsByBucket = new Map<string, number>();
	for (const subscription of subscriptionsInWindow) {
		const key = bucketKeyFor(subscription.createdAt);
		newSubscriptionsByBucket.set(
			key,
			(newSubscriptionsByBucket.get(key) ?? 0) + 1,
		);
	}

	let runningRestaurantTotal = baselineRestaurantCount;
	let runningSubscriptionTotal = baselineSubscriptionCount;

	const revenueTrend = buckets.map((bucket) => ({
		label: bucket.label,
		value: revenueByBucket.get(bucket.key) ?? 0,
	}));

	const orderTrend = buckets.map((bucket) => ({
		label: bucket.label,
		value: orderCountByBucket.get(bucket.key) ?? 0,
	}));

	const restaurantGrowth = buckets.map((bucket) => {
		runningRestaurantTotal += newRestaurantsByBucket.get(bucket.key) ?? 0;
		return { label: bucket.label, value: runningRestaurantTotal };
	});

	const subscriptionGrowth = buckets.map((bucket) => {
		runningSubscriptionTotal += newSubscriptionsByBucket.get(bucket.key) ?? 0;
		return { label: bucket.label, value: runningSubscriptionTotal };
	});

	return (
		<div className="grid gap-6">
			<div>
				<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
					Analytics
				</h1>
				<p className="mt-1 text-sm font-medium text-slate-600">
					Platform-wide insights over the last {MONTHS_IN_WINDOW} months.
				</p>
			</div>

			<PlatformAnalytics
				revenueTrend={revenueTrend}
				restaurantGrowth={restaurantGrowth}
				subscriptionGrowth={subscriptionGrowth}
				orderTrend={orderTrend}
			/>
		</div>
	);
}
