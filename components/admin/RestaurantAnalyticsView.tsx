"use client";

import {
	BarChart3,
	CalendarDays,
	CalendarRange,
	Download,
	LayoutDashboard,
	Lock,
	type LucideIcon,
	Settings2,
	Sparkles,
	Users,
	UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
	card,
	Kpi,
	shortDay,
	useFormat,
} from "@/components/admin/analytics/charts";
import {
	BookingsTab,
	CustomersTab,
	MenuTab,
	OperationsTab,
	OverviewTab,
	SalesTab,
} from "@/components/admin/analytics/tabs";
import {
	ANALYTICS_TABS,
	type AnalyticsRange,
	type AnalyticsTab,
	type RestaurantAnalytics,
} from "@/lib/restaurant-analytics";
import { cn } from "@/lib/utils";

/** "2026-03-01" plus n days, as a date key (calendar maths in UTC). */
function addDays(key: string, days: number) {
	const d = new Date(`${key}T12:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

const RANGES: { value: AnalyticsRange; label: string }[] = [
	{ value: 7, label: "7D" },
	{ value: 30, label: "30D" },
	{ value: 90, label: "90D" },
	{ value: 365, label: "12M" },
];

const TAB_META: Record<AnalyticsTab, { label: string; icon: LucideIcon }> = {
	overview: { label: "Overview", icon: LayoutDashboard },
	sales: { label: "Sales", icon: BarChart3 },
	menu: { label: "Menu", icon: UtensilsCrossed },
	customers: { label: "Customers", icon: Users },
	operations: { label: "Operations", icon: Settings2 },
	bookings: { label: "Bookings", icon: CalendarDays },
};

function Upgrade({ slug }: { slug: string }) {
	return (
		<section
			className={cn(
				card,
				"grid justify-items-center gap-3 border-emerald-200 bg-emerald-50/50 py-10 text-center",
			)}
		>
			<span className="grid size-12 place-items-center rounded-xl bg-white text-emerald-700">
				<Lock className="size-5" aria-hidden="true" />
			</span>
			<p className="text-lg font-black text-slate-950">
				See what sells, to whom, and when
			</p>
			<p className="max-w-md text-sm font-medium text-slate-600">
				Upgrade for sales by hour and weekday, order-value and basket
				histograms, menu performance, new and returning customers, the order
				funnel, staff and booking analytics.
			</p>
			<Link
				href={`/dashboard/${slug}/settings/plan`}
				className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-xs font-bold text-white hover:bg-emerald-800"
			>
				<Sparkles className="size-3.5" aria-hidden="true" />
				See plans
			</Link>
		</section>
	);
}

export function RestaurantAnalyticsView({
	data,
	currency,
	slug,
	initialTab,
}: {
	data: RestaurantAnalytics;
	currency: string;
	slug: string;
	initialTab: AnalyticsTab;
}) {
	const f = useFormat(currency);
	const [tab, setTab] = useState<AnalyticsTab>(initialTab);
	const [customOpen, setCustomOpen] = useState(data.period.custom);
	const { kpis, daily, advanced: adv } = data;

	// Kept in the URL so a refresh, a shared link or a range change stays on
	// the same tab, without a server round trip per tab.
	function selectTab(next: AnalyticsTab) {
		setTab(next);
		const url = new URL(window.location.href);
		url.searchParams.set("tab", next);
		window.history.replaceState(null, "", url);
	}

	const tabProps = adv ? { data, f, adv, slug } : null;

	const scanRateUsable =
		kpis.scans.value > 0 && kpis.orders.value <= kpis.scans.value;
	const period = data.period;
	const base = `/dashboard/${slug}/analytics`;
	const rangeQuery = period.custom
		? `from=${period.fromKey}&to=${period.toKey}`
		: `range=${period.days}`;
	// Quick picks inside the custom panel, in the restaurant's own days.
	const monthStart = `${period.today.slice(0, 8)}01`;
	const lastMonthEnd = addDays(monthStart, -1);
	const quickPicks = [
		{ label: "This month", from: monthStart, to: period.today },
		{
			label: "Last month",
			from: `${lastMonthEnd.slice(0, 8)}01`,
			to: lastMonthEnd,
		},
	];

	return (
		<div className="grid gap-4 md:gap-5">
			<div className="grid gap-3">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div>
						<h1 className="hidden text-2xl font-black text-slate-950 md:block">
							Analytics
						</h1>
						<p className="text-sm font-medium text-slate-500">
							{shortDay(data.from)} – {shortDay(data.to)}
							{period.custom ? ` (${period.days} days)` : ""}, compared with the{" "}
							{period.days === 365 && !period.custom
								? "12 months"
								: `${period.days} day${period.days === 1 ? "" : "s"}`}{" "}
							before
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-2">
						<a
							href={`${base}/export?${rangeQuery}`}
							className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
						>
							<Download className="size-3.5" aria-hidden="true" />
							Export CSV
						</a>
						<nav
							aria-label="Date range"
							className="flex rounded-xl border border-slate-200 bg-white p-1"
						>
							{RANGES.map((r) => {
								const active = !period.custom && period.days === r.value;
								return (
									<Link
										key={r.value}
										href={`${base}?range=${r.value}&tab=${tab}`}
										aria-current={active ? "page" : undefined}
										className={cn(
											"rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
											active
												? "bg-slate-900 text-white"
												: "text-slate-600 hover:bg-slate-100",
										)}
									>
										{r.label}
									</Link>
								);
							})}
							<button
								type="button"
								onClick={() => setCustomOpen((open) => !open)}
								aria-expanded={customOpen}
								aria-controls="custom-range"
								className={cn(
									"inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors",
									period.custom
										? "bg-slate-900 text-white"
										: "text-slate-600 hover:bg-slate-100",
								)}
							>
								<CalendarRange className="size-3.5" aria-hidden="true" />
								Custom
							</button>
						</nav>
					</div>
				</div>

				{customOpen ? (
					<form
						id="custom-range"
						action={base}
						className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-200 bg-white p-3"
					>
						<input type="hidden" name="tab" value={tab} />
						<label className="grid gap-1">
							<span className="text-[11px] font-bold text-slate-500">From</span>
							<input
								type="date"
								name="from"
								required
								defaultValue={period.fromKey}
								max={period.today}
								className="h-10 rounded-lg border border-slate-200 px-2.5 text-sm font-semibold text-slate-800"
							/>
						</label>
						<label className="grid gap-1">
							<span className="text-[11px] font-bold text-slate-500">To</span>
							<input
								type="date"
								name="to"
								required
								defaultValue={period.toKey}
								max={period.today}
								className="h-10 rounded-lg border border-slate-200 px-2.5 text-sm font-semibold text-slate-800"
							/>
						</label>
						<button
							type="submit"
							className="h-10 rounded-lg bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
						>
							Apply
						</button>
						<div className="flex flex-wrap gap-1.5 sm:ml-auto">
							{quickPicks.map((q) => (
								<Link
									key={q.label}
									href={`${base}?from=${q.from}&to=${q.to}&tab=${tab}`}
									className="inline-flex h-8 items-center rounded-full border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:bg-slate-50"
								>
									{q.label}
								</Link>
							))}
						</div>
						<p className="w-full text-[11px] font-medium text-slate-400">
							Up to two years. Compared with the same number of days just
							before.
						</p>
					</form>
				) : null}
			</div>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<Kpi
					label="Sales"
					value={f.compact(kpis.sales.value)}
					metric={kpis.sales}
					spark={daily.map((d) => d.sales)}
				/>
				<Kpi
					label="Orders"
					value={kpis.orders.value.toLocaleString()}
					metric={kpis.orders}
					spark={daily.map((d) => d.orders)}
				/>
				<Kpi
					label="Average order"
					value={f.money(kpis.averageOrder.value)}
					metric={kpis.averageOrder}
					spark={daily.map((d) => (d.orders ? d.sales / d.orders : 0))}
				/>
				<Kpi
					label="Scans that ordered"
					// Only meaningful when orders mostly came through a QR scan: orders
					// from shared links aren't scans, and a rate over 100% means nothing.
					value={scanRateUsable ? f.pct(kpis.conversion.value) : "—"}
					metric={scanRateUsable ? kpis.conversion : undefined}
					hint={
						kpis.scans.value > 0 && !scanRateUsable
							? `${kpis.scans.value.toLocaleString()} scans; most orders came from links`
							: `${kpis.scans.value.toLocaleString()} menu scans`
					}
				/>
			</div>

			<div
				role="tablist"
				aria-label="Analytics sections"
				className="-mx-4 flex gap-1 overflow-x-auto border-slate-200 border-b px-4 md:mx-0 md:px-0"
			>
				{ANALYTICS_TABS.map((key) => {
					const { label, icon: Icon } = TAB_META[key];
					const locked = !adv && key !== "overview";
					return (
						<button
							key={key}
							type="button"
							role="tab"
							aria-selected={tab === key}
							onClick={() => selectTab(key)}
							className={cn(
								"-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-bold transition-colors",
								tab === key
									? "border-emerald-600 text-slate-950"
									: "border-transparent text-slate-500 hover:text-slate-800",
							)}
						>
							<Icon className="size-4" aria-hidden="true" />
							{label}
							{locked ? (
								<Lock className="size-3 text-slate-400" aria-label="Upgrade" />
							) : null}
						</button>
					);
				})}
			</div>

			<div role="tabpanel" aria-label={TAB_META[tab].label}>
				{tab === "overview" ? (
					<OverviewTab data={data} f={f} adv={adv} />
				) : !tabProps ? (
					<Upgrade slug={slug} />
				) : tab === "sales" ? (
					<SalesTab {...tabProps} />
				) : tab === "menu" ? (
					<MenuTab {...tabProps} />
				) : tab === "customers" ? (
					<CustomersTab {...tabProps} />
				) : tab === "operations" ? (
					<OperationsTab {...tabProps} />
				) : (
					<BookingsTab {...tabProps} />
				)}
			</div>
		</div>
	);
}
