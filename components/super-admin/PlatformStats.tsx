type PlatformStatsProps = {
	totalRestaurants: number;
	activeRestaurants: number;
	activeSubscriptions: number;
	totalUsers: number;
	totalOrders: number;
	totalReviews: number;
	totalRevenue: number;
	mrr: number;
	planCounts: Array<{ tier: string; name: string; count: number }>;
};

function formatMoney(value: number) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency: "NGN",
		maximumFractionDigits: 0,
	}).format(value);
}

function StatCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-slate-100 bg-white p-5">
			<p className="text-xs font-black uppercase tracking-wide text-slate-500">
				{label}
			</p>
			<p className="mt-2 text-xl font-black text-slate-950">{value}</p>
		</div>
	);
}

export function PlatformStats({
	totalRestaurants,
	activeRestaurants,
	activeSubscriptions,
	totalUsers,
	totalOrders,
	totalReviews,
	totalRevenue,
	mrr,
	planCounts,
}: PlatformStatsProps) {
	return (
		<div className="grid gap-6">
			<div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
				<StatCard
					label="Total Restaurants"
					value={totalRestaurants.toLocaleString()}
				/>
				<StatCard
					label="Active Subscriptions"
					value={activeSubscriptions.toLocaleString()}
				/>
				<StatCard label="Monthly Revenue" value={formatMoney(mrr)} />
				<StatCard label="Total Orders" value={totalOrders.toLocaleString()} />
				<StatCard label="Total Reviews" value={totalReviews.toLocaleString()} />
			</div>
			<div className="grid grid-cols-2 gap-4 md:grid-cols-3">
				<StatCard
					label="Active Restaurants"
					value={activeRestaurants.toLocaleString()}
				/>
				<StatCard label="Users" value={totalUsers.toLocaleString()} />
				<StatCard label="Order Revenue" value={formatMoney(totalRevenue)} />
			</div>
			<div className="rounded-2xl border border-slate-100 bg-white p-5">
				<h2 className="mb-4 text-sm font-black text-slate-800">
					Restaurants by Plan
				</h2>
				<div className="grid gap-3 sm:grid-cols-3">
					{planCounts.map((plan) => (
						<div key={plan.tier} className="rounded-xl bg-slate-50 p-4">
							<p className="text-xs font-black uppercase tracking-wide text-slate-500">
								{plan.name}
							</p>
							<p className="mt-1 text-2xl font-black text-slate-950">
								{plan.count}
							</p>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
