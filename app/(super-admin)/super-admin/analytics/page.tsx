import { Download } from "lucide-react";
import Link from "next/link";
import {
	PlatformAnalytics,
	type PlatformTab,
} from "@/components/super-admin/PlatformAnalytics";
import { requireSuperAdmin } from "@/lib/auth-guards";
import {
	getPlatformAnalytics,
	PLATFORM_RANGES,
	parsePlatformRange,
} from "@/lib/platform-analytics";
import { getTraffic } from "@/lib/posthog-query";
import { getSubscriptionMetrics } from "@/lib/subscription-admin";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS: PlatformTab[] = [
	"overview",
	"revenue",
	"growth",
	"marketplace",
	"traffic",
];

const longDay = (key: string) =>
	new Date(`${key}T12:00:00Z`).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	});

export default async function SuperAdminAnalyticsPage({
	searchParams,
}: {
	searchParams: Promise<{
		range?: string;
		from?: string;
		to?: string;
		tab?: string;
	}>;
}) {
	await requireSuperAdmin();
	const params = await searchParams;
	const tab: PlatformTab = TABS.includes(params.tab as PlatformTab)
		? (params.tab as PlatformTab)
		: "overview";
	const range = await parsePlatformRange(params);

	const [data, metrics, traffic] = await Promise.all([
		getPlatformAnalytics(range),
		getSubscriptionMetrics(),
		// Only when looking at it: PostHog's query API is rate-limited.
		tab === "traffic"
			? getTraffic(range.from, range.to)
			: Promise.resolve(null),
	]);

	// The range part of the URL, kept when switching tabs.
	const rangeQuery = range.custom
		? `from=${range.fromKey}&to=${range.toKey}`
		: `range=${range.key}`;

	return (
		<div className="grid gap-5">
			<div className="grid gap-3">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div>
						<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
							Analytics
						</h1>
						<p className="mt-1 text-sm font-medium text-slate-600">
							{longDay(range.fromKey)} – {longDay(range.toKey)} (Lagos time),
							compared with the {range.days} days before. Grouped by{" "}
							{range.granularity}.
						</p>
					</div>
					<a
						href={`/super-admin/analytics/export?${rangeQuery}`}
						className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
					>
						<Download className="size-3.5" aria-hidden="true" />
						Export CSV
					</a>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<nav
						aria-label="Date range"
						className="flex rounded-xl border border-slate-200 bg-white p-1"
					>
						{PLATFORM_RANGES.map((r) => (
							<Link
								key={r.key}
								href={`/super-admin/analytics?range=${r.key}&tab=${tab}`}
								aria-current={
									!range.custom && range.key === r.key ? "page" : undefined
								}
								className={cn(
									"rounded-lg px-3 py-1.5 text-xs font-bold",
									!range.custom && range.key === r.key
										? "bg-slate-900 text-white"
										: "text-slate-600 hover:bg-slate-100",
								)}
							>
								{r.label}
							</Link>
						))}
					</nav>
					<form className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1">
						<input type="hidden" name="tab" value={tab} />
						<label className="sr-only" htmlFor="from">
							From
						</label>
						<input
							id="from"
							type="date"
							name="from"
							required
							defaultValue={range.fromKey}
							max={range.toKey}
							className="h-8 rounded-lg px-2 text-xs font-bold text-slate-700"
						/>
						<span className="text-xs font-bold text-slate-400">to</span>
						<label className="sr-only" htmlFor="to">
							To
						</label>
						<input
							id="to"
							type="date"
							name="to"
							required
							defaultValue={range.toKey}
							className="h-8 rounded-lg px-2 text-xs font-bold text-slate-700"
						/>
						<button
							type="submit"
							className={cn(
								"h-8 rounded-lg px-3 text-xs font-bold",
								range.custom
									? "bg-slate-900 text-white"
									: "bg-slate-100 text-slate-700 hover:bg-slate-200",
							)}
						>
							{range.custom ? "Custom" : "Apply"}
						</button>
					</form>
				</div>
			</div>

			<PlatformAnalytics
				data={data}
				subs={{
					mrr: metrics.mrr,
					paying: metrics.paying,
					autoRenewRate: metrics.autoRenewRate,
					byState: metrics.byState,
					planMix: metrics.planMix,
				}}
				traffic={traffic}
				tab={tab}
				query={rangeQuery}
			/>
		</div>
	);
}
