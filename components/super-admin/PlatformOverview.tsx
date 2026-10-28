import {
	AlertOctagon,
	AlertTriangle,
	ArrowDownRight,
	ArrowUpRight,
	CheckCircle2,
	ChevronRight,
	Clock,
	CreditCard,
	Info,
	type LucideIcon,
	Shield,
	Store,
} from "lucide-react";
import Link from "next/link";
import type {
	AttentionItem,
	DailyPoint,
	Kpi,
	PlatformOverview,
} from "@/lib/platform-overview";
import { formatChange } from "@/lib/restaurant-day";

const naira = new Intl.NumberFormat("en-NG", {
	style: "currency",
	currency: "NGN",
	maximumFractionDigits: 0,
});
const compactNaira = new Intl.NumberFormat("en-NG", {
	style: "currency",
	currency: "NGN",
	notation: "compact",
	maximumFractionDigits: 1,
});

function formatValue(value: number, format: Kpi["format"], compact = false) {
	if (format === "count") return value.toLocaleString();
	return compact && value >= 100_000
		? compactNaira.format(value)
		: naira.format(value);
}

function timeAgo(date: Date) {
	const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes} min ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours} h ago`;
	const days = Math.floor(hours / 24);
	return `${days} day${days === 1 ? "" : "s"} ago`;
}

const shortDate = (date: string) =>
	new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		timeZone: "UTC",
	});

const card =
	"min-w-0 rounded-2xl border border-slate-200/70 bg-white p-4 sm:p-5";

// ─── KPI tile with a 30-day sparkline ────────────────────────────

function Sparkline({
	series,
	format,
	label,
}: {
	series: DailyPoint[];
	format: Kpi["format"];
	label: string;
}) {
	const width = 160;
	const height = 40;
	const max = Math.max(1, ...series.map((p) => p.value));
	const step = series.length > 1 ? width / (series.length - 1) : width;
	const y = (v: number) => height - 2 - (v / max) * (height - 4);
	const points = series.map((p, i) => `${i * step},${y(p.value)}`).join(" ");
	const last = series[series.length - 1];

	return (
		<svg
			viewBox={`0 0 ${width} ${height}`}
			preserveAspectRatio="none"
			className="mt-3 h-10 w-full overflow-visible"
			role="img"
			aria-label={`${label}, daily for the last 30 days`}
		>
			<line
				x1={0}
				x2={width}
				y1={height - 2}
				y2={height - 2}
				className="stroke-slate-200"
				strokeWidth={1}
				vectorEffect="non-scaling-stroke"
			/>
			<polyline
				points={points}
				fill="none"
				className="stroke-emerald-600"
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
				vectorEffect="non-scaling-stroke"
			/>
			{last ? (
				<circle
					cx={(series.length - 1) * step}
					cy={y(last.value)}
					r={3}
					className="fill-emerald-600 stroke-white"
					strokeWidth={2}
					vectorEffect="non-scaling-stroke"
				/>
			) : null}
			{/* Hover targets: one column per day, wider than the line itself. */}
			{series.map((p, i) => (
				<rect
					key={p.date}
					x={i * step - step / 2}
					y={0}
					width={step}
					height={height}
					fill="transparent"
				>
					{/* One string: React 19 requires a <title>'s children to be a single
					    text node, or server and client output differ. */}
					<title>{`${shortDate(p.date)}: ${formatValue(p.value, format)}`}</title>
				</rect>
			))}
		</svg>
	);
}

export function KpiTile({ kpi }: { kpi: Kpi }) {
	const changeText = formatChange(kpi.change);
	const up = (kpi.change ?? 0) > 0;
	const down = (kpi.change ?? 0) < 0;
	const body = (
		<>
			<p className="text-xs font-bold text-slate-500">{kpi.label}</p>
			<p className="mt-1 truncate text-2xl font-black tracking-tight text-slate-950">
				{formatValue(kpi.value, kpi.format, true)}
			</p>
			<p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs font-semibold text-slate-500">
				{changeText ? (
					<span
						className={`inline-flex items-center gap-0.5 font-black ${
							up ? "text-emerald-700" : down ? "text-red-600" : "text-slate-600"
						}`}
					>
						{up ? (
							<ArrowUpRight className="size-3.5" aria-hidden="true" />
						) : down ? (
							<ArrowDownRight className="size-3.5" aria-hidden="true" />
						) : null}
						{changeText}
					</span>
				) : kpi.value > 0 ? (
					<span className="font-black text-slate-600">New</span>
				) : null}
				<span>
					vs previous 30 days ({formatValue(kpi.previous, kpi.format, true)})
				</span>
			</p>
			<Sparkline series={kpi.series} format={kpi.format} label={kpi.label} />
		</>
	);
	return kpi.href ? (
		<Link
			href={kpi.href}
			className={`${card} block transition-colors hover:border-emerald-300`}
		>
			{body}
		</Link>
	) : (
		<div className={card}>{body}</div>
	);
}

// ─── Needs attention ─────────────────────────────────────────────

const severityStyle: Record<
	AttentionItem["severity"],
	{ icon: LucideIcon; label: string; tone: string }
> = {
	critical: {
		icon: AlertOctagon,
		label: "Urgent",
		tone: "bg-red-50 text-red-700",
	},
	warning: {
		icon: AlertTriangle,
		label: "Needs action",
		tone: "bg-amber-50 text-amber-800",
	},
	info: { icon: Info, label: "FYI", tone: "bg-slate-100 text-slate-600" },
};

export function AttentionPanel({ items }: { items: AttentionItem[] }) {
	if (items.length === 0) {
		return (
			<div className={`${card} flex items-center gap-3`}>
				<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
					<CheckCircle2 className="size-5" aria-hidden="true" />
				</span>
				<div>
					<p className="font-black text-slate-950">All clear</p>
					<p className="text-sm font-medium text-slate-500">
						Nothing needs your attention right now.
					</p>
				</div>
			</div>
		);
	}
	return (
		<section className={card} aria-labelledby="attention-heading">
			<h2
				id="attention-heading"
				className="text-base font-black text-slate-950"
			>
				Needs attention
			</h2>
			<ul className="mt-3 grid gap-2 lg:grid-cols-2">
				{items.map((item) => {
					const style = severityStyle[item.severity];
					const Icon = style.icon;
					return (
						<li key={item.key}>
							<Link
								href={item.href}
								className="flex h-full items-start gap-3 rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50"
							>
								<span
									className={`grid size-9 shrink-0 place-items-center rounded-lg ${style.tone}`}
								>
									<Icon className="size-4" aria-hidden="true" />
								</span>
								<span className="min-w-0 flex-1">
									<span className="flex flex-wrap items-center gap-2">
										<span className="text-sm font-black text-slate-950">
											{item.count.toLocaleString()} · {item.title}
										</span>
										<span
											className={`rounded-md px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${style.tone}`}
										>
											{style.label}
										</span>
									</span>
									<span className="mt-0.5 block text-xs font-medium leading-5 text-slate-500">
										{item.detail}
									</span>
								</span>
								<ChevronRight
									className="mt-2 size-4 shrink-0 text-slate-400"
									aria-hidden="true"
								/>
							</Link>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

// ─── Subscriptions snapshot & plan mix ───────────────────────────

export function SubscriptionSnapshot({
	data,
}: {
	data: Pick<
		PlatformOverview,
		"mrr" | "payingRestaurants" | "stateCounts" | "planMix" | "adminSuspended"
	>;
}) {
	const totalPlans = data.planMix.reduce((t, p) => t + p.count, 0);
	const maxPlan = Math.max(1, ...data.planMix.map((p) => p.count));
	const states = [
		{
			label: "Expiring ≤ 7 days",
			value: data.stateCounts.EXPIRING_SOON,
			state: "EXPIRING_SOON",
		},
		{ label: "In grace", value: data.stateCounts.GRACE, state: "GRACE" },
		{
			label: "Lapsed",
			value: data.stateCounts.LAPSED,
			state: "LAPSED",
		},
	];
	return (
		<section className={card} aria-labelledby="subs-heading">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h2 id="subs-heading" className="text-base font-black text-slate-950">
						Subscriptions
					</h2>
					<p className="text-xs font-medium text-slate-500">Right now</p>
				</div>
				<Link
					href="/super-admin/subscriptions"
					className="text-xs font-black text-emerald-700"
				>
					View all
				</Link>
			</div>
			<div className="mt-4 grid grid-cols-2 gap-3">
				<div>
					<p className="text-xs font-bold text-slate-500">MRR (estimated)</p>
					<p className="text-xl font-black text-slate-950">
						{naira.format(data.mrr)}
					</p>
				</div>
				<div>
					<p className="text-xs font-bold text-slate-500">Paying restaurants</p>
					<p className="text-xl font-black text-slate-950">
						{data.payingRestaurants.toLocaleString()}
					</p>
				</div>
			</div>
			<div className="mt-4 grid grid-cols-3 gap-2">
				{states.map((s) => (
					<Link
						key={s.state}
						href={`/super-admin/subscriptions?state=${s.state}`}
						className="rounded-xl bg-slate-50 p-2.5 transition-colors hover:bg-slate-100"
					>
						<p className="text-lg font-black text-slate-950">{s.value}</p>
						<p className="text-[11px] font-bold leading-4 text-slate-500">
							{s.label}
						</p>
					</Link>
				))}
			</div>
			<h3 className="mt-5 text-xs font-black uppercase tracking-wide text-slate-500">
				Restaurants by plan
			</h3>
			{data.planMix.length > 0 ? (
				<ul className="mt-2 grid gap-2">
					{data.planMix.map((plan) => (
						<li
							key={plan.name}
							className="grid grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-3"
						>
							<span className="truncate text-sm font-bold text-slate-700">
								{plan.name}
							</span>
							<span className="h-2 rounded-full bg-slate-100">
								<span
									className="block h-2 rounded-full bg-emerald-600"
									style={{
										width: `${Math.max(4, (plan.count / maxPlan) * 100)}%`,
									}}
								/>
							</span>
							<span className="text-sm font-black text-slate-950">
								{plan.count}
								<span className="ml-1 text-xs font-semibold text-slate-400">
									{totalPlans ? Math.round((plan.count / totalPlans) * 100) : 0}
									%
								</span>
							</span>
						</li>
					))}
				</ul>
			) : (
				<p className="mt-2 text-sm font-medium text-slate-500">
					No subscriptions yet.
				</p>
			)}
		</section>
	);
}

// ─── Onboarding funnel ───────────────────────────────────────────

export function OnboardingFunnel({
	steps,
}: {
	steps: PlatformOverview["funnel"];
}) {
	const top = Math.max(1, steps[0]?.count ?? 0);
	return (
		<section className={card} aria-labelledby="funnel-heading">
			<h2 id="funnel-heading" className="text-base font-black text-slate-950">
				Onboarding funnel
			</h2>
			<p className="text-xs font-medium text-slate-500">
				Owners who signed up in the last 90 days
			</p>
			<ol className="mt-4 grid gap-2.5">
				{steps.map((step, i) => {
					const share = (step.count / top) * 100;
					const prev = i > 0 ? steps[i - 1].count : null;
					const drop =
						prev && prev > 0
							? Math.round(((prev - step.count) / prev) * 100)
							: null;
					return (
						<li key={step.label}>
							<div className="flex items-baseline justify-between gap-2 text-sm">
								<span className="font-bold text-slate-700">{step.label}</span>
								<span className="font-black text-slate-950">
									{step.count.toLocaleString()}
									<span className="ml-1.5 text-xs font-semibold text-slate-400">
										{Math.round(share)}%
									</span>
								</span>
							</div>
							<div
								className="mt-1 h-2.5 rounded-full bg-slate-100"
								title={
									drop !== null && drop > 0
										? `${drop}% didn't continue from "${steps[i - 1].label}"`
										: undefined
								}
							>
								<div
									className="h-2.5 rounded-full bg-emerald-600"
									style={{
										width: `${step.count > 0 ? Math.max(2, share) : 0}%`,
									}}
								/>
							</div>
							{drop !== null && drop >= 30 ? (
								<p className="mt-0.5 text-[11px] font-bold text-amber-700">
									{drop}% drop from the step before
								</p>
							) : null}
						</li>
					);
				})}
			</ol>
		</section>
	);
}

