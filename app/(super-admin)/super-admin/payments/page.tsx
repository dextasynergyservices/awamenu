import { PaymentsTable } from "@/components/super-admin/PaymentsTable";
import { db } from "@/lib/db";

export default async function SuperAdminPaymentsPage() {
	const subscriptions = await db.subscription.findMany({
		where: { restaurantId: { not: null } },
		orderBy: { currentPeriodStart: "desc" },
		select: {
			id: true,
			status: true,
			currentPeriodStart: true,
			plan: { select: { name: true, monthlyPrice: true } },
			restaurant: { select: { name: true } },
		},
		take: 100,
	});

	return (
		<div className="grid gap-6">
			<div>
				<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
					Payments
				</h1>
				<p className="mt-1 text-sm font-medium text-slate-600">
					Subscription billing across all restaurants.
				</p>
			</div>

			<PaymentsTable
				payments={subscriptions.map((sub) => ({
					id: sub.id,
					restaurantName: sub.restaurant?.name ?? "—",
					planName: sub.plan.name,
					monthlyPrice: Number(sub.plan.monthlyPrice),
					status: sub.status,
					currentPeriodStart: sub.currentPeriodStart.toISOString(),
				}))}
			/>
		</div>
	);
}
