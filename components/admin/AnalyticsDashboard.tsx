"use client";

import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { RATING_METRIC_LABELS, type RatingMetric } from "@/lib/rating";

const ORDER_TYPE_COLORS: Record<string, string> = {
	DINE_IN: "#059669",
	PICKUP: "#2563eb",
	DELIVERY: "#e11d48",
	TABLE_RESERVATION: "#f59e0b",
};

const ORDER_TYPE_LABELS: Record<string, string> = {
	DINE_IN: "Dine In",
	PICKUP: "Pickup",
	DELIVERY: "Delivery",
	TABLE_RESERVATION: "Reservation",
};

// Sequential amber ramp, light → dark, for the 1★–5★ distribution bars.
const RATING_STAR_SHADES = [
	"#fde68a",
	"#fcd34d",
	"#fbbf24",
	"#f59e0b",
	"#b45309",
];

type Totals = {
	totalOrders: number;
	totalRevenue: number;
	totalScans: number;
	totalRatings: number;
	avgRating: number | null;
};

type OrdersByType = { type: string; count: number };
type RatingDistributionEntry = { star: number; count: number };
type RatingAverages = Record<RatingMetric, number | null> | null;
type StaffBreakdownEntry = {
	id: string;
	name: string;
	staffId: string;
	orderCount: number;
	avgRating: number | null;
};
type RevenuePoint = { date: string; revenue: number };

type AnalyticsDashboardProps = {
	currency: string;
	isAdvanced: boolean;
	totals: Totals;
	ordersByType: OrdersByType[];
	ratingDistribution: RatingDistributionEntry[];
	ratingAverages: RatingAverages;
	staffBreakdown: StaffBreakdownEntry[];
	revenueOverTime: RevenuePoint[];
};

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

function StatCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="min-w-0 rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 md:p-5">
			<p className="truncate text-xs font-black uppercase tracking-wide text-slate-500">
				{label}
			</p>
			<p className="mt-2 break-words text-lg font-black text-slate-950 sm:text-xl md:text-2xl">
				{value}
			</p>
		</div>
	);
}

function ChartCard({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="min-w-0 rounded-2xl border border-slate-100 bg-white p-3 sm:p-4 md:p-5">
			<h2 className="mb-4 text-xs font-black text-slate-800 sm:text-sm">
				{title}
			</h2>
			{children}
		</div>
	);
}

function EmptyChartState({ message = "No data yet." }: { message?: string }) {
	return (
		<div className="grid h-40 place-items-center text-sm font-medium text-slate-400">
			{message}
		</div>
	);
}

function MetricBar({ label, value }: { label: string; value: number }) {
	const percent = Math.max(0, Math.min(100, (value / 5) * 100));
	return (
		<div>
			<div className="mb-1 flex items-center justify-between text-xs font-bold text-slate-600">
				<span>{label}</span>
				<span>{value.toFixed(1)} ★</span>
			</div>
			<div className="h-2 w-full rounded-full bg-slate-100">
				<div
					className="h-2 rounded-full bg-amber-400"
					style={{ width: `${percent}%` }}
				/>
			</div>
		</div>
	);
}

