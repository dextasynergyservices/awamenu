import {
	ActivityFeed,
	AttentionPanel,
	KpiTile,
	OnboardingFunnel,
	RestaurantLists,
	SubscriptionSnapshot,
	SystemHealth,
} from "@/components/super-admin/PlatformOverview";
import { getPlatformOverview } from "@/lib/platform-overview";

export const dynamic = "force-dynamic";

export default async function SuperAdminOverviewPage() {
	const data = await getPlatformOverview();
	const updatedAt = new Intl.DateTimeFormat("en-GB", {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: "Africa/Lagos",
	}).format(new Date());

	return (
		<div className="grid gap-5">
			<div className="flex flex-wrap items-end justify-between gap-2">
				<div>
					<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
						Platform overview
					</h1>
					<p className="mt-1 text-sm font-medium text-slate-600">
						What needs you, how the platform is growing, and whether everything
						is running.
					</p>
				</div>
				<p className="text-xs font-semibold text-slate-400">
					As of {updatedAt} (Lagos) · refresh for the latest
				</p>
			</div>

			<AttentionPanel items={data.attention} />

			<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
				{data.kpis.map((kpi) => (
					<KpiTile key={kpi.label} kpi={kpi} />
				))}
			</div>

			<div className="grid gap-5 lg:grid-cols-3">
				<SubscriptionSnapshot data={data} />
				<OnboardingFunnel steps={data.funnel} />
				<RestaurantLists
					top={data.topRestaurants}
					quiet={data.quietRestaurants}
				/>
			</div>

			<div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
				<ActivityFeed items={data.recentActivity} />
				<SystemHealth health={data.health} />
			</div>
		</div>
	);
}
