"use client";

import { Lightbulb, Star, Utensils } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ComposedChart,
	Legend,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Scatter,
	ScatterChart,
	Tooltip,
	XAxis,
	YAxis,
	ZAxis,
} from "recharts";
import type {
	AdvancedAnalytics,
	RestaurantAnalytics,
} from "@/lib/restaurant-analytics";
import {
	axisTick,
	bucketByPeriod,
	ChartCard,
	ColumnChart,
	card,
	DAYS,
	Delta,
	Donut,
	dateKeys,
	EMERALD,
	Empty,
	type Format,
	GRID,
	Heatmap,
	Histogram,
	hourLabel,
	METHOD_COLOR,
	METHOD_LABEL,
	NEW_COLOR,
	PREVIOUS,
	RankBars,
	RETURNING_COLOR,
	Segmented,
	Stat,
	shortDay,
	TYPE_COLOR,
	TYPE_LABEL,
	tooltipStyle,
	WEEK_ORDER,
} from "./charts";

type Props = { data: RestaurantAnalytics; f: Format };
type AdvProps = Props & { adv: AdvancedAnalytics; slug: string };

const weeklyFor = (range: number) => range >= 90;

// ─── Overview ─────────────────────────────────────────

type TrendMetric = "sales" | "orders" | "aov";

function TrendChart({ data, f }: Props) {
	const [metric, setMetric] = useState<TrendMetric>("sales");
	const rows = bucketByPeriod(
		data.daily.map((d) => ({ ...d })),
		data.range > 90,
		(into, row) => {
			into.sales += row.sales;
			into.orders += row.orders;
			into.prevSales += row.prevSales;
			into.prevOrders += row.prevOrders;
		},
	).map((d) => ({
		label: d.label,
		current:
			metric === "sales"
				? d.sales
				: metric === "orders"
					? d.orders
					: d.orders
						? d.sales / d.orders
						: 0,
		previous:
			metric === "sales"
				? d.prevSales
				: metric === "orders"
					? d.prevOrders
					: d.prevOrders
						? d.prevSales / d.prevOrders
						: 0,
	}));
	const fmt = (v: number) => (metric === "orders" ? f.count(v) : f.money(v));
	const empty = rows.every((r) => r.current === 0 && r.previous === 0);
	return (
		<ChartCard
			title="Performance"
			subtitle={`${data.range > 90 ? "Each week" : "Each day"}, with the previous period dashed`}
			action={
				<Segmented
					label="Chart metric"
					value={metric}
					onChange={setMetric}
					options={[
						{ key: "sales", label: "Sales" },
						{ key: "orders", label: "Orders" },
						{ key: "aov", label: "Avg order" },
					]}
				/>
			}
		>
			{empty ? (
				<Empty height={260}>No orders in this period or the one before.</Empty>
			) : (
				<ResponsiveContainer width="100%" height={280}>
					<ComposedChart
						data={rows}
						margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
					>
						<CartesianGrid stroke={GRID} vertical={false} />
						<XAxis
							dataKey="label"
							tick={axisTick}
							tickLine={false}
							axisLine={{ stroke: "#e2e8f0" }}
							minTickGap={18}
						/>
						<YAxis
							tickFormatter={(v) =>
								metric === "orders"
									? f.count(Number(v))
									: f.axisMoney(Number(v))
							}
							tick={axisTick}
							tickLine={false}
							axisLine={false}
							width={64}
							allowDecimals={metric !== "orders"}
						/>
						<Tooltip
							cursor={{ fill: GRID }}
							contentStyle={tooltipStyle}
							formatter={(value, name) => [
								fmt(Number(value)),
								name === "current" ? "This period" : "Previous period",
							]}
						/>
						<Legend
							verticalAlign="top"
							align="right"
							height={24}
							iconSize={10}
							formatter={(v) => (
								<span className="text-xs font-semibold text-slate-600">
									{v === "current" ? "This period" : "Previous period"}
								</span>
							)}
						/>
						<Bar
							isAnimationActive={false}
							dataKey="current"
							fill={EMERALD}
							radius={[4, 4, 0, 0]}
							maxBarSize={28}
						/>
						<Line
							isAnimationActive={false}
							dataKey="previous"
							type="monotone"
							stroke={PREVIOUS}
							strokeWidth={2}
							strokeDasharray="5 4"
							dot={false}
						/>
					</ComposedChart>
				</ResponsiveContainer>
			)}
		</ChartCard>
	);
}

