"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { Bucket, Metric } from "@/lib/restaurant-analytics";
import { cn } from "@/lib/utils";

/**
 * The analytics chart kit. One hue (emerald) for single-series magnitude;
 * categories (order types, payment methods, new vs returning) keep a fixed
 * colour per entity from a validated palette, so a filter never repaints them.
 * Text stays in ink colours; colour only marks data.
 */

export const EMERALD = "#059669";
export const PREVIOUS = "#94a3b8";
export const INK_MUTED = "#64748b";
export const GRID = "#f1f5f9";

export const TYPE_LABEL: Record<string, string> = {
	DINE_IN: "Dine-in",
	PICKUP: "Pickup",
	DELIVERY: "Delivery",
	TABLE_RESERVATION: "Table bookings",
};
export const TYPE_COLOR: Record<string, string> = {
	DINE_IN: EMERALD,
	PICKUP: "#2a78d6",
	DELIVERY: "#eb6834",
	TABLE_RESERVATION: "#6250d6",
};
export const METHOD_LABEL: Record<string, string> = {
	CASH: "Cash",
	POS: "POS",
	TRANSFER: "Bank transfer",
	PAYSTACK: "Online",
};
export const METHOD_COLOR: Record<string, string> = {
	CASH: EMERALD,
	POS: "#2a78d6",
	TRANSFER: "#eb6834",
	PAYSTACK: "#6250d6",
};
export const NEW_COLOR = "#2a78d6";
export const RETURNING_COLOR = EMERALD;

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Monday first, the way restaurant weeks are planned. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const card =
	"min-w-0 rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-5";

export const axisTick = { fontSize: 11, fill: INK_MUTED };
export const tooltipStyle = {
	borderRadius: 12,
	border: "1px solid #e2e8f0",
	fontSize: 12,
	boxShadow: "0 8px 24px -12px rgb(15 23 42 / 0.25)",
};

export type Format = ReturnType<typeof useFormat>;

/**
 * Number formatting that renders identically on the server and in the
 * browser. Intl's compact notation doesn't (Node and Chrome ship different
 * locale data: "₦1M" vs "₦1.0M"), which breaks hydration, so compact
 * amounts are built by hand around the currency symbol.
 */
export function useFormat(currency: string) {
	const money = new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	});
	const symbol =
		money.formatToParts(0).find((p) => p.type === "currency")?.value ?? "";
	const trim = (n: number) => n.toFixed(1).replace(/\.0$/, "");
	const short = (v: number) => {
		const abs = Math.abs(v);
		const sign = v < 0 ? "-" : "";
		if (abs >= 1_000_000_000)
			return `${sign}${symbol}${trim(abs / 1_000_000_000)}B`;
		if (abs >= 1_000_000) return `${sign}${symbol}${trim(abs / 1_000_000)}M`;
		if (abs >= 1_000) return `${sign}${symbol}${trim(abs / 1_000)}k`;
		return `${sign}${symbol}${Math.round(abs)}`;
	};
	return {
		money: (v: number) => money.format(v),
		compact: (v: number) =>
			Math.abs(v) >= 100_000 ? short(v) : money.format(v),
		axisMoney: short,
		pct: (v: number) => `${Math.round(v * 1000) / 10}%`,
		count: (v: number) => Math.round(v).toLocaleString("en-NG"),
	};
}

export function shortDay(key: string) {
	return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});
}

export function hourLabel(h: number) {
	return `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? "am" : "pm"}`;
}

/**
 * Groups dated rows into weeks (Monday start) for long ranges, so a
 * 12-month chart has 52 readable bars rather than 365 slivers.
 */
export function bucketByPeriod<T extends { date: string }>(
	rows: T[],
	weekly: boolean,
	sum: (into: T, row: T) => void,
): Array<T & { label: string }> {
	if (!weekly) return rows.map((r) => ({ ...r, label: shortDay(r.date) }));
	const out = new Map<string, T>();
	for (const row of rows) {
		const d = new Date(`${row.date}T12:00:00Z`);
		const back = (d.getUTCDay() + 6) % 7;
		d.setUTCDate(d.getUTCDate() - back);
		const key = d.toISOString().slice(0, 10);
		const existing = out.get(key);
		if (existing) sum(existing, row);
		else out.set(key, { ...row, date: key });
	}
	return [...out.values()].map((r) => ({
		...r,
		label: `w/c ${shortDay(r.date)}`,
	}));
}

/** Every date from `from` to `to` inclusive, as YYYY-MM-DD. */
export function dateKeys(from: string, to: string) {
	const out: string[] = [];
	const d = new Date(`${from}T12:00:00Z`);
	const end = new Date(`${to}T12:00:00Z`);
	while (d <= end) {
		out.push(d.toISOString().slice(0, 10));
		d.setUTCDate(d.getUTCDate() + 1);
	}
	return out;
}

