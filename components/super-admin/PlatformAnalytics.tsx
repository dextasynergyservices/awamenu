"use client";

import {
	BarChart3,
	Compass,
	Globe2,
	Lightbulb,
	Rocket,
	Store,
	Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	axisTick,
	ChartCard,
	ColumnChart,
	card,
	Delta,
	Donut,
	EMERALD,
	Empty,
	GRID,
	Heatmap,
	RankBars,
	Segmented,
	TYPE_COLOR,
	TYPE_LABEL,
	tooltipStyle,
	useFormat,
} from "@/components/admin/analytics/charts";
import type { PlatformAnalytics as Data } from "@/lib/platform-analytics";
import type { TrafficResult } from "@/lib/posthog-query";
import { cn } from "@/lib/utils";

/**
 * The Super Admin's business dashboard. Same chart kit and palette as the
 * owner analytics: emerald for single series, fixed colours per category.
 */

export const PLATFORM_TABS = [
	"overview",
	"revenue",
	"growth",
	"marketplace",
	"traffic",
] as const;
export type PlatformTab = (typeof PLATFORM_TABS)[number];

const TABS: Record<PlatformTab, { label: string; icon: typeof Store }> = {
	overview: { label: "Overview", icon: Compass },
	revenue: { label: "Revenue", icon: Wallet },
	growth: { label: "Growth", icon: Rocket },
	marketplace: { label: "Marketplace", icon: Store },
	traffic: { label: "Traffic", icon: Globe2 },
};

const C = {
	newSubs: "#2a78d6",
	renewals: EMERALD,
	commission: "#6250d6",
	owners: "#2a78d6",
	restaurants: EMERALD,
};
const PAY_METHOD: Record<string, { label: string; color: string }> = {
	AWAMENU_PAY: { label: "AwaMenu Pay", color: "#6250d6" },
	PAYSTACK: { label: "Own gateway", color: "#2a78d6" },
	CASH: { label: "Cash", color: EMERALD },
	POS: { label: "POS", color: "#eda100" },
	TRANSFER: { label: "Bank transfer", color: "#eb6834" },
};

type SubscriptionSnapshot = {
	mrr: number;
	paying: number;
	autoRenewRate: number;
	byState: Record<string, number>;
	planMix: Array<{ id: string; name: string; count: number; mrr: number }>;
};

function Kpi({
	label,
	value,
	change,
	hint,
	invert,
}: {
	label: string;
	value: string;
	change?: number | null;
	hint?: string;
	invert?: boolean;
}) {
	return (
		<div className={card}>
			<p className="truncate text-xs font-bold text-slate-500">{label}</p>
			<p className="mt-1 truncate text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
				{value}
			</p>
			<p className="mt-1 truncate text-xs font-medium text-slate-500">
				{change !== undefined ? (
					<>
						<Delta change={change} invert={invert} />{" "}
						<span>vs previous period</span>
					</>
				) : (
					hint
				)}
			</p>
		</div>
	);
}

function Stacked({
	rows,
	keys,
	format,
	height = 280,
}: {
	rows: Array<Record<string, string | number>>;
	keys: Array<{ key: string; label: string; color: string }>;
	format: (v: number) => string;
	height?: number;
}) {
	if (rows.every((r) => keys.every((k) => !Number(r[k.key])))) {
		return <Empty height={height}>Nothing in this period yet.</Empty>;
	}
	const name = new Map(keys.map((k) => [k.key, k.label]));
	return (
		<ResponsiveContainer width="100%" height={height}>
			<BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
				<CartesianGrid stroke={GRID} vertical={false} />
				<XAxis
					dataKey="label"
					tick={axisTick}
					tickLine={false}
					axisLine={{ stroke: "#e2e8f0" }}
					minTickGap={16}
				/>
				<YAxis
					tickFormatter={(v) => format(Number(v))}
					tick={axisTick}
					tickLine={false}
					axisLine={false}
					width={64}
				/>
				<Tooltip
					cursor={{ fill: GRID }}
					contentStyle={tooltipStyle}
					formatter={(v, n) => [format(Number(v)), name.get(String(n)) ?? n]}
				/>
				<Legend
					verticalAlign="top"
					align="right"
					height={24}
					iconSize={10}
					formatter={(v) => (
						<span className="text-xs font-semibold text-slate-600">
							{name.get(String(v)) ?? v}
						</span>
					)}
				/>
				{keys.map((k, i) => (
					<Bar
						key={k.key}
						dataKey={k.key}
						stackId="a"
						fill={k.color}
						stroke="#ffffff"
						strokeWidth={1}
						maxBarSize={36}
						isAnimationActive={false}
						radius={i === keys.length - 1 ? [4, 4, 0, 0] : undefined}
					/>
				))}
			</BarChart>
		</ResponsiveContainer>
	);
}