/** Running total against the previous period: are we ahead or behind? */
function SalesPace({ data, f }: Props) {
	let now = 0;
	let before = 0;
	const rows = data.daily.map((d) => {
		now += d.sales;
		before += d.prevSales;
		return { label: shortDay(d.date), current: now, previous: before };
	});
	const gap = now - before;
	return (
		<ChartCard
			title="Sales pace"
			subtitle="Running total through the period"
			action={
				before > 0 || now > 0 ? (
					<span
						className={`rounded-full px-2.5 py-1 text-xs font-black ${
							gap >= 0
								? "bg-emerald-50 text-emerald-800"
								: "bg-red-50 text-red-700"
						}`}
					>
						{gap >= 0 ? "Ahead by " : "Behind by "}
						{f.compact(Math.abs(gap))}
					</span>
				) : null
			}
		>
			{now === 0 && before === 0 ? (
				<Empty height={220}>No sales in this period or the one before.</Empty>
			) : (
				<ResponsiveContainer width="100%" height={220}>
					<LineChart
						data={rows}
						margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
					>
						<CartesianGrid stroke={GRID} vertical={false} />
						<XAxis
							dataKey="label"
							tick={axisTick}
							tickLine={false}
							axisLine={{ stroke: "#e2e8f0" }}
							minTickGap={24}
						/>
						<YAxis
							tickFormatter={(v) => f.axisMoney(Number(v))}
							tick={axisTick}
							tickLine={false}
							axisLine={false}
							width={64}
						/>
						<Tooltip
							contentStyle={tooltipStyle}
							formatter={(value, name) => [
								f.money(Number(value)),
								name === "current" ? "This period" : "Previous period",
							]}
						/>
						<Legend
							verticalAlign="top"
							align="right"
							height={24}
							iconSize={10}
							formatter={(v) => (
								<span className="text-xs font-semibold text-slate-600">
									{v === "current" ? "This period" : "Previous period"}
								</span>
							)}
						/>
						<Line
							isAnimationActive={false}
							dataKey="previous"
							type="monotone"
							stroke={PREVIOUS}
							strokeWidth={2}
							strokeDasharray="5 4"
							dot={false}
						/>
						<Line
							isAnimationActive={false}
							dataKey="current"
							type="monotone"
							stroke={EMERALD}
							strokeWidth={2.5}
							dot={false}
						/>
					</LineChart>
				</ResponsiveContainer>
			)}
		</ChartCard>
	);
}

/** Plain-language findings from the numbers already on the page. */
function buildInsights(data: RestaurantAnalytics, f: Format) {
	const out: string[] = [];
	const { kpis, daily, advanced: adv } = data;
	const change = kpis.sales.change;
	if (change !== null && Math.abs(change) >= 5) {
		out.push(
			`Sales are ${change > 0 ? "up" : "down"} ${Math.abs(Math.round(change))}% on the previous ${data.range} days (${f.money(kpis.sales.value)} vs ${f.money(kpis.sales.previous)}).`,
		);
	}
	const best = [...daily].sort((a, b) => b.sales - a.sales)[0];
	if (best && best.sales > 0) {
		out.push(
			`Your best day was ${shortDay(best.date)}, with ${f.money(best.sales)} from ${best.orders} order${best.orders === 1 ? "" : "s"}.`,
		);
	}
	if (adv) {
		const peakHour = [...adv.hourly].sort((a, b) => b.sales - a.sales)[0];
		if (peakHour && peakHour.orders > 1) {
			out.push(
				`${hourLabel(peakHour.hour)}–${hourLabel((peakHour.hour + 1) % 24)} is your strongest hour (${f.money(peakHour.sales)}). Have full staff on then.`,
			);
		}
		const top = adv.topItems[0];
		if (top && top.share >= 0.15) {
			out.push(
				`${top.name} brought in ${Math.round(top.share * 100)}% of dish sales.`,
			);
		}
		if (adv.notOrdered.length > 0 && adv.publishedItems > 0) {
			out.push(
				`${adv.notOrdered.length} of ${adv.publishedItems} published dishes weren't ordered. A photo or a better description can help.`,
			);
		}
		if (adv.customers.total >= 5) {
			out.push(
				`${Math.round((adv.customers.returning / adv.customers.total) * 100)}% of your ${adv.customers.total} customers had ordered before.`,
			);
		}
		if (adv.bookings.noShowRate >= 0.15 && adv.bookings.kept >= 5) {
			out.push(
				`${Math.round(adv.bookings.noShowRate * 100)}% of bookings were no-shows. A deposit on busy tables can help.`,
			);
		}
	}
	if (kpis.scans.value >= 20 && kpis.orders.value > 0) {
		const ratio = Math.round(kpis.scans.value / kpis.orders.value);
		if (ratio >= 2)
			out.push(`About 1 in ${ratio} menu scans turned into an order.`);
	}
	if (kpis.cancellationRate.value >= 0.1 && kpis.orders.value >= 5) {
		out.push(
			`${Math.round(kpis.cancellationRate.value * 100)}% of orders were cancelled. See the reasons under Operations.`,
		);
	}
	return out.slice(0, 6);
}

