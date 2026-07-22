import { OrderStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function getThirtyDaysAgo() {
	return new Date(Date.now() - THIRTY_DAYS_MS);
}

export default async function AnalyticsPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const user = await requireUser();
	const { slug } = await params;

	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		select: {
			id: true,
			currency: true,
			subscription: {
				select: { plan: { select: { tier: true, advancedAnalytics: true } } },
			},
		},
	});

	if (!restaurant) redirect("/onboarding/choose-plan");

	const isAdvanced = restaurant.subscription?.plan.advancedAnalytics ?? false;

	const [totalOrders, revenueAgg, totalScans, ratingAgg, totalRatings] =
		await Promise.all([
			db.order.count({
				where: {
					restaurantId: restaurant.id,
					status: { not: OrderStatus.CANCELLED },
				},
			}),
			db.order.aggregate({
				where: { restaurantId: restaurant.id, status: OrderStatus.COMPLETED },
				_sum: { total: true },
			}),
			db.scanEvent.count({ where: { restaurantId: restaurant.id } }),
			db.rating.aggregate({
				where: { restaurantId: restaurant.id },
				_avg: {
					overallRating: true,
					foodQuality: true,
					deliverySpeed: true,
					packaging: true,
					serviceQuality: true,
					ambiance: true,
					valueForMoney: true,
				},
			}),
			db.rating.count({ where: { restaurantId: restaurant.id } }),
		]);

	const totals = {
		totalOrders,
		totalRevenue: Number(revenueAgg._sum.total ?? 0),
		totalScans,
		totalRatings,
		avgRating: totalRatings > 0 ? (ratingAgg._avg.overallRating ?? 0) : null,
	};

	if (!isAdvanced) {
		return (
			<AnalyticsDashboard
				currency={restaurant.currency}
				isAdvanced={false}
				totals={totals}
				ordersByType={[]}
				ratingDistribution={[]}
				ratingAverages={null}
				staffBreakdown={[]}
				revenueOverTime={[]}
			/>
		);
	}

	const [
		ordersByType,
		ratingDistributionRaw,
		staffMembers,
		recentCompletedOrders,
	] = await Promise.all([
		db.order.groupBy({
			by: ["type"],
			where: {
				restaurantId: restaurant.id,
				status: { not: OrderStatus.CANCELLED },
			},
			_count: { _all: true },
		}),
		db.rating.groupBy({
			by: ["overallRating"],
			where: { restaurantId: restaurant.id },
			_count: { _all: true },
		}),
		db.staffMember.findMany({
			where: { restaurantId: restaurant.id },
			select: {
				id: true,
				name: true,
				staffId: true,
				orders: {
					select: { rating: { select: { overallRating: true } } },
				},
			},
		}),
		db.order.findMany({
			where: {
				restaurantId: restaurant.id,
				status: OrderStatus.COMPLETED,
				createdAt: { gte: getThirtyDaysAgo() },
			},
			select: { createdAt: true, total: true },
		}),
	]);

	const revenueByDay = new Map<string, number>();
	for (const order of recentCompletedOrders) {
		const day = order.createdAt.toISOString().slice(0, 10);
		revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + Number(order.total));
	}
	const revenueOverTime = Array.from(revenueByDay.entries())
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, revenue]) => ({ date, revenue }));

	const staffBreakdown = staffMembers.map((staff) => {
		const ratings = staff.orders
			.map((o) => o.rating?.overallRating)
			.filter((n): n is number => typeof n === "number");
		return {
			id: staff.id,
			name: staff.name,
			staffId: staff.staffId,
			orderCount: staff.orders.length,
			avgRating: ratings.length
				? ratings.reduce((sum, n) => sum + n, 0) / ratings.length
				: null,
		};
	});

	return (
		<AnalyticsDashboard
			currency={restaurant.currency}
			isAdvanced={true}
			totals={totals}
			ordersByType={ordersByType.map((entry) => ({
				type: entry.type,
				count: entry._count._all,
			}))}
			ratingDistribution={[1, 2, 3, 4, 5].map((star) => ({
				star,
				count:
					ratingDistributionRaw.find((entry) => entry.overallRating === star)
						?._count._all ?? 0,
			}))}
			ratingAverages={{
				foodQuality: ratingAgg._avg.foodQuality,
				deliverySpeed: ratingAgg._avg.deliverySpeed,
				packaging: ratingAgg._avg.packaging,
				serviceQuality: ratingAgg._avg.serviceQuality,
				ambiance: ratingAgg._avg.ambiance,
				valueForMoney: ratingAgg._avg.valueForMoney,
			}}
			staffBreakdown={staffBreakdown}
			revenueOverTime={revenueOverTime}
		/>
	);
}
