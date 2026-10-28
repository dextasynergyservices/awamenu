import { redirect } from "next/navigation";
import { RestaurantAnalyticsView } from "@/components/admin/RestaurantAnalyticsView";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { getRestaurantPlanFeatures } from "@/lib/plan-features";
import {
	getRestaurantAnalytics,
	parsePeriod,
	parseTab,
} from "@/lib/restaurant-analytics";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{
		range?: string;
		from?: string;
		to?: string;
		tab?: string;
	}>;
}) {
	const user = await requireUser();
	const { slug } = await params;
	const query = await searchParams;
	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		select: { id: true, currency: true, timezone: true },
	});
	if (!restaurant) redirect("/onboarding/choose-plan");

	// A preset (?range=30) or a custom range (?from=2026-03-01&to=2026-03-31),
	// in the restaurant's own days.
	const period = parsePeriod(query, restaurant.timezone);

	// Through the shared resolver: a lapsed plan falls back to Free.
	const { advancedAnalytics } = await getRestaurantPlanFeatures(restaurant.id);
	const data = await getRestaurantAnalytics({
		restaurantId: restaurant.id,
		timeZone: restaurant.timezone,
		period,
		advanced: advancedAnalytics,
	});

	return (
		<RestaurantAnalyticsView
			data={data}
			currency={restaurant.currency}
			slug={slug}
			initialTab={parseTab(query.tab)}
		/>
	);
}