// ─── Restaurants ─────────────────────────────────────────────────

export function RestaurantLists({
	top,
	quiet,
}: {
	top: PlatformOverview["topRestaurants"];
	quiet: PlatformOverview["quietRestaurants"];
}) {
	return (
		<section className={card} aria-labelledby="restaurants-heading">
			<h2
				id="restaurants-heading"
				className="text-base font-black text-slate-950"
			>
				Restaurants
			</h2>
			<h3 className="mt-3 text-xs font-black uppercase tracking-wide text-slate-500">
				Top by order value · 30 days
			</h3>
			{top.length > 0 ? (
				<ol className="mt-2 grid gap-1">
					{top.map((r, i) => (
						<li key={r.id}>
							<Link
								href={`/super-admin/restaurants/${r.id}`}
								className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-1 py-1.5 hover:bg-slate-50"
							>
								<span className="text-xs font-black text-slate-400">
									{i + 1}
								</span>
								<span className="truncate text-sm font-bold text-slate-800">
									{r.name}
								</span>
								<span className="text-right text-sm font-black text-slate-950">
									{compactNaira.format(r.gmv)}
									<span className="block text-[11px] font-semibold text-slate-400">
										{r.orders} orders
									</span>
								</span>
							</Link>
						</li>
					))}
				</ol>
			) : (
				<p className="mt-2 text-sm font-medium text-slate-500">
					No paid orders yet.
				</p>
			)}
			<h3 className="mt-5 text-xs font-black uppercase tracking-wide text-slate-500">
				Going quiet
			</h3>
			<p className="text-[11px] font-medium text-slate-400">
				Had orders recently, none in the last 14 days
			</p>
			{quiet.length > 0 ? (
				<ul className="mt-2 grid gap-1">
					{quiet.map((r) => (
						<li key={r.id}>
							<Link
								href={`/super-admin/restaurants/${r.id}`}
								className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5 hover:bg-slate-50"
							>
								<span className="truncate text-sm font-bold text-slate-800">
									{r.name}
								</span>
								<span className="shrink-0 text-xs font-semibold text-amber-700">
									Last order {timeAgo(r.lastOrderAt)}
								</span>
							</Link>
						</li>
					))}
				</ul>
			) : (
				<p className="mt-2 text-sm font-medium text-slate-500">
					None. Every recently active restaurant is still taking orders.
				</p>
			)}
		</section>
	);
}