export function Delta({
	change,
	invert = false,
}: {
	change: number | null;
	invert?: boolean;
}) {
	if (change === null)
		return <span className="text-slate-400">No earlier data</span>;
	const rounded = Math.round(change);
	if (rounded === 0) return <span className="text-slate-500">No change</span>;
	const good = invert ? rounded < 0 : rounded > 0;
	const Icon = rounded > 0 ? ArrowUpRight : ArrowDownRight;
	return (
		<span
			className={cn(
				"inline-flex items-center gap-0.5 font-bold",
				good ? "text-emerald-700" : "text-red-600",
			)}
		>
			<Icon className="size-3.5" aria-hidden="true" />
			{rounded > 0 ? "+" : ""}
			{rounded}%
		</span>
	);
}

/** A small trend line (one series, no axes): the shape of the period. */
function Sparkline({ values }: { values: number[] }) {
	if (values.length < 2 || values.every((v) => v === 0)) return null;
	const w = 120;
	const h = 28;
	const max = Math.max(...values, 1);
	const step = w / (values.length - 1);
	const points = values
		.map(
			(v, i) =>
				`${(i * step).toFixed(1)},${(h - 2 - (v / max) * (h - 4)).toFixed(1)}`,
		)
		.join(" ");
	return (
		<svg
			viewBox={`0 0 ${w} ${h}`}
			preserveAspectRatio="none"
			className="mt-2 h-7 w-full"
			aria-hidden="true"
		>
			<polyline
				points={points}
				fill="none"
				stroke={EMERALD}
				strokeWidth={1.75}
				strokeLinejoin="round"
				strokeLinecap="round"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}

export function Kpi({
	label,
	value,
	metric,
	invert,
	hint,
	spark,
}: {
	label: string;
	value: string;
	metric?: Metric;
	invert?: boolean;
	hint?: string;
	spark?: number[];
}) {
	return (
		<div className={card}>
			<p className="text-xs font-bold text-slate-500">{label}</p>
			<p className="mt-1 truncate text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
				{value}
			</p>
			<p className="mt-1 text-xs font-medium text-slate-500">
				{metric ? (
					<>
						<Delta change={metric.change} invert={invert} />{" "}
						<span>vs previous period</span>
					</>
				) : (
					hint
				)}
			</p>
			{spark ? <Sparkline values={spark} /> : null}
		</div>
	);
}

/** A compact stat for the row at the top of a tab. */
export function Stat({
	label,
	value,
	hint,
}: {
	label: string;
	value: string;
	hint?: string;
}) {
	return (
		<div className="min-w-0 rounded-xl border border-slate-200/70 bg-white px-3.5 py-3">
			<p className="truncate text-[11px] font-bold text-slate-500">{label}</p>
			<p className="truncate text-lg font-black text-slate-950">{value}</p>
			{hint ? (
				<p className="truncate text-[11px] font-medium text-slate-500">
					{hint}
				</p>
			) : null}
		</div>
	);
}

export function ChartCard({
	title,
	subtitle,
	action,
	children,
	className,
}: {
	title: string;
	subtitle?: string;
	action?: ReactNode;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section className={cn(card, className)}>
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<h2 className="text-base font-black text-slate-950">{title}</h2>
					{subtitle ? (
						<p className="text-xs font-medium text-slate-500">{subtitle}</p>
					) : null}
				</div>
				{action}
			</div>
			<div className="mt-4">{children}</div>
		</section>
	);
}

export function Empty({
	children,
	height = 200,
}: {
	children: ReactNode;
	height?: number;
}) {
	return (
		<p
			className="grid place-items-center rounded-xl bg-slate-50/70 px-4 text-center text-sm font-medium text-slate-400"
			style={{ height }}
		>
			{children}
		</p>
	);
}

export function Segmented<T extends string>({
	value,
	options,
	onChange,
	label,
}: {
	value: T;
	options: Array<{ key: T; label: string }>;
	onChange: (key: T) => void;
	label: string;
}) {
	return (
		<div
			role="tablist"
			aria-label={label}
			className="flex rounded-lg bg-slate-100 p-0.5"
		>
			{options.map((o) => (
				<button
					key={o.key}
					type="button"
					role="tab"
					aria-selected={value === o.key}
					onClick={() => onChange(o.key)}
					className={cn(
						"rounded-md px-2.5 py-1 text-xs font-bold transition-colors",
						value === o.key
							? "bg-white text-slate-950 shadow-sm"
							: "text-slate-600",
					)}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}

/**
 * Vertical bars for one series: histograms and per-hour/per-day profiles.
 * `highlight` darkens the tallest bar so the peak reads at a glance.
 */
export function ColumnChart({
	data,
	xKey,
	yKey,
	format,
	name,
	height = 220,
	highlightMax = false,
	xInterval,
	tickFormatter,
}: {
	data: object[];
	xKey: string;
	yKey: string;
	format: (v: number) => string;
	name: string;
	height?: number;
	highlightMax?: boolean;
	xInterval?: number;
	tickFormatter?: (label: string) => string;
}) {
	const values = data.map(
		(d) => Number((d as Record<string, unknown>)[yKey]) || 0,
	);
	if (values.every((v) => v === 0)) {
		return <Empty height={height}>Nothing to show for this period yet.</Empty>;
	}
	const max = Math.max(...values);
	return (
		<ResponsiveContainer width="100%" height={height}>
			<BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
				<CartesianGrid stroke={GRID} vertical={false} />
				<XAxis
					dataKey={xKey}
					tick={axisTick}
					tickLine={false}
					axisLine={{ stroke: "#e2e8f0" }}
					interval={xInterval ?? "preserveStartEnd"}
					minTickGap={8}
					tickFormatter={(v) =>
						(tickFormatter ? tickFormatter(String(v)) : String(v)).replace(
							/–/g,
							"-",
						)
					}
				/>
				<YAxis
					tick={axisTick}
					tickLine={false}
					axisLine={false}
					width={56}
					tickFormatter={(v) => format(Number(v))}
					allowDecimals={false}
				/>
				<Tooltip
					cursor={{ fill: GRID }}
					contentStyle={tooltipStyle}
					formatter={(v) => [format(Number(v)), name]}
				/>
				<Bar
					isAnimationActive={false}
					dataKey={yKey}
					radius={[4, 4, 0, 0]}
					maxBarSize={40}
				>
					{values.map((v, i) => (
						<Cell
							// biome-ignore lint/suspicious/noArrayIndexKey: one cell per fixed bar
							key={i}
							fill={highlightMax && v === max ? "#047857" : EMERALD}
							fillOpacity={highlightMax && v !== max ? 0.75 : 1}
						/>
					))}
				</Bar>
			</BarChart>
		</ResponsiveContainer>
	);
}

/** Histogram from pre-bucketed counts. */
export function Histogram({
	buckets,
	unit,
	height,
	lowerBoundTicks = false,
}: {
	buckets: Bucket[];
	unit: string;
	height?: number;
	/** Money ranges: label each bar by where it starts ("4k"), the tooltip
	 * keeps the whole range. */
	lowerBoundTicks?: boolean;
}) {
	return (
		<ColumnChart
			data={buckets}
			xKey="label"
			yKey="count"
			name={unit}
			format={(v) => Math.round(v).toLocaleString("en-NG")}
			height={height}
			xInterval={buckets.length > 7 ? 1 : 0}
			tickFormatter={
				lowerBoundTicks ? (label) => label.split("–")[0] : undefined
			}
		/>
	);
}

/** Horizontal bars with labels and values written out: ranked lists. */
export function RankBars({
	rows,
	empty,
}: {
	rows: Array<{
		key: string;
		label: string;
		value: number;
		display: string;
		detail?: string;
		color?: string;
	}>;
	empty: string;
}) {
	if (rows.length === 0) return <Empty height={120}>{empty}</Empty>;
	const max = Math.max(...rows.map((r) => r.value), 1);
	return (
		<ul className="grid gap-3">
			{rows.map((r) => (
				<li key={r.key}>
					<div className="flex items-baseline justify-between gap-2 text-sm">
						<span className="truncate font-bold text-slate-700">{r.label}</span>
						<span className="shrink-0 font-black text-slate-950">
							{r.display}
							{r.detail ? (
								<span className="ml-1.5 text-xs font-semibold text-slate-400">
									{r.detail}
								</span>
							) : null}
						</span>
					</div>
					<div className="mt-1 h-2 rounded-full bg-slate-100">
						<div
							className="h-2 rounded-full"
							style={{
								width: `${r.value > 0 ? Math.max(2, (r.value / max) * 100) : 0}%`,
								backgroundColor: r.color ?? EMERALD,
							}}
						/>
					</div>
				</li>
			))}
		</ul>
	);
}

/** A share-of-whole donut, labelled directly beside it (never colour alone). */
export function Donut({
	slices,
	centerLabel,
	centerValue,
	format,
}: {
	slices: Array<{ key: string; label: string; value: number; color: string }>;
	centerLabel: string;
	centerValue: string;
	format: (v: number) => string;
}) {
	const total = slices.reduce((t, s) => t + s.value, 0);
	if (total === 0) return <Empty height={180}>Nothing recorded yet.</Empty>;
	return (
		<div className="@container">
			<div className="grid items-center gap-4 @[22rem]:grid-cols-[160px_minmax(0,1fr)]">
				<div className="relative mx-auto size-40">
					<ResponsiveContainer width="100%" height="100%">
						<PieChart>
							<Pie
								data={slices}
								dataKey="value"
								nameKey="label"
								innerRadius={52}
								outerRadius={76}
								paddingAngle={slices.length > 1 ? 2 : 0}
								stroke="#ffffff"
								strokeWidth={2}
								isAnimationActive={false}
							>
								{slices.map((s) => (
									<Cell key={s.key} fill={s.color} />
								))}
							</Pie>
							<Tooltip
								contentStyle={tooltipStyle}
								formatter={(v, n) => [format(Number(v)), String(n)]}
							/>
						</PieChart>
					</ResponsiveContainer>
					<div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
						<div>
							<p className="text-[10px] font-bold text-slate-500 uppercase">
								{centerLabel}
							</p>
							<p className="text-sm font-black text-slate-950">{centerValue}</p>
						</div>
					</div>
				</div>
				<ul className="grid gap-2">
					{slices
						.filter((s) => s.value > 0)
						.sort((a, b) => b.value - a.value)
						.map((s) => (
							<li
								key={s.key}
								className="grid grid-cols-[0.75rem_minmax(0,1fr)_auto] items-center gap-2 text-sm"
							>
								<span
									className="size-3 rounded-[3px]"
									style={{ backgroundColor: s.color }}
								/>
								<span className="truncate font-bold text-slate-700">
									{s.label}
								</span>
								<span className="text-right font-black text-slate-950">
									{format(s.value)}
									<span className="ml-1.5 text-xs font-semibold text-slate-400">
										{Math.round((s.value / total) * 100)}%
									</span>
								</span>
							</li>
						))}
				</ul>
			</div>
		</div>
	);
}

/** Sequential single-hue ramp for the heatmap (light → dark emerald). */
const HEAT = [
	"#f1f5f9",
	"#d1fae5",
	"#a7f3d0",
	"#6ee7b7",
	"#34d399",
	"#10b981",
	"#047857",
];

export function Heatmap({
	grid,
	unit = "order",
}: {
	grid: number[][];
	unit?: string;
}) {
	const max = Math.max(0, ...grid.flat());
	const level = (n: number) =>
		n === 0 || max === 0
			? 0
			: Math.max(1, Math.ceil((n / max) * (HEAT.length - 1)));
	let peak = { dow: 0, hour: 0, n: 0 };
	for (const [dow, row] of grid.entries()) {
		for (const [hour, n] of row.entries()) {
			if (n > peak.n) peak = { dow, hour, n };
		}
	}
	const plural = (n: number) => `${n} ${unit}${n === 1 ? "" : "s"}`;

	if (max === 0)
		return <Empty height={180}>Nothing to show for this period yet.</Empty>;

	return (
		<div>
			<p className="mb-3 text-sm font-medium text-slate-600">
				Busiest:{" "}
				<span className="font-black text-slate-950">
					{DAYS[peak.dow]} around {hourLabel(peak.hour)}
				</span>{" "}
				({plural(peak.n)})
			</p>
			<div className="overflow-x-auto">
				<div className="grid min-w-[560px] grid-cols-[2.5rem_repeat(24,minmax(0,1fr))] gap-[2px]">
					<span />
					{Array.from({ length: 24 }, (_, h) => (
						<span
							// biome-ignore lint/suspicious/noArrayIndexKey: fixed 24-hour axis
							key={h}
							className="text-center text-[9px] font-semibold text-slate-400"
						>
							{h % 3 === 0 ? hourLabel(h) : ""}
						</span>
					))}
					{WEEK_ORDER.map((dow) => (
						<div key={dow} className="contents">
							<span className="self-center text-[11px] font-bold text-slate-500">
								{DAYS[dow]}
							</span>
							{grid[dow].map((n, hour) => (
								<span
									// biome-ignore lint/suspicious/noArrayIndexKey: fixed 24-hour grid
									key={hour}
									title={`${DAYS[dow]} ${hourLabel(hour)}: ${plural(n)}`}
									className="aspect-square rounded-[3px]"
									style={{ backgroundColor: HEAT[level(n)] }}
								/>
							))}
						</div>
					))}
				</div>
			</div>
			<div className="mt-3 flex items-center justify-end gap-1 text-[10px] font-semibold text-slate-400">
				Fewer
				{HEAT.map((c) => (
					<span
						key={c}
						className="size-2.5 rounded-[2px]"
						style={{ backgroundColor: c }}
					/>
				))}
				More
			</div>
		</div>
	);
}
