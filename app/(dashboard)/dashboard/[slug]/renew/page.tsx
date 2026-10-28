import { redirect } from "next/navigation";
import { SubscriptionExpiredGate } from "@/components/admin/SubscriptionExpiredGate";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";

/**
 * Renew, upgrade or continue on Free — reached from the lapsed banner. Lives
 * inside the dashboard (which stays open read-only) rather than replacing it.
 */
export default async function RenewPage({
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
			name: true,
			slug: true,
			subscription: { select: { planId: true, plan: true } },
		},
	});
	if (!restaurant) redirect("/dashboard");

	const [freePlan, categories] = await Promise.all([
		db.plan.findUniqueOrThrow({ where: { tier: "FREE" } }),
		db.menuCategory.findMany({
			where: { restaurantId: restaurant.id },
			orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
			select: { id: true, name: true, emoji: true },
		}),
	]);
	const currentPlan = restaurant.subscription?.plan ?? freePlan;

	// Only true upgrades (strictly pricier than the current plan) go under
	// "Upgrade"; a cheaper plan is a downgrade and stays in Settings → Plan.
	const upgradePlans = await db.plan.findMany({
		where: {
			isActive: true,
			tier: { not: "FREE" },
			id: { not: currentPlan.id },
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