// ─── System health ───────────────────────────────────────────────

function HealthRow({
	ok,
	label,
	value,
}: {
	ok: boolean;
	label: string;
	value: string;
}) {
	return (
		<li className="flex items-center justify-between gap-3 py-2">
			<span className="flex min-w-0 items-center gap-2 text-sm font-bold text-slate-700">
				{ok ? (
					<CheckCircle2
						className="size-4 shrink-0 text-emerald-600"
						aria-hidden="true"
					/>
				) : (
					<AlertTriangle
						className="size-4 shrink-0 text-amber-600"
						aria-hidden="true"
					/>
				)}
				<span className="truncate">{label}</span>
				<span className="sr-only">{ok ? "OK" : "Needs attention"}</span>
			</span>
			<span
				className={`shrink-0 text-xs font-black ${ok ? "text-slate-500" : "text-amber-700"}`}
			>
				{value}
			</span>
		</li>
	);
}

export function SystemHealth({
	health,
}: {
	health: PlatformOverview["health"];
}) {
	return (
		<section
			id="system-health"
			className={card}
			aria-labelledby="health-heading"
		>
			<h2
				id="health-heading"
				className="flex items-center gap-2 text-base font-black text-slate-950"
			>
				<Shield className="size-4 text-slate-500" aria-hidden="true" />
				System health
			</h2>
			<ul className="mt-2 divide-y divide-slate-100">
				{health.cronRuns.map((run) => (
					<HealthRow
						key={run.name}
						ok={!run.late}
						label={`${run.label} job`}
						value={
							run.lastRunAt
								? `Ran ${timeAgo(run.lastRunAt)}`
								: "No run recorded"
						}
					/>
				))}
				<HealthRow
					ok={health.overdueMessages === 0}
					label="Message queue"
					value={
						health.overdueMessages === 0
							? health.lastMessageSentAt
								? `Last sent ${timeAgo(health.lastMessageSentAt)}`
								: "Empty"
							: `${health.overdueMessages} overdue`
					}
				/>
				<HealthRow
					ok={health.deadMessages === 0}
					label="Failed messages (7 days)"
					value={String(health.deadMessages)}
				/>
				<HealthRow
					ok={health.stuckAttempts === 0}
					label="Payment checks past 24 h"
					value={String(health.stuckAttempts)}
				/>
				<HealthRow
					ok={!health.maintenanceMode}
					label="Maintenance mode"
					value={health.maintenanceMode ? "On" : "Off"}
				/>
			</ul>
			<p className="mt-2 text-[11px] font-medium text-slate-400">
				Job times are recorded from this release on. &ldquo;No run
				recorded&rdquo; right after deploying is expected until each job runs
				once.
			</p>
		</section>
	);
}