function TrendLine({
	rows,
	dataKey,
	name,
	format,
	height = 240,
}: {
	rows: Array<Record<string, string | number>>;
	dataKey: string;
	name: string;
	format: (v: number) => string;
	height?: number;
}) {
	if (rows.every((r) => !Number(r[dataKey])))
		return <Empty height={height}>Nothing in this period yet.</Empty>;
	return (
		<ResponsiveContainer width="100%" height={height}>
			<LineChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
				<CartesianGrid stroke={GRID} vertical={false} />
				<XAxis
					dataKey="label"
					tick={axisTick}
					tickLine={false}
					axisLine={{ stroke: "#e2e8f0" }}
					minTickGap={16}
				/>
				<YAxis
					tickFormatter={(v) => format(Number(v))}
					tick={axisTick}
					tickLine={false}
					axisLine={false}
					width={64}
				/>
				<Tooltip
					contentStyle={tooltipStyle}
					formatter={(v) => [format(Number(v)), name]}
				/>
				<Line
					dataKey={dataKey}
					type="monotone"
					stroke={EMERALD}
					strokeWidth={2.5}
					dot={false}
					isAnimationActive={false}
				/>
			</LineChart>
		</ResponsiveContainer>
	);
}

function Funnel({ steps }: { steps: Array<{ label: string; value: number }> }) {
	const top = Math.max(1, steps[0]?.value ?? 1);
	if (steps.every((s) => s.value === 0))
		return <Empty height={220}>No sign-ups in this period.</Empty>;
	return (
		<ol className="grid gap-3">
			{steps.map((s, i) => (
				<li key={s.label}>
					<div className="flex items-baseline justify-between gap-2 text-sm">
						<span className="font-bold text-slate-700">{s.label}</span>
						<span className="font-black text-slate-950">
							{s.value}
							<span className="ml-1.5 text-xs font-semibold text-slate-400">
								{Math.round((s.value / top) * 100)}%
							</span>
						</span>
					</div>
					<div className="mt-1 h-6 rounded-md bg-slate-100">
						<div
							className="h-6 rounded-md"
							style={{
								width: `${s.value > 0 ? Math.max(2, (s.value / top) * 100) : 0}%`,
								backgroundColor: EMERALD,
								opacity: 1 - i * 0.12,
							}}
						/>
					</div>
				</li>
			))}
		</ol>
	);
}