export function AnalyticsDashboard({
	currency,
	isAdvanced,
	totals,
	ordersByType,
	ratingDistribution,
	ratingAverages,
	staffBreakdown,
	revenueOverTime,
}: AnalyticsDashboardProps) {
	return (
		<div className="min-w-0 grid gap-4 sm:gap-6">
			<div className="min-w-0">
				<h1 className="text-sm font-black text-slate-950 sm:text-2xl md:text-3xl">
					Analytics
				</h1>
				<p className="mt-1 text-xs font-medium text-slate-600 sm:text-sm">
					Track orders, revenue, and customer feedback.
				</p>
			</div>

			<div className="grid min-w-0 grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
				<StatCard
					label="Total Orders"
					value={totals.totalOrders.toLocaleString()}
				/>
				<StatCard
					label="Total Revenue"
					value={formatMoney(totals.totalRevenue, currency)}
				/>
				<StatCard label="QR Scans" value={totals.totalScans.toLocaleString()} />
				<StatCard
					label="Avg Rating"
					value={
						totals.avgRating != null
							? `${totals.avgRating.toFixed(1)} ★ (${totals.totalRatings})`
							: "No ratings yet"
					}
				/>
			</div>

			{!isAdvanced ? (
				<div className="min-w-0 rounded-2xl border border-lime-100 bg-lime-50 p-3 sm:p-5">
					<p className="text-xs font-black text-emerald-800 sm:text-sm">
						Unlock full analytics
					</p>
					<p className="mt-2 text-sm font-medium leading-6 text-slate-600">
						Upgrade to Starter or Pro to see revenue trends, order breakdowns,
						rating distribution, and staff performance.
					</p>
				</div>
			) : (
				<>
					<ChartCard title="Revenue (Last 30 Days)">
						{revenueOverTime.length === 0 ? (
							<EmptyChartState />
						) : (
							<ResponsiveContainer width="100%" height={260}>
								<LineChart
									data={revenueOverTime}
									margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
								>
									<CartesianGrid
										strokeDasharray="3 3"
										stroke="#f1f5f9"
										vertical={false}
									/>
									<XAxis
										dataKey="date"
										tick={{ fontSize: 11, fill: "#64748b" }}
										tickLine={false}
										axisLine={{ stroke: "#e2e8f0" }}
									/>
									<YAxis
										tick={{ fontSize: 11, fill: "#64748b" }}
										tickLine={false}
										axisLine={false}
										width={48}
									/>
									<Tooltip
										formatter={(value) => formatMoney(Number(value), currency)}
										contentStyle={{
											borderRadius: 12,
											border: "1px solid #e2e8f0",
											fontSize: 12,
										}}
									/>
									<Line
										type="monotone"
										dataKey="revenue"
										stroke="#059669"
										strokeWidth={2}
										dot={{ r: 4, fill: "#059669" }}
										activeDot={{ r: 6 }}
									/>
								</LineChart>
							</ResponsiveContainer>
						)}
					</ChartCard>

					<ChartCard title="Orders by Type">
						{ordersByType.length === 0 ? (
							<EmptyChartState />
						) : (
							<ResponsiveContainer width="100%" height={260}>
								<BarChart
									data={ordersByType}
									margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
								>
									<CartesianGrid
										strokeDasharray="3 3"
										stroke="#f1f5f9"
										vertical={false}
									/>
									<XAxis
										dataKey="type"
										tickFormatter={(type: string) =>
											ORDER_TYPE_LABELS[type] ?? type
										}
										tick={{ fontSize: 11, fill: "#64748b" }}
										tickLine={false}
										axisLine={{ stroke: "#e2e8f0" }}
									/>
									<YAxis
										tick={{ fontSize: 11, fill: "#64748b" }}
										tickLine={false}
										axisLine={false}
										width={36}
										allowDecimals={false}
									/>
									<Tooltip
										labelFormatter={(type) =>
											ORDER_TYPE_LABELS[String(type)] ?? type
										}
										contentStyle={{
											borderRadius: 12,
											border: "1px solid #e2e8f0",
											fontSize: 12,
										}}
									/>
									<Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={56}>
										{ordersByType.map((entry) => (
											<Cell
												key={entry.type}
												fill={ORDER_TYPE_COLORS[entry.type] ?? "#94a3b8"}
											/>
										))}
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						)}
					</ChartCard>

					<ChartCard title="Rating Distribution">
						{totals.totalRatings === 0 ? (
							<EmptyChartState message="No ratings submitted yet." />
						) : (
							<ResponsiveContainer width="100%" height={220}>
								<BarChart
									data={ratingDistribution}
									margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
								>
									<CartesianGrid
										strokeDasharray="3 3"
										stroke="#f1f5f9"
										vertical={false}
									/>
									<XAxis
										dataKey="star"
										tickFormatter={(star: number) => `${star} ★`}
										tick={{ fontSize: 11, fill: "#64748b" }}
										tickLine={false}
										axisLine={{ stroke: "#e2e8f0" }}
									/>
									<YAxis
										tick={{ fontSize: 11, fill: "#64748b" }}
										tickLine={false}
										axisLine={false}
										width={36}
										allowDecimals={false}
									/>
									<Tooltip
										labelFormatter={(star) => `${star} star`}
										contentStyle={{
											borderRadius: 12,
											border: "1px solid #e2e8f0",
											fontSize: 12,
										}}
									/>
									<Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
										{ratingDistribution.map((entry, index) => (
											<Cell
												key={entry.star}
												fill={RATING_STAR_SHADES[index] ?? "#f59e0b"}
											/>
										))}
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						)}
					</ChartCard>

					{ratingAverages ? (
						<ChartCard title="Rating Breakdown by Metric">
							<div className="grid gap-3">
								{(Object.keys(RATING_METRIC_LABELS) as RatingMetric[])
									.filter((metric) => ratingAverages[metric] != null)
									.map((metric) => (
										<MetricBar
											key={metric}
											label={RATING_METRIC_LABELS[metric]}
											value={ratingAverages[metric] as number}
										/>
									))}
							</div>
						</ChartCard>
					) : null}

					<ChartCard title="Staff Performance">
						{staffBreakdown.length === 0 ? (
							<EmptyChartState message="No staff members yet." />
						) : (
							<div className="overflow-x-auto">
								<table className="w-full min-w-[420px] text-left text-sm">
									<thead>
										<tr className="border-b border-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
											<th className="py-2 pr-4">Staff</th>
											<th className="py-2 pr-4">Orders Attended</th>
											<th className="py-2">Avg Rating</th>
										</tr>
									</thead>
									<tbody>
										{staffBreakdown
											.slice()
											.sort((a, b) => b.orderCount - a.orderCount)
											.map((staff) => (
												<tr
													key={staff.id}
													className="border-b border-slate-50 last:border-0"
												>
													<td className="py-2.5 pr-4 font-bold text-slate-900">
														{staff.name}
														<span className="ml-1 font-medium text-slate-400">
															#{staff.staffId}
														</span>
													</td>
													<td className="py-2.5 pr-4 font-semibold text-slate-700">
														{staff.orderCount}
													</td>
													<td className="py-2.5 font-semibold text-slate-700">
														{staff.avgRating != null
															? `${staff.avgRating.toFixed(1)} ★`
															: "—"}
													</td>
												</tr>
											))}
									</tbody>
								</table>
							</div>
						)}
					</ChartCard>
				</>
			)}
		</div>
	);
}