// ─── Activity ────────────────────────────────────────────────────

const activityIcon: Record<
	PlatformOverview["recentActivity"][number]["kind"],
	{ icon: LucideIcon; tone: string }
> = {
	restaurant: { icon: Store, tone: "bg-emerald-50 text-emerald-700" },
	payment: { icon: CreditCard, tone: "bg-blue-50 text-blue-700" },
	admin: { icon: Shield, tone: "bg-slate-100 text-slate-600" },
};

export function ActivityFeed({
	items,
}: {
	items: PlatformOverview["recentActivity"];
}) {
	return (
		<section className={card} aria-labelledby="activity-heading">
			<div className="flex items-center justify-between gap-3">
				<h2
					id="activity-heading"
					className="text-base font-black text-slate-950"
				>
					Recent activity
				</h2>
				<Link
					href="/super-admin/audit-logs"
					className="text-xs font-black text-emerald-700"
				>
					Audit log
				</Link>
			</div>
			{items.length > 0 ? (
				<ul className="mt-3 grid gap-1">
					{items.map((item) => {
						const { icon: Icon, tone } = activityIcon[item.kind];
						return (
							<li key={`${item.kind}-${item.at.getTime()}-${item.label}`}>
								<Link
									href={item.href}
									className="flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-slate-50"
								>
									<span
										className={`grid size-8 shrink-0 place-items-center rounded-lg ${tone}`}
									>
										<Icon className="size-4" aria-hidden="true" />
									</span>
									<span className="min-w-0 flex-1 truncate text-sm font-bold text-slate-800">
										{item.label}
									</span>
									<span className="flex shrink-0 items-center gap-1 text-xs font-medium text-slate-400">
										<Clock className="size-3" aria-hidden="true" />
										{timeAgo(item.at)}
									</span>
								</Link>
							</li>
						);
					})}
				</ul>
			) : (
				<p className="mt-3 text-sm font-medium text-slate-500">
					No activity yet.
				</p>
			)}
		</section>
	);
}
