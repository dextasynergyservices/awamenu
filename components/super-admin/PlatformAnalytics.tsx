"use client";

import {
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

type TrendPoint = { label: string; value: number };

type PlatformAnalyticsProps = {
	revenueTrend: TrendPoint[];
	restaurantGrowth: TrendPoint[];
	subscriptionGrowth: TrendPoint[];
	orderTrend: TrendPoint[];
};

function ChartCard({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="min-w-0 rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
			<h2 className="mb-4 text-xs font-black text-slate-800 sm:text-sm">
				{title}
			</h2>
			{children}
		</div>
	);
}

function EmptyChartState() {
	return (
		<div className="grid h-56 place-items-center text-sm font-medium text-slate-400">
			No data yet.
		</div>
	);
}

function formatMoney(value: number) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency: "NGN",
		maximumFractionDigits: 0,
	}).format(value);
}

const tooltipStyle = {
	borderRadius: 12,
	border: "1px solid #e2e8f0",
	fontSize: 12,
};

function TrendLineChart({
	data,
	color,
	formatValue,
}: {
	data: TrendPoint[];
	color: string;
	formatValue?: (value: number) => string;
}) {
	if (data.length === 0) return <EmptyChartState />;

	return (
		<ResponsiveContainer width="100%" height={240}>
			<LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
				<CartesianGrid
					strokeDasharray="3 3"
					stroke="#f1f5f9"
					vertical={false}
				/>
				<XAxis
					dataKey="label"
					tick={{ fontSize: 11, fill: "#64748b" }}
					tickLine={false}
					axisLine={{ stroke: "#e2e8f0" }}
				/>
				<YAxis
					tick={{ fontSize: 11, fill: "#64748b" }}
					tickLine={false}
					axisLine={false}
					width={48}
					allowDecimals={false}
				/>
				<Tooltip
					formatter={(value) =>
						formatValue ? formatValue(Number(value)) : Number(value)
					}
					contentStyle={tooltipStyle}
				/>
				<Line
					type="monotone"
					dataKey="value"
					stroke={color}
					strokeWidth={2}
					dot={{ r: 4, fill: color }}
					activeDot={{ r: 6 }}
				/>
			</LineChart>
		</ResponsiveContainer>
	);
}

function TrendBarChart({ data, color }: { data: TrendPoint[]; color: string }) {
	if (data.length === 0) return <EmptyChartState />;

	return (
		<ResponsiveContainer width="100%" height={240}>
			<BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
				<CartesianGrid
					strokeDasharray="3 3"
					stroke="#f1f5f9"
					vertical={false}
				/>
				<XAxis
					dataKey="label"
					tick={{ fontSize: 11, fill: "#64748b" }}
					tickLine={false}
					axisLine={{ stroke: "#e2e8f0" }}
				/>
				<YAxis
					tick={{ fontSize: 11, fill: "#64748b" }}
					tickLine={false}
					axisLine={false}
					width={40}
					allowDecimals={false}
				/>
				<Tooltip contentStyle={tooltipStyle} />
				<Bar
					dataKey="value"
					fill={color}
					radius={[4, 4, 0, 0]}
					maxBarSize={48}
				/>
			</BarChart>
		</ResponsiveContainer>
	);
}

export function PlatformAnalytics({
	revenueTrend,
	restaurantGrowth,
	subscriptionGrowth,
	orderTrend,
}: PlatformAnalyticsProps) {
	return (
		<div className="grid gap-4 sm:gap-6 md:grid-cols-2">
			<ChartCard title="Revenue Trend">
				<TrendLineChart
					data={revenueTrend}
					color="#059669"
					formatValue={formatMoney}
				/>
			</ChartCard>
			<ChartCard title="Restaurant Growth">
				<TrendLineChart data={restaurantGrowth} color="#2563eb" />
			</ChartCard>
			<ChartCard title="Subscription Growth">
				<TrendLineChart data={subscriptionGrowth} color="#7c3aed" />
			</ChartCard>
			<ChartCard title="Order Trend">
				<TrendBarChart data={orderTrend} color="#f59e0b" />
			</ChartCard>
		</div>
	);
}