function Cohorts({ cohorts }: { cohorts: Data["cohorts"] }) {
	if (cohorts.length === 0)
		return (
			<Empty height={160}>No restaurants joined in the last 6 months.</Empty>
		);
	const shade = (v: number) =>
		v >= 0.8
			? "#047857"
			: v >= 0.6
				? "#10b981"
				: v >= 0.4
					? "#34d399"
					: v >= 0.2
						? "#a7f3d0"
						: v > 0
							? "#d1fae5"
							: "#f1f5f9";
	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-[30rem] text-center text-xs">
				<thead>
					<tr className="text-slate-500">
						<th className="py-1 text-left font-bold">Joined</th>
						<th className="py-1 font-bold">Restaurants</th>
						{Array.from({ length: 6 }, (_, i) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed month offsets
							<th key={i} className="py-1 font-bold">
								{i === 0 ? "Month 0" : `+${i}`}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{cohorts.map((c) => (
						<tr key={c.cohort}>
							<td className="py-1 text-left font-bold text-slate-700">
								{new Date(`${c.cohort}-15T12:00:00Z`).toLocaleDateString(
									"en-GB",
									{ month: "short", year: "numeric", timeZone: "UTC" },
								)}
							</td>
							<td className="py-1 font-black text-slate-900">{c.size}</td>
							{c.retention.map((v, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: fixed month offsets
								<td key={i} className="p-0.5">
									{v === null ? (
										<span className="block rounded py-1.5 text-slate-300">
											·
										</span>
									) : (
										<span
											className={cn(
												"block rounded py-1.5 font-black",
												v >= 0.6 ? "text-white" : "text-slate-800",
											)}
											style={{ backgroundColor: shade(v) }}
											title={`${Math.round(v * 100)}% ordered in month ${i}`}
										>
											{Math.round(v * 100)}%
										</span>
									)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
			<p className="mt-2 text-[11px] font-medium text-slate-500">
				Share of each month&apos;s new restaurants that took at least one order
				in each month after joining.
			</p>
		</div>
	);
}

function insights(
	data: Data,
	subs: SubscriptionSnapshot,
	f: ReturnType<typeof useFormat>,
) {
	const k = data.kpis;
	const out: string[] = [];
	if (k.revenue.change !== null && Math.abs(k.revenue.change) >= 5) {
		out.push(
			`Platform revenue is ${k.revenue.change > 0 ? "up" : "down"} ${Math.abs(Math.round(k.revenue.change))}% on the previous period (${f.money(k.revenue.value)}).`,
		);
	}
	if (k.gmv.value > 0) {
		out.push(
			`Restaurants took ${f.money(k.gmv.value)} across ${k.orders.value.toLocaleString()} orders; average order ${f.money(k.aov.value)}.`,
		);
	}
	if (k.awamenuPayShare.value > 0) {
		out.push(
			`${Math.round(k.awamenuPayShare.value)}% of online payments went through AwaMenu Pay, at an effective ${k.takeRate.value.toFixed(2)}% commission.`,
		);
	}
	const f0 = data.funnel;
	if (f0.signedUp >= 3) {
		const stuck = f0.restaurant - f0.menu;
		out.push(
			`${f0.signedUp} owners signed up; ${f0.ordered} got a first order${stuck > 0 ? `. ${stuck} created a restaurant but haven't added a menu` : ""}.`,
		);
	}
	if (subs.paying > 0) {
		out.push(
			`${Math.round(subs.autoRenewRate * 100)}% of paying restaurants auto-renew; the rest need reminders to stay on.`,
		);
	}
	const top = data.topRestaurants[0];
	if (top && k.gmv.value > 0) {
		out.push(
			`${top.name} is the biggest restaurant (${Math.round((top.gmv / k.gmv.value) * 100)}% of sales).`,
		);
	}
	return out.slice(0, 6);
}

export function PlatformAnalytics({
	data,
	subs,
	traffic,
	tab,
	query,
}: {
	data: Data;
	subs: SubscriptionSnapshot;
	traffic: TrafficResult | null;
	tab: PlatformTab;
	query: string;
}) {
	const f = useFormat("NGN");
	const k = data.kpis;
	const rows = data.series as unknown as Array<Record<string, string | number>>;
	const [mpMetric, setMpMetric] = useState<
		"gmv" | "orders" | "activeRestaurants"
	>("gmv");
	const tabHref = (t: PlatformTab) =>
		`/super-admin/analytics?${query}${query ? "&" : ""}tab=${t}`;
	const notes = insights(data, subs, f);

	return (
		<div className="grid gap-4">
			<div
				role="tablist"
				aria-label="Analytics sections"
				className="-mx-4 flex gap-1 overflow-x-auto border-slate-200 border-b px-4 md:mx-0 md:px-0"
			>
				{(Object.keys(TABS) as PlatformTab[]).map((key) => {
					const Icon = TABS[key].icon;
					return (
						<Link
							key={key}
							href={tabHref(key)}
							role="tab"
							aria-selected={tab === key}
							className={cn(
								"-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-bold",
								tab === key
									? "border-emerald-600 text-slate-950"
									: "border-transparent text-slate-500 hover:text-slate-800",
							)}
						>
							<Icon className="size-4" aria-hidden="true" />
							{TABS[key].label}
						</Link>
					);
				})}
			</div>

			{tab === "overview" ? (
				<div className="grid gap-4">
					<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						<Kpi
							label="Platform revenue"
							value={f.compact(k.revenue.value)}
							change={k.revenue.change}
						/>
						<Kpi
							label="MRR"
							value={f.compact(k.mrr.value)}
							change={k.mrr.change}
						/>
						<Kpi
							label="Sales through restaurants (GMV)"
							value={f.compact(k.gmv.value)}
							change={k.gmv.change}
						/>
						<Kpi
							label="Active restaurants"
							value={String(k.activeRestaurants.value)}
							change={k.activeRestaurants.change}
						/>
					</div>
					<div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
						<ChartCard
							title="Platform revenue"
							subtitle="Subscriptions and AwaMenu Pay commission"
						>
							<Stacked
								rows={rows}
								format={f.axisMoney}
								keys={[
									{
										key: "newSubscriptions",
										label: "New subscriptions",
										color: C.newSubs,
									},
									{ key: "renewals", label: "Renewals", color: C.renewals },
									{
										key: "commission",
										label: "Commission",
										color: C.commission,
									},
								]}
							/>
						</ChartCard>
						<section className={cn(card, "bg-slate-50/60")}>
							<h2 className="flex items-center gap-2 text-base font-black text-slate-950">
								<Lightbulb
									className="size-4 text-amber-500"
									aria-hidden="true"
								/>
								Insights
							</h2>
							{notes.length === 0 ? (
								<p className="mt-3 text-sm font-medium text-slate-500">
									Insights appear once there&apos;s activity to compare.
								</p>
							) : (
								<ul className="mt-3 grid gap-2.5">
									{notes.map((n) => (
										<li
											key={n}
											className="rounded-xl bg-white p-3 text-sm font-medium leading-5 text-slate-700 shadow-sm"
										>
											{n}
										</li>
									))}
								</ul>
							)}
						</section>
					</div>
					<div className="grid gap-4 lg:grid-cols-2">
						<ChartCard
							title="Restaurant sales"
							subtitle="Paid orders across every restaurant"
						>
							<ColumnChart
								data={rows}
								xKey="label"
								yKey="gmv"
								name="Sales"
								format={f.axisMoney}
							/>
						</ChartCard>
						<ChartCard title="Sign-ups" subtitle="New restaurants">
							<ColumnChart
								data={rows}
								xKey="label"
								yKey="restaurantsJoined"
								name="Restaurants"
								format={f.count}
							/>
						</ChartCard>
					</div>
				</div>
			) : null}

			{tab === "revenue" ? (
				<div className="grid gap-4">
					<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						<Kpi
							label="Subscription revenue"
							value={f.compact(k.subscriptions.value)}
							change={k.subscriptions.change}
						/>
						<Kpi
							label="Commission revenue"
							value={f.compact(k.commission.value)}
							change={k.commission.change}
						/>
						<Kpi
							label="MRR now"
							value={f.compact(subs.mrr)}
							hint={`ARR ${f.compact(subs.mrr * 12)} · ${subs.paying} paying`}
						/>
						<Kpi
							label="Effective take rate"
							value={`${k.takeRate.value.toFixed(2)}%`}
							hint="commission ÷ AwaMenu Pay volume"
						/>
					</div>
					<div className="grid gap-4 lg:grid-cols-2">
						<ChartCard
							title="MRR"
							subtitle="Monthly recurring revenue at the end of each period"
						>
							<TrendLine
								rows={rows}
								dataKey="mrr"
								name="MRR"
								format={f.axisMoney}
							/>
						</ChartCard>
						<ChartCard title="Revenue by source">
							<Stacked
								rows={rows}
								format={f.axisMoney}
								height={240}
								keys={[
									{
										key: "newSubscriptions",
										label: "New subscriptions",
										color: C.newSubs,
									},
									{ key: "renewals", label: "Renewals", color: C.renewals },
									{
										key: "commission",
										label: "Commission",
										color: C.commission,
									},
								]}
							/>
						</ChartCard>
					</div>
					<div className="grid gap-4 lg:grid-cols-2">
						<ChartCard
							title="MRR by plan"
							action={
								<Link
									href="/super-admin/subscriptions"
									className="text-xs font-black text-emerald-700"
								>
									Subscriptions
								</Link>
							}
						>
							<RankBars
								empty="No paying subscriptions."
								rows={subs.planMix.map((p) => ({
									key: p.id,
									label: p.name,
									value: p.mrr,
									display: f.compact(p.mrr),
									detail: `${p.count} paying`,
								}))}
							/>
						</ChartCard>
						<ChartCard
							title="AwaMenu Pay"
							subtitle="Volume through AwaMenu Pay and the commission on it"
							action={
								<Link
									href="/super-admin/commission"
									className="text-xs font-black text-emerald-700"
								>
									Commission audit
								</Link>
							}
						>
							<ColumnChart
								data={rows}
								xKey="label"
								yKey="awamenuPayVolume"
								name="AwaMenu Pay volume"
								format={f.axisMoney}
							/>
						</ChartCard>
					</div>
				</div>
			) : null}

			{tab === "growth" ? (
				<div className="grid gap-4">
					<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						<Kpi
							label="New owners"
							value={String(k.newOwners.value)}
							change={k.newOwners.change}
						/>
						<Kpi
							label="New restaurants"
							value={String(k.newRestaurants.value)}
							change={k.newRestaurants.change}
						/>
						<Kpi
							label="Sign-up to first order"
							value={
								data.funnel.signedUp
									? `${Math.round((data.funnel.ordered / data.funnel.signedUp) * 100)}%`
									: "—"
							}
							hint="of owners who joined in this period"
						/>
						<Kpi
							label="Sign-up to paid plan"
							value={
								data.funnel.signedUp
									? `${Math.round((data.funnel.paying / data.funnel.signedUp) * 100)}%`
									: "—"
							}
							hint="of owners who joined in this period"
						/>
					</div>
					<div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
						<ChartCard title="Sign-ups over time">
							<Stacked
								rows={rows}
								format={f.count}
								keys={[
									{
										key: "ownersJoined",
										label: "Owner accounts",
										color: C.owners,
									},
									{
										key: "restaurantsJoined",
										label: "Restaurants",
										color: C.restaurants,
									},
								]}
							/>
						</ChartCard>
						<ChartCard
							title="Activation"
							subtitle="How far owners who joined in this period got"
						>
							<Funnel
								steps={[
									{ label: "Signed up", value: data.funnel.signedUp },
									{ label: "Verified email", value: data.funnel.verified },
									{
										label: "Created a restaurant",
										value: data.funnel.restaurant,
									},
									{ label: "Added a menu", value: data.funnel.menu },
									{ label: "Got a first order", value: data.funnel.ordered },
									{ label: "Chose a paid plan", value: data.funnel.paying },
								]}
							/>
						</ChartCard>
					</div>
					<div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
						<ChartCard title="Retention by sign-up month">
							<Cohorts cohorts={data.cohorts} />
						</ChartCard>
						<ChartCard
							title="Billing status"
							subtitle="Every subscription today"
						>
							<Donut
								centerLabel="Subscriptions"
								centerValue={String(
									Object.values(subs.byState).reduce((t, n) => t + n, 0),
								)}
								format={f.count}
								slices={[
									{
										key: "ACTIVE",
										label: "Active",
										value: subs.byState.ACTIVE ?? 0,
										color: EMERALD,
									},
									{
										key: "EXPIRING_SOON",
										label: "Expiring soon",
										value: subs.byState.EXPIRING_SOON ?? 0,
										color: "#eda100",
									},
									{
										key: "GRACE",
										label: "In grace",
										value: subs.byState.GRACE ?? 0,
										color: "#eb6834",
									},
									{
										key: "LAPSED",
										label: "Lapsed",
										value: subs.byState.LAPSED ?? 0,
										color: "#e34948",
									},
									{
										key: "FREE",
										label: "Free",
										value: subs.byState.FREE ?? 0,
										color: "#94a3b8",
									},
								]}
							/>
						</ChartCard>
					</div>
				</div>
			) : null}

			{tab === "marketplace" ? (
				<div className="grid gap-4">
					<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
						<Kpi
							label="Orders"
							value={k.orders.value.toLocaleString()}
							change={k.orders.change}
						/>
						<Kpi
							label="Average order"
							value={f.money(k.aov.value)}
							change={k.aov.change}
						/>
						<Kpi
							label="Menu scans"
							value={k.scans.value.toLocaleString()}
							change={k.scans.change}
						/>
						<Kpi
							label="Table bookings"
							value={k.bookings.value.toLocaleString()}
							hint={`${k.bookings.covers.toLocaleString()} guests`}
						/>
					</div>
					<ChartCard
						title="Activity across restaurants"
						action={
							<Segmented
								label="Metric"
								value={mpMetric}
								onChange={setMpMetric}
								options={[
									{ key: "gmv", label: "Sales" },
									{ key: "orders", label: "Orders" },
									{ key: "activeRestaurants", label: "Active restaurants" },
								]}
							/>
						}
					>
						<ColumnChart
							data={rows}
							xKey="label"
							yKey={mpMetric}
							name={
								mpMetric === "gmv"
									? "Sales"
									: mpMetric === "orders"
										? "Orders"
										: "Active restaurants"
							}
							format={mpMetric === "gmv" ? f.axisMoney : f.count}
							height={260}
						/>
					</ChartCard>
					<div className="grid gap-4 lg:grid-cols-2">
						<ChartCard title="Order types">
							<Donut
								centerLabel="Orders"
								centerValue={k.orders.value.toLocaleString()}
								format={f.count}
								slices={data.orderTypes.map((t) => ({
									key: t.type,
									label: TYPE_LABEL[t.type] ?? t.type,
									value: t.orders,
									color: TYPE_COLOR[t.type] ?? EMERALD,
								}))}
							/>
						</ChartCard>
						<ChartCard title="How customers paid">
							<Donut
								centerLabel="Received"
								centerValue={f.compact(
									data.paymentMethods.reduce((t, m) => t + m.amount, 0),
								)}
								format={f.compact}
								slices={data.paymentMethods.map((m) => ({
									key: m.method,
									label: PAY_METHOD[m.method]?.label ?? m.method,
									value: m.amount,
									color: PAY_METHOD[m.method]?.color ?? "#94a3b8",
								}))}
							/>
						</ChartCard>
					</div>
					<ChartCard
						title="Busiest times"
						subtitle="Orders across all restaurants, Lagos time"
					>
						<Heatmap grid={data.heatmap} />
					</ChartCard>
					<ChartCard title="Top restaurants" subtitle="By sales in this period">
						{data.topRestaurants.length === 0 ? (
							<Empty height={140}>No orders in this period.</Empty>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full min-w-[30rem] text-left text-sm">
									<thead>
										<tr className="border-slate-100 border-b text-[11px] font-bold tracking-wide text-slate-500 uppercase">
											<th className="pb-2">Restaurant</th>
											<th className="pb-2 text-right">Orders</th>
											<th className="pb-2 text-right">Sales</th>
											<th className="pb-2 text-right">Change</th>
										</tr>
									</thead>
									<tbody>
										{data.topRestaurants.map((r) => (
											<tr
												key={r.restaurantId}
												className="border-slate-50 border-b last:border-0"
											>
												<td className="py-2">
													<Link
														href={`/super-admin/restaurants/${r.restaurantId}`}
														className="font-bold text-slate-900 hover:text-emerald-700"
													>
														{r.name}
													</Link>
												</td>
												<td className="py-2 text-right font-bold text-slate-900">
													{r.orders}
												</td>
												<td className="py-2 text-right font-black text-slate-950">
													{f.compact(r.gmv)}
												</td>
												<td className="py-2 text-right text-xs">
													<Delta change={r.change} />
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</ChartCard>
				</div>
			) : null}

			{tab === "traffic" ? <Traffic traffic={traffic} f={f} /> : null}
		</div>
	);
}

function Traffic({
	traffic,
	f,
}: {
	traffic: TrafficResult | null;
	f: ReturnType<typeof useFormat>;
}) {
	if (!traffic || traffic.status === "not_configured") {
		return (
			<section className={cn(card, "grid gap-3")}>
				<h2 className="flex items-center gap-2 text-base font-black text-slate-950">
					<BarChart3 className="size-4 text-emerald-700" aria-hidden="true" />
					Connect PostHog to see website traffic
				</h2>
				<p className="text-sm font-medium text-slate-600">
					Page views are already being collected. To show them here, give the
					app read access:
				</p>
				<ol className="grid gap-1.5 text-sm font-medium text-slate-700">
					<li>
						1. In PostHog, open Account settings → Personal API keys → Create
						key.
					</li>
					<li>
						2. Give it the <strong>Query: read</strong> scope and limit it to
						your AwaMenu project.
					</li>
					<li>
						3. Add these to the environment (see .env.example) and redeploy:
					</li>
				</ol>
				<pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100">
					{
						"POSTHOG_PERSONAL_API_KEY=phx_...\nPOSTHOG_PROJECT_ID=12345   # from your PostHog URL\nPOSTHOG_API_HOST=https://eu.posthog.com   # same region as your project (EU or US)"
					}
				</pre>
			</section>
		);
	}
	if (traffic.status === "error") {
		return (
			<section className={cn(card, "border-red-200 bg-red-50")}>
				<h2 className="text-base font-black text-red-800">
					Couldn&apos;t load traffic from PostHog
				</h2>
				<p className="mt-1 text-sm font-medium text-red-700">
					{traffic.message}
				</p>
			</section>
		);
	}
	const d = traffic.data;
	const change = (a: number, b: number) => (b > 0 ? ((a - b) / b) * 100 : null);
	const dailyRows = d.daily.map((r) => ({
		label: new Date(`${r.day}T12:00:00Z`).toLocaleDateString("en-GB", {
			day: "numeric",
			month: "short",
			timeZone: "UTC",
		}),
		visitors: r.visitors,
		pageviews: r.pageviews,
	}));
	const EVENT_LABEL: Record<string, string> = {
		restaurant_signup_completed: "Restaurants set up",
		subscription_completed: "First subscriptions",
		subscription_renewed: "Renewals",
		order_placed: "Orders placed",
		reservation_created: "Table bookings",
	};
	return (
		<div className="grid gap-4">
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<Kpi
					label="Visitors"
					value={d.totals.visitors.toLocaleString()}
					change={change(d.totals.visitors, d.previous.visitors)}
				/>
				<Kpi
					label="Page views"
					value={d.totals.pageviews.toLocaleString()}
					change={change(d.totals.pageviews, d.previous.pageviews)}
				/>
				<Kpi
					label="Sessions"
					value={d.totals.sessions.toLocaleString()}
					change={change(d.totals.sessions, d.previous.sessions)}
				/>
				<Kpi
					label="Pages per session"
					value={
						d.totals.sessions
							? (d.totals.pageviews / d.totals.sessions).toFixed(1)
							: "—"
					}
					hint="how far people browse"
				/>
			</div>
			<ChartCard title="Visitors" subtitle="Unique visitors each day">
				<ColumnChart
					data={dailyRows}
					xKey="label"
					yKey="visitors"
					name="Visitors"
					format={f.count}
					height={240}
				/>
			</ChartCard>
			<div className="grid gap-4 lg:grid-cols-2">
				<ChartCard title="Where visitors go" subtitle="By part of the product">
					<RankBars
						empty="No visits."
						rows={d.sections.map((s) => ({
							key: s.section,
							label: s.section,
							value: s.visitors,
							display: s.visitors.toLocaleString(),
							detail: `${s.views.toLocaleString()} views`,
						}))}
					/>
				</ChartCard>
				<ChartCard title="Where they come from">
					<RankBars
						empty="No visits."
						rows={d.referrers.map((r) => ({
							key: r.source,
							label: r.source,
							value: r.visitors,
							display: r.visitors.toLocaleString(),
						}))}
					/>
				</ChartCard>
			</div>
			<div className="grid gap-4 lg:grid-cols-3">
				<ChartCard title="Top pages" className="lg:col-span-2">
					<RankBars
						empty="No visits."
						rows={d.pages.map((p) => ({
							key: p.path,
							label: p.path,
							value: p.views,
							display: p.views.toLocaleString(),
							detail: `${p.visitors.toLocaleString()} visitors`,
						}))}
					/>
				</ChartCard>
				<ChartCard title="Devices">
					<Donut
						centerLabel="Visitors"
						centerValue={d.totals.visitors.toLocaleString()}
						format={f.count}
						slices={d.devices.map((x, i) => ({
							key: x.device,
							label: x.device,
							value: x.visitors,
							color: [EMERALD, "#2a78d6", "#eb6834", "#94a3b8"][i] ?? "#94a3b8",
						}))}
					/>
				</ChartCard>
			</div>
			<div className="grid gap-4 lg:grid-cols-2">
				<ChartCard title="Countries">
					<RankBars
						empty="No visits."
						rows={d.countries.map((c) => ({
							key: c.country,
							label: c.country,
							value: c.visitors,
							display: c.visitors.toLocaleString(),
						}))}
					/>
				</ChartCard>
				<ChartCard
					title="Key events"
					subtitle="Business events sent by the server"
				>
					<ul className="grid grid-cols-2 gap-2">
						{d.events.map((e) => (
							<li key={e.event} className="rounded-xl bg-slate-50 px-3 py-2.5">
								<p className="text-[11px] font-bold text-slate-500">
									{EVENT_LABEL[e.event] ?? e.event}
								</p>
								<p className="text-lg font-black text-slate-950">
									{e.count.toLocaleString()}
								</p>
							</li>
						))}
					</ul>
				</ChartCard>
			</div>
		</div>
	);
}