function Insights(props: Props) {
	const insights = buildInsights(props.data, props.f);
	return (
		<section className={`${card} bg-slate-50/60`}>
			<h2 className="flex items-center gap-2 text-base font-black text-slate-950">
				<Lightbulb className="size-4 text-amber-500" aria-hidden="true" />
				Insights
			</h2>
			{insights.length === 0 ? (
				<p className="mt-3 text-sm font-medium text-slate-500">
					Insights appear here once there are a few orders to compare.
				</p>
			) : (
				<ul className="mt-3 grid gap-2.5">
					{insights.map((text) => (
						<li
							key={text}
							className="rounded-xl bg-white p-3 text-sm font-medium leading-5 text-slate-700 shadow-sm"
						>
							{text}
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

export function OverviewTab(props: Props & { adv: AdvancedAnalytics | null }) {
	const { adv, f } = props;
	return (
		<div className="grid gap-4">
			<div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
				<TrendChart {...props} />
				<Insights {...props} />
			</div>
			<div className="grid gap-4 lg:grid-cols-2">
				<SalesPace {...props} />
				{adv ? (
					<ChartCard title="Order mix" subtitle="Share of orders by type">
						<Donut
							centerLabel="Orders"
							centerValue={f.count(
								adv.orderTypes.reduce((t, o) => t + o.orders, 0),
							)}
							format={f.count}
							slices={adv.orderTypes.map((t) => ({
								key: t.type,
								label: TYPE_LABEL[t.type] ?? t.type,
								value: t.orders,
								color: TYPE_COLOR[t.type] ?? EMERALD,
							}))}
						/>
					</ChartCard>
				) : null}
			</div>
			{adv ? (
				<ChartCard title="Busiest times" subtitle="Orders by day and hour">
					<Heatmap grid={adv.heatmap} />
				</ChartCard>
			) : null}
		</div>
	);
}

// ─── Sales ────────────────────────────────────────────

/** Stacked bars of one dated series split by category. */
function StackedOverTime({
	rows,
	keys,
	format,
	height = 260,
}: {
	rows: Array<Record<string, number | string>>;
	keys: Array<{ key: string; label: string; color: string }>;
	format: (v: number) => string;
	height?: number;
}) {
	const empty = rows.every((r) => keys.every((k) => !Number(r[k.key])));
	if (empty)
		return <Empty height={height}>Nothing to show for this period yet.</Empty>;
	const labelOf = new Map(keys.map((k) => [k.key, k.label]));
	return (
		<ResponsiveContainer width="100%" height={height}>
			<BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
				<CartesianGrid stroke={GRID} vertical={false} />
				<XAxis
					dataKey="label"
					tick={axisTick}
					tickLine={false}
					axisLine={{ stroke: "#e2e8f0" }}
					minTickGap={18}
				/>
				<YAxis
					tickFormatter={(v) => format(Number(v))}
					tick={axisTick}
					tickLine={false}
					axisLine={false}
					width={64}
					allowDecimals={false}
				/>
				<Tooltip
					cursor={{ fill: GRID }}
					contentStyle={tooltipStyle}
					formatter={(v, n) => [
						format(Number(v)),
						labelOf.get(String(n)) ?? String(n),
					]}
				/>
				<Legend
					verticalAlign="top"
					align="right"
					height={24}
					iconSize={10}
					formatter={(v) => (
						<span className="text-xs font-semibold text-slate-600">
							{labelOf.get(String(v)) ?? v}
						</span>
					)}
				/>
				{keys.map((k, i) => (
					<Bar
						isAnimationActive={false}
						key={k.key}
						dataKey={k.key}
						stackId="a"
						fill={k.color}
						stroke="#ffffff"
						strokeWidth={1}
						maxBarSize={32}
						radius={i === keys.length - 1 ? [4, 4, 0, 0] : undefined}
					/>
				))}
			</BarChart>
		</ResponsiveContainer>
	);
}

export function SalesTab({ data, f, adv }: AdvProps) {
	const [hourMetric, setHourMetric] = useState<"sales" | "orders">("sales");
	const fmtHour = hourMetric === "sales" ? f.axisMoney : f.count;

	// Average per weekday: totals divided by how many of that weekday the
	// period had, so a range with five Fridays isn't flattered.
	const weekday = WEEK_ORDER.map((dow) => {
		const days = data.daily.filter(
			(d) => new Date(`${d.date}T12:00:00Z`).getUTCDay() === dow,
		);
		const sales = days.reduce((t, d) => t + d.sales, 0);
		return { label: DAYS[dow], average: days.length ? sales / days.length : 0 };
	});
	const bestWeekday = [...weekday].sort((a, b) => b.average - a.average)[0];
	const bestHour = [...adv.hourly].sort((a, b) => b.sales - a.sales)[0];

	const types = [...new Set(adv.typeDaily.map((r) => r.type))];
	const byDay = new Map<string, Record<string, number>>();
	for (const r of adv.typeDaily) {
		const row = byDay.get(r.day) ?? {};
		row[r.type] = (row[r.type] ?? 0) + r.sales;
		byDay.set(r.day, row);
	}
	const typeRows = bucketByPeriod(
		dateKeys(data.from, data.to).map((date) => ({
			date,
			...Object.fromEntries(types.map((t) => [t, byDay.get(date)?.[t] ?? 0])),
		})) as Array<{ date: string } & Record<string, number>>,
		weeklyFor(data.range),
		(into, row) => {
			for (const t of types)
				into[t] = (Number(into[t]) || 0) + (Number(row[t]) || 0);
		},
	);
	const paymentsTotal = adv.payments.reduce((t, p) => t + p.amount, 0);

	return (
		<div className="grid gap-4">
			<div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
				<Stat label="Sales" value={f.compact(data.kpis.sales.value)} />
				<Stat
					label="Average order"
					value={f.money(data.kpis.averageOrder.value)}
				/>
				<Stat
					label="Strongest hour"
					value={
						bestHour && bestHour.sales > 0 ? hourLabel(bestHour.hour) : "—"
					}
					hint={
						bestHour && bestHour.sales > 0
							? f.compact(bestHour.sales)
							: undefined
					}
				/>
				<Stat
					label="Best weekday"
					value={
						bestWeekday && bestWeekday.average > 0 ? bestWeekday.label : "—"
					}
					hint={
						bestWeekday && bestWeekday.average > 0
							? `${f.compact(bestWeekday.average)} on average`
							: undefined
					}
				/>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<ChartCard
					title="By hour of day"
					subtitle="When the money comes in"
					action={
						<Segmented
							label="Hour metric"
							value={hourMetric}
							onChange={setHourMetric}
							options={[
								{ key: "sales", label: "Sales" },
								{ key: "orders", label: "Orders" },
							]}
						/>
					}
				>
					<ColumnChart
						data={adv.hourly.map((h) => ({
							label: hourLabel(h.hour),
							value: h[hourMetric],
						}))}
						xKey="label"
						yKey="value"
						name={hourMetric === "sales" ? "Sales" : "Orders"}
						format={fmtHour}
						highlightMax
						xInterval={2}
					/>
				</ChartCard>
				<ChartCard
					title="By day of week"
					subtitle="Average sales on each weekday"
				>
					<ColumnChart
						data={weekday}
						xKey="label"
						yKey="average"
						name="Average sales"
						format={f.axisMoney}
						highlightMax
						xInterval={0}
					/>
				</ChartCard>
			</div>

			<ChartCard
				title="Sales by order type"
				subtitle={weeklyFor(data.range) ? "Each week" : "Each day"}
			>
				<StackedOverTime
					rows={typeRows}
					format={f.axisMoney}
					keys={types.map((t) => ({
						key: t,
						label: TYPE_LABEL[t] ?? t,
						color: TYPE_COLOR[t] ?? EMERALD,
					}))}
				/>
			</ChartCard>

			<div className="grid gap-4 lg:grid-cols-3">
				<ChartCard
					title="Order values"
					subtitle="How much each paid order came to"
				>
					<Histogram buckets={adv.orderValues} unit="Orders" lowerBoundTicks />
				</ChartCard>
				<ChartCard title="Items per order" subtitle="Basket size">
					<Histogram buckets={adv.basketSizes} unit="Orders" />
				</ChartCard>
				<ChartCard
					title="Payment methods"
					subtitle={
						paymentsTotal ? `${f.money(paymentsTotal)} received` : undefined
					}
				>
					<Donut
						centerLabel="Received"
						centerValue={f.compact(paymentsTotal)}
						format={f.compact}
						slices={adv.payments.map((p) => ({
							key: p.method,
							label: METHOD_LABEL[p.method] ?? p.method,
							value: p.amount,
							color: METHOD_COLOR[p.method] ?? EMERALD,
						}))}
					/>
				</ChartCard>
			</div>
		</div>
	);
}

// ─── Menu ─────────────────────────────────────────────

function median(values: number[]) {
	if (values.length === 0) return 0;
	const s = [...values].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const QUADRANTS = [
	{
		key: "star",
		label: "Stars",
		hint: "Popular and higher-priced. Keep them prominent.",
	},
	{
		key: "workhorse",
		label: "Workhorses",
		hint: "Popular but lower-priced. A small price rise or a pairing can lift them.",
	},
	{
		key: "puzzle",
		label: "Puzzles",
		hint: "Higher-priced but rarely ordered. Better photos or placement.",
	},
	{
		key: "weak",
		label: "Underperformers",
		hint: "Rarely ordered and lower-priced. Rework or retire.",
	},
] as const;

/**
 * Menu engineering: each dish by how often it sold (popularity) and its
 * average price, split at the medians into four groups owners can act on.
 */
function MenuMatrix({ adv, f }: { adv: AdvancedAnalytics; f: Format }) {
	const dishes = adv.dishes;
	if (dishes.length < 4) {
		return (
			<Empty height={300}>Needs at least 4 dishes with sales to compare.</Empty>
		);
	}
	const qtyMid = median(dishes.map((d) => d.qty));
	const priceMid = median(dishes.map((d) => d.avgPrice));
	const groupOf = (d: (typeof dishes)[number]) =>
		d.qty >= qtyMid
			? d.avgPrice >= priceMid
				? "star"
				: "workhorse"
			: d.avgPrice >= priceMid
				? "puzzle"
				: "weak";
	return (
		<div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
			<ResponsiveContainer width="100%" height={320}>
				<ScatterChart margin={{ top: 8, right: 12, left: 0, bottom: 16 }}>
					<CartesianGrid stroke={GRID} />
					<XAxis
						type="number"
						dataKey="qty"
						name="Sold"
						tick={axisTick}
						tickLine={false}
						axisLine={{ stroke: "#e2e8f0" }}
						label={{
							value: "Times ordered →",
							position: "insideBottom",
							offset: -8,
							fontSize: 11,
							fill: "#64748b",
						}}
						allowDecimals={false}
					/>
					<YAxis
						type="number"
						dataKey="avgPrice"
						name="Price"
						tick={axisTick}
						tickLine={false}
						axisLine={false}
						width={64}
						tickFormatter={(v) => f.axisMoney(Number(v))}
					/>
					<ZAxis
						type="number"
						dataKey="revenue"
						range={[50, 420]}
						name="Sales"
					/>
					<ReferenceLine x={qtyMid} stroke="#cbd5e1" strokeDasharray="4 4" />
					<ReferenceLine y={priceMid} stroke="#cbd5e1" strokeDasharray="4 4" />
					<Tooltip
						cursor={{ strokeDasharray: "3 3" }}
						contentStyle={tooltipStyle}
						content={({ payload }) => {
							const d = payload?.[0]?.payload as
								| (typeof dishes)[number]
								| undefined;
							if (!d) return null;
							return (
								<div className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs shadow-lg">
									<p className="font-black text-slate-950">{d.name}</p>
									<p className="text-slate-500">{d.category}</p>
									<p className="mt-1 text-slate-700">
										{d.qty} sold · {f.money(d.avgPrice)} each ·{" "}
										{f.money(d.revenue)}
									</p>
								</div>
							);
						}}
					/>
					<Scatter
						isAnimationActive={false}
						data={dishes}
						fill={EMERALD}
						fillOpacity={0.7}
						stroke="#ffffff"
						strokeWidth={2}
					/>
				</ScatterChart>
			</ResponsiveContainer>
			<ul className="grid content-start gap-2.5">
				{QUADRANTS.map((q) => {
					const members = dishes.filter((d) => groupOf(d) === q.key);
					return (
						<li key={q.key} className="rounded-xl border border-slate-100 p-3">
							<p className="flex items-baseline justify-between text-sm">
								<span className="font-black text-slate-950">{q.label}</span>
								<span className="text-xs font-bold text-slate-500">
									{members.length}
								</span>
							</p>
							<p className="text-xs font-medium text-slate-500">{q.hint}</p>
							{members.length ? (
								<p className="mt-1 truncate text-xs font-bold text-slate-700">
									{members
										.slice(0, 4)
										.map((m) => m.name)
										.join(", ")}
									{members.length > 4 ? ` +${members.length - 4}` : ""}
								</p>
							) : null}
						</li>
					);
				})}
			</ul>
		</div>
	);
}

export function MenuTab({ f, adv, slug }: AdvProps) {
	const sold = adv.dishes.reduce((t, d) => t + d.qty, 0);
	const categoryTotal = adv.categories.reduce((t, c) => t + c.revenue, 0);
	return (
		<div className="grid gap-4">
			<div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
				<Stat label="Dishes sold" value={f.count(sold)} />
				<Stat
					label="Different dishes ordered"
					value={f.count(adv.dishes.length)}
				/>
				<Stat label="Published dishes" value={f.count(adv.publishedItems)} />
				<Stat label="Not ordered" value={f.count(adv.notOrdered.length)} />
			</div>

			<ChartCard
				title="Menu performance"
				subtitle="Each dish by how often it sold and its price. Bigger dots brought in more."
			>
				<MenuMatrix adv={adv} f={f} />
			</ChartCard>

			<div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
				<ChartCard
					title="Best sellers"
					subtitle="By sales value in this period"
				>
					{adv.topItems.length === 0 ? (
						<Empty height={160}>No dishes sold yet.</Empty>
					) : (
						<ol className="grid gap-2">
							{adv.topItems.map((item, i) => (
								<li
									key={item.id}
									className="grid grid-cols-[1.25rem_2.5rem_minmax(0,1fr)_auto] items-center gap-3"
								>
									<span className="text-xs font-black text-slate-400">
										{i + 1}
									</span>
									{item.imageUrl ? (
										<Image
											src={item.imageUrl}
											alt=""
											width={40}
											height={40}
											className="size-10 rounded-lg object-cover"
											unoptimized
										/>
									) : (
										<span className="grid size-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
											<Utensils className="size-4" aria-hidden="true" />
										</span>
									)}
									<div className="min-w-0">
										<p className="truncate text-sm font-bold text-slate-900">
											{item.name}
										</p>
										<div className="mt-1 h-1.5 rounded-full bg-slate-100">
											<div
												className="h-1.5 rounded-full bg-emerald-600"
												style={{ width: `${Math.max(3, item.share * 100)}%` }}
											/>
										</div>
									</div>
									<div className="text-right">
										<p className="text-sm font-black text-slate-950">
											{f.compact(item.revenue)}
										</p>
										<p className="text-[11px] font-semibold text-slate-500">
											{item.qty} sold
										</p>
									</div>
								</li>
							))}
						</ol>
					)}
				</ChartCard>
				<ChartCard title="Sales by category">
					<RankBars
						empty="No category sales yet."
						rows={adv.categories.map((c) => ({
							key: c.name,
							label: c.name,
							value: c.revenue,
							display: f.compact(c.revenue),
							detail: categoryTotal
								? `${Math.round((c.revenue / categoryTotal) * 100)}%`
								: undefined,
						}))}
					/>
				</ChartCard>
			</div>

			<ChartCard
				title="Not ordered"
				subtitle={`${adv.notOrdered.length} of ${adv.publishedItems} published dishes had no orders`}
			>
				{adv.notOrdered.length === 0 ? (
					<p className="text-sm font-medium text-slate-500">
						Every published dish was ordered at least once.
					</p>
				) : (
					<>
						<ul className="flex flex-wrap gap-1.5">
							{adv.notOrdered.slice(0, 30).map((m) => (
								<li
									key={m.id}
									className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700"
								>
									{m.name}
								</li>
							))}
						</ul>
						<p className="mt-3 text-xs font-medium text-slate-500">
							Consider a photo, a better description or making one today&apos;s
							special.{" "}
							<Link
								href={`/dashboard/${slug}/menu`}
								className="font-bold text-emerald-700"
							>
								Edit menu
							</Link>
						</p>
					</>
				)}
			</ChartCard>
		</div>
	);
}

// ─── Customers ────────────────────────────────────────

export function CustomersTab({ data, f, adv }: AdvProps) {
	const c = adv.customers;
	const nrByDay = new Map(c.daily.map((r) => [r.day, r]));
	const nrRows = bucketByPeriod(
		dateKeys(data.from, data.to).map((date) => ({
			date,
			new: nrByDay.get(date)?.new ?? 0,
			returning: nrByDay.get(date)?.returning ?? 0,
		})),
		weeklyFor(data.range),
		(into, row) => {
			into.new += row.new;
			into.returning += row.returning;
		},
	);
	const ratingTotal = adv.ratings.distribution.reduce((t, r) => t + r.count, 0);

	return (
		<div className="grid gap-4">
			<div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
				<Stat label="Customers" value={f.count(c.total)} />
				<Stat
					label="Returning"
					value={c.total ? f.pct(c.returning / c.total) : "—"}
					hint={`${f.count(c.returning)} had ordered before`}
				/>
				<Stat
					label="Orders per customer"
					value={c.total ? (data.kpis.orders.value / c.total).toFixed(1) : "—"}
				/>
				<Stat
					label="Spend per customer"
					value={c.total ? f.money(data.kpis.sales.value / c.total) : "—"}
				/>
			</div>

			<div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
				<ChartCard
					title="New and returning"
					subtitle={`Customers ${weeklyFor(data.range) ? "each week" : "each day"}`}
				>
					<StackedOverTime
						rows={nrRows}
						format={f.count}
						keys={[
							{ key: "returning", label: "Returning", color: RETURNING_COLOR },
							{ key: "new", label: "New", color: NEW_COLOR },
						]}
					/>
				</ChartCard>
				<ChartCard
					title="How often they order"
					subtitle="Customers by number of orders"
				>
					<Histogram buckets={c.frequency} unit="Customers" height={260} />
				</ChartCard>
			</div>

			<div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
				<ChartCard title="Top customers" subtitle="By spend in this period">
					{c.top.length === 0 ? (
						<Empty height={160}>No customers yet.</Empty>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full min-w-[440px] text-left text-sm">
								<thead>
									<tr className="border-slate-100 border-b text-[11px] font-bold tracking-wide text-slate-500 uppercase">
										<th className="pb-2">Customer</th>
										<th className="pb-2 text-right">Orders</th>
										<th className="pb-2 text-right">Spent</th>
										<th className="pb-2 text-right">Last order</th>
									</tr>
								</thead>
								<tbody>
									{c.top.map((row) => (
										<tr
											key={`${row.name}-${row.phone}`}
											className="border-slate-50 border-b last:border-0"
										>
											<td className="py-2">
												<p className="font-bold text-slate-800">{row.name}</p>
												<p className="text-xs text-slate-400">{row.phone}</p>
											</td>
											<td className="py-2 text-right font-bold text-slate-900">
												{row.orders}
											</td>
											<td className="py-2 text-right font-black text-slate-950">
												{f.money(row.spent)}
											</td>
											<td className="py-2 text-right text-slate-600">
												{shortDay(row.last)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</ChartCard>
				<ChartCard
					title="Reviews"
					subtitle={ratingTotal ? `${ratingTotal} in this period` : undefined}
				>
					{ratingTotal === 0 ? (
						<Empty height={160}>No reviews in this period.</Empty>
					) : (
						<>
							<ul className="grid gap-1.5">
								{adv.ratings.distribution.map((r) => (
									<li
										key={r.stars}
										className="grid grid-cols-[2rem_minmax(0,1fr)_1.5rem] items-center gap-2 text-xs font-bold text-slate-600"
									>
										<span className="inline-flex items-center gap-0.5">
											{r.stars}
											<Star
												className="size-3 fill-amber-400 text-amber-400"
												aria-hidden="true"
											/>
										</span>
										<span className="h-2 rounded-full bg-slate-100">
											<span
												className="block h-2 rounded-full bg-amber-400"
												style={{ width: `${(r.count / ratingTotal) * 100}%` }}
											/>
										</span>
										<span className="text-right">{r.count}</span>
									</li>
								))}
							</ul>
							{adv.ratings.averages.length ? (
								<div className="mt-4 border-slate-100 border-t pt-3">
									<RankBars
										empty=""
										rows={adv.ratings.averages.map((a) => ({
											key: a.label,
											label: a.label,
											value: a.value,
											display: `${a.value.toFixed(1)} / 5`,
										}))}
									/>
								</div>
							) : null}
						</>
					)}
				</ChartCard>
			</div>
		</div>
	);
}

// ─── Operations ───────────────────────────────────────

function Funnel({
	steps,
	f,
}: {
	steps: Array<{ label: string; value: number }>;
	f: Format;
}) {
	const max = Math.max(...steps.map((s) => s.value), 1);
	if (steps.every((s) => s.value === 0))
		return <Empty height={200}>No orders in this period.</Empty>;
	return (
		<ol className="grid gap-3">
			{steps.map((s, i) => {
				const prev = steps[i - 1]?.value;
				const conv = prev && s.value <= prev ? s.value / prev : null;
				return (
					<li key={s.label}>
						<div className="flex items-baseline justify-between gap-2 text-sm">
							<span className="font-bold text-slate-700">{s.label}</span>
							<span className="font-black text-slate-950">
								{f.count(s.value)}
								{conv !== null ? (
									<span className="ml-1.5 text-xs font-semibold text-slate-400">
										{f.pct(conv)} of previous
									</span>
								) : null}
							</span>
						</div>
						<div className="mt-1 h-6 rounded-md bg-slate-100">
							<div
								className="h-6 rounded-md"
								style={{
									width: `${s.value > 0 ? Math.max(2, (s.value / max) * 100) : 0}%`,
									backgroundColor: EMERALD,
									opacity: 1 - i * 0.12,
								}}
							/>
						</div>
					</li>
				);
			})}
		</ol>
	);
}

/** "45s", "12 min", "1h 05m". */
export function formatDuration(seconds: number | null) {
	if (seconds === null) return "—";
	if (seconds < 60) return `${Math.round(seconds)}s`;
	const mins = Math.round(seconds / 60);
	if (mins < 60) return `${mins} min`;
	return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

function SpeedStat({
	label,
	value,
	previous,
	hint,
}: {
	label: string;
	value: number | null;
	previous: number | null;
	hint: string;
}) {
	const change =
		value !== null && previous ? ((value - previous) / previous) * 100 : null;
	return (
		<div className={card}>
			<p className="text-xs font-bold text-slate-500">{label}</p>
			<p className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
				{formatDuration(value)}
			</p>
			<p className="mt-1 text-xs font-medium text-slate-500">
				{value !== null && previous ? (
					<>
						{/* Lower is better: a faster kitchen is green. */}
						<Delta change={change} invert /> <span>vs previous period</span>
					</>
				) : (
					hint
				)}
			</p>
		</div>
	);
}

/** How fast orders move, from the stage times stamped on each status change. */
function Speed({ data, adv }: AdvProps) {
	const t = adv.timing;
	const hasData =
		t.prep.count + t.response.count + t.delivery.count + t.pickup.count > 0;
	const byDay = new Map(t.prepByDay.map((r) => [r.day, r.median / 60]));
	const trend = bucketByPeriod(
		dateKeys(data.from, data.to).map((date) => ({
			date,
			minutes: byDay.get(date) ?? 0,
			n: byDay.has(date) ? 1 : 0,
		})),
		weeklyFor(data.range),
		(into, row) => {
			// Weekly: the mean of that week's daily medians.
			into.minutes =
				(into.minutes * into.n + row.minutes * row.n) /
				Math.max(1, into.n + row.n);
			into.n += row.n;
		},
	);
	const minutes = (v: number) => `${Math.round(v)} min`;

	if (!hasData) {
		return (
			<section className={card}>
				<h2 className="text-base font-black text-slate-950">Speed</h2>
				<p className="mt-2 text-sm font-medium text-slate-500">
					{t.trackedSince
						? "No timed orders in this period yet."
						: "Order times are recorded from now on: how long you take to accept, prepare and deliver. Charts fill in as new orders move through their statuses."}
				</p>
			</section>
		);
	}

	return (
		<div className="grid gap-4">
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<SpeedStat
					label="Response time"
					value={t.response.median}
					previous={t.response.previous}
					hint={`Placed → accepted · ${t.response.count} orders`}
				/>
				<SpeedStat
					label="Prep time"
					value={t.prep.median}
					previous={t.prep.previous}
					hint={
						t.prep.p90
							? `9 in 10 within ${formatDuration(t.prep.p90)}`
							: "Confirmed → ready"
					}
				/>
				<SpeedStat
					label="Delivery time"
					value={t.delivery.median}
					previous={t.delivery.previous}
					hint={`Ready → delivered · ${t.delivery.count} orders`}
				/>
				<SpeedStat
					label="Pickup wait"
					value={t.pickup.median}
					previous={t.pickup.previous}
					hint={`Ready → collected · ${t.pickup.count} orders`}
				/>
			</div>
			<div className="grid gap-4 lg:grid-cols-3">
				<ChartCard title="Prep time" subtitle="Minutes from confirmed to ready">
					<Histogram buckets={t.prepHistogram} unit="Orders" />
				</ChartCard>
				<ChartCard
					title="Prep time by hour"
					subtitle="Median; the darkest bar is your slowest hour"
				>
					<ColumnChart
						data={Array.from({ length: 24 }, (_, h) => ({
							label: hourLabel(h),
							minutes:
								(t.prepByHour.find((r) => r.hour === h)?.median ?? 0) / 60,
						}))}
						xKey="label"
						yKey="minutes"
						name="Median prep"
						format={minutes}
						highlightMax
						xInterval={2}
					/>
				</ChartCard>
				<ChartCard title="Prep time by order type" subtitle="Median">
					<RankBars
						empty="No timed orders yet."
						rows={t.prepByType
							.sort((a, b) => b.median - a.median)
							.map((r) => ({
								key: r.type,
								label: TYPE_LABEL[r.type] ?? r.type,
								value: r.median,
								display: formatDuration(r.median),
								detail: `${r.n} orders`,
								color: TYPE_COLOR[r.type],
							}))}
					/>
				</ChartCard>
			</div>
			<ChartCard
				title="Prep time trend"
				subtitle={`Median minutes ${weeklyFor(data.range) ? "each week" : "each day"}`}
			>
				<ColumnChart
					data={trend}
					xKey="label"
					yKey="minutes"
					name="Median prep"
					format={minutes}
				/>
			</ChartCard>
		</div>
	);
}

export function OperationsTab(props: AdvProps) {
	const { data, f, adv } = props;
	const fn = adv.funnel;
	const cancelled = adv.cancelReasons.reduce((t, r) => t + r.count, 0);
	return (
		<div className="grid gap-4">
			<Speed {...props} />
			<div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
				<Stat label="Orders placed" value={f.count(fn.placed)} />
				<Stat
					label="Accepted"
					value={fn.placed ? f.pct(fn.accepted / fn.placed) : "—"}
				/>
				<Stat
					label="Completed"
					value={fn.placed ? f.pct(fn.completed / fn.placed) : "—"}
				/>
				<Stat
					label="Cancelled"
					value={f.pct(data.kpis.cancellationRate.value)}
					hint={`${f.count(cancelled)} orders`}
				/>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<ChartCard
					title="Order funnel"
					subtitle="From a menu scan to a finished order"
				>
					<Funnel
						f={f}
						steps={[
							...(fn.scans > 0
								? [{ label: "Menu scans", value: fn.scans }]
								: []),
							{ label: "Orders placed", value: fn.placed },
							{ label: "Accepted", value: fn.accepted },
							{ label: "Paid", value: fn.paid },
							{ label: "Completed", value: fn.completed },
						]}
					/>
				</ChartCard>
				<ChartCard
					title="Why orders were cancelled"
					subtitle="Most common reasons"
				>
					<RankBars
						empty="No cancelled orders in this period."
						rows={adv.cancelReasons.map((r) => ({
							key: r.reason,
							label: r.reason,
							value: r.count,
							display: f.count(r.count),
							color: "#e34948",
						}))}
					/>
				</ChartCard>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<ChartCard
					title="Kitchen load"
					subtitle="Orders by hour of day, for planning shifts"
				>
					<ColumnChart
						data={adv.hourly.map((h) => ({
							label: hourLabel(h.hour),
							orders: h.orders,
						}))}
						xKey="label"
						yKey="orders"
						name="Orders"
						format={f.count}
						highlightMax
						xInterval={2}
					/>
				</ChartCard>
				<ChartCard
					title="Staff"
					subtitle="Orders handled and their customers' ratings"
				>
					{adv.staff.length === 0 ? (
						<Empty height={160}>No staff yet.</Empty>
					) : (
						<RankBars
							empty=""
							rows={adv.staff.map((s) => ({
								key: s.id,
								label: s.name,
								value: s.orders,
								display: `${f.count(s.orders)} orders`,
								detail: [
									s.sales ? f.compact(s.sales) : null,
									s.rating ? `${s.rating.toFixed(1)} ★` : null,
								]
									.filter(Boolean)
									.join(" · "),
							}))}
						/>
					)}
				</ChartCard>
			</div>
		</div>
	);
}

// ─── Bookings ─────────────────────────────────────────

const BOOKING_STATUS: Record<string, { label: string; color: string }> = {
	COMPLETED: { label: "Completed", color: EMERALD },
	CHECKED_IN: { label: "Seated", color: EMERALD },
	ACTIVE: { label: "Confirmed", color: "#2a78d6" },
	APPROVED: { label: "Awaiting payment", color: "#eda100" },
	PENDING_APPROVAL: { label: "Awaiting approval", color: "#eda100" },
	EXPIRED: { label: "No-show", color: "#e34948" },
	CANCELLED: { label: "Cancelled", color: "#94a3b8" },
	DECLINED: { label: "Declined", color: "#94a3b8" },
};

export function BookingsTab({ data, f, adv }: AdvProps) {
	const b = adv.bookings;
	if (b.total === 0 && b.upcoming === 0) {
		return (
			<section className={card}>
				<Empty height={220}>
					No table bookings in this period. Bookings appear here once guests
					reserve tables.
				</Empty>
			</section>
		);
	}
	const byDay = new Map(b.daily.map((r) => [r.day, r.count]));
	const dailyRows = bucketByPeriod(
		dateKeys(data.from, data.to).map((date) => ({
			date,
			count: byDay.get(date) ?? 0,
		})),
		weeklyFor(data.range),
		(into, row) => {
			into.count += row.count;
		},
	);
	return (
		<div className="grid gap-4">
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
				<Stat
					label="Bookings"
					value={f.count(b.total)}
					hint={`${f.count(b.kept)} kept`}
				/>
				<Stat label="Guests seated" value={f.count(b.covers)} />
				<Stat
					label="Average party"
					value={b.averageParty ? b.averageParty.toFixed(1) : "—"}
				/>
				<Stat label="No-show rate" value={f.pct(b.noShowRate)} />
				<Stat label="Deposits kept" value={f.compact(b.deposits)} />
				<Stat
					label="Next 7 days"
					value={f.count(b.upcoming)}
					hint="upcoming bookings"
				/>
			</div>

			<div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
				<ChartCard
					title="Bookings over time"
					subtitle={
						weeklyFor(data.range)
							? "Each week, by table time"
							: "Each day, by table time"
					}
				>
					<ColumnChart
						data={dailyRows}
						xKey="label"
						yKey="count"
						name="Bookings"
						format={f.count}
					/>
				</ChartCard>
				<ChartCard title="Outcome" subtitle="What happened to each booking">
					<RankBars
						empty="No bookings."
						rows={b.status
							.sort((x, y) => y.count - x.count)
							.map((s) => ({
								key: s.status,
								label: BOOKING_STATUS[s.status]?.label ?? s.status,
								value: s.count,
								display: f.count(s.count),
								detail: b.total ? f.pct(s.count / b.total) : undefined,
								color: BOOKING_STATUS[s.status]?.color,
							}))}
					/>
				</ChartCard>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<ChartCard title="Booking times" subtitle="Hour guests booked for">
					<ColumnChart
						data={b.hour.map((n, h) => ({ label: hourLabel(h), count: n }))}
						xKey="label"
						yKey="count"
						name="Bookings"
						format={f.count}
						highlightMax
						xInterval={2}
					/>
				</ChartCard>
				<ChartCard
					title="Booking days"
					subtitle="Day of week guests booked for"
				>
					<ColumnChart
						data={WEEK_ORDER.map((dow) => ({
							label: DAYS[dow],
							count: b.weekday[dow],
						}))}
						xKey="label"
						yKey="count"
						name="Bookings"
						format={f.count}
						highlightMax
						xInterval={0}
					/>
				</ChartCard>
			</div>

			<div className="grid gap-4 lg:grid-cols-3">
				<ChartCard title="Party size">
					<Histogram buckets={b.partySizes} unit="Bookings" />
				</ChartCard>
				<ChartCard
					title="Booked ahead"
					subtitle="Days between booking and the table time"
				>
					<Histogram buckets={b.leadTime} unit="Bookings" />
				</ChartCard>
				<ChartCard title="Tables" subtitle="Bookings per table">
					<RankBars
						empty="No kept bookings yet."
						rows={b.tables.slice(0, 8).map((t) => ({
							key: t.label,
							label: t.label,
							value: t.bookings,
							display: f.count(t.bookings),
							detail: `${t.covers} guests`,
						}))}
					/>
				</ChartCard>
			</div>
		</div>
	);
}
