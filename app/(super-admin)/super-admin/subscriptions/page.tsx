import {
	AlertTriangle,
	ArrowDownRight,
	ArrowUpRight,
	RefreshCw,
	Search,
} from "lucide-react";
import Link from "next/link";
import {
	AdminSuspendedBadge,
	BillingStateBadge,
} from "@/components/super-admin/BillingStateBadge";
import {
	type PlanOption,
	SubscriptionActions,
} from "@/components/super-admin/SubscriptionActions";
import { Pagination } from "@/components/ui/Pagination";
import { requireSuperAdmin } from "@/lib/auth-guards";
import { BILLING_INTERVAL_DETAILS, parseBillingInterval } from "@/lib/billing";
import {
	type BillingState,
	billingStateOf,
	daysLeft as daysLeftIn,
	isAutoRenewing,
	subscriptionPrice,
} from "@/lib/billing-state";
import { db } from "@/lib/db";
import { clampPage, pageInfo, parsePage, withQuery } from "@/lib/pagination";
import {
	getSubscriptionMetrics,
	parseSubscriptionFilters,
	SUBSCRIPTION_SORTS,
	subscriptionRowSelect,
	subscriptionWhere,
} from "@/lib/subscription-admin";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LIST_STATES: BillingState[] = [
	"ACTIVE",
	"EXPIRING_SOON",
	"GRACE",
	"LAPSED",
	"FREE",
];
const STATE_LABEL: Record<BillingState, string> = {
	ACTIVE: "Active",
	EXPIRING_SOON: "Expiring ≤ 7 days",
	GRACE: "In grace",
	LAPSED: "Lapsed",
	FREE: "Free",
	NONE: "No plan",
};

const naira = (v: number) => `₦${Math.round(v).toLocaleString()}`;
const compact = (v: number) =>
	v >= 1_000_000
		? `₦${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
		: v >= 10_000
			? `₦${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`
			: naira(v);
const day = (d: Date) =>
	new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(d);

function remaining(days: number, state: BillingState) {
	if (state === "FREE") return "No expiry";
	if (state === "LAPSED") return `Read-only for ${Math.abs(days) - 3} days`;
	if (days > 1) return `${days} days left`;
	if (days === 1) return "1 day left";
	if (days === 0) return "Ends today";
	return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} into grace`;
}

function Metric({
	label,
	value,
	hint,
	tone,
}: {
	label: string;
	value: string;
	hint?: React.ReactNode;
	tone?: "warn" | "bad";
}) {
	return (
		<div className="min-w-0 rounded-2xl border border-slate-200/70 bg-white p-4">
			<p className="truncate text-xs font-bold text-slate-500">{label}</p>
			<p
				className={cn(
					"mt-1 truncate text-xl font-black tracking-tight sm:text-2xl",
					tone === "bad"
						? "text-red-600"
						: tone === "warn"
							? "text-amber-700"
							: "text-slate-950",
				)}
			>
				{value}
			</p>
			{hint ? (
				<p className="mt-1 truncate text-xs font-medium text-slate-500">
					{hint}
				</p>
			) : null}
		</div>
	);
}

export default async function SuperAdminSubscriptionsPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | undefined>>;
}) {
	await requireSuperAdmin();
	const params = await searchParams;
	const filters = parseSubscriptionFilters(params, LIST_STATES);
	const now = new Date();
	const where = subscriptionWhere(filters, now);

	const [metrics, total, plans, stateCounts] = await Promise.all([
		getSubscriptionMetrics(now),
		db.subscription.count({ where }),
		db.plan.findMany({
			orderBy: { monthlyPrice: "asc" },
			select: {
				id: true,
				name: true,
				monthlyPrice: true,
				quarterlyPrice: true,
				yearlyPrice: true,
			},
		}),
		// Counts per state with the other filters applied, for the chips.
		Promise.all(
			LIST_STATES.map((state) =>
				db.subscription.count({
					where: subscriptionWhere({ ...filters, state }, now),
				}),
			),
		),
	]);
	const page = clampPage(parsePage(params), total);
	const rows = await db.subscription.findMany({
		where,
		orderBy: SUBSCRIPTION_SORTS[filters.sort].orderBy,
		skip: page.skip,
		take: page.take,
		select: subscriptionRowSelect,
	});

	const planOptions: PlanOption[] = plans.map((p) => ({
		id: p.id,
		name: p.name,
		monthly: Number(p.monthlyPrice),
		quarterly: Number(p.quarterlyPrice),
		yearly: Number(p.yearlyPrice),
	}));
	const href = (changes: Record<string, string | null>) =>
		withQuery("/super-admin/subscriptions", params, { ...changes, page: null });
	const collected = metrics.collected;
	const maxPlanMrr = Math.max(1, ...metrics.planMix.map((p) => p.mrr));
	const hasFilters =
		filters.planId || filters.interval || filters.autoRenew || filters.q;

	return (
		<div className="grid gap-5">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
						Subscriptions
					</h1>
					<p className="mt-1 text-sm font-medium text-slate-600">
						Recurring revenue, renewals and every restaurant&apos;s billing
						lifecycle. Open a row&apos;s ⋯ menu to extend, record a payment,
						change plan or nudge the owner.
					</p>
				</div>
				<a
					href={`/super-admin/subscriptions/export?${new URLSearchParams(
						Object.entries(params).filter(
							(e): e is [string, string] => typeof e[1] === "string",
						),
					).toString()}`}
					className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
				>
					Export CSV
				</a>
			</div>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<Metric
					label="Monthly recurring revenue"
					value={compact(metrics.mrr)}
					hint={`ARR ${compact(metrics.arr)} · ${metrics.paying} paying`}
				/>
				<Metric
					label="Collected, last 30 days"
					value={compact(collected.amount)}
					hint={
						collected.change === null ? (
							`${collected.count} payments`
						) : (
							<span
								className={cn(
									"inline-flex items-center gap-0.5 font-bold",
									collected.change >= 0 ? "text-emerald-700" : "text-red-600",
								)}
							>
								{collected.change >= 0 ? (
									<ArrowUpRight className="size-3.5" aria-hidden="true" />
								) : (
									<ArrowDownRight className="size-3.5" aria-hidden="true" />
								)}
								{Math.abs(Math.round(collected.change))}% vs previous 30 days
							</span>
						)
					}
				/>
				<Metric
					label="Renewals due, next 30 days"
					value={String(metrics.renewalsDue.count)}
					hint={`${compact(metrics.renewalsDue.amount)} expected`}
				/>
				<Metric
					label="Auto-renew coverage"
					value={`${Math.round(metrics.autoRenewRate * 100)}%`}
					hint="of paying restaurants have a card on file"
				/>
				<Metric
					label="At risk"
					value={String(metrics.atRisk)}
					tone={metrics.atRisk ? "warn" : undefined}
					hint="in grace, or expiring with no card"
				/>
				<Metric
					label="Churned, last 30 days"
					value={String(metrics.churned)}
					tone={metrics.churned ? "bad" : undefined}
					hint={`${Math.round(metrics.churnRate * 100)}% churn rate`}
				/>
				<Metric
					label="New paid, last 30 days"
					value={String(metrics.newPaid)}
					hint="first payments"
				/>
				<Metric
					label="On the free plan"
					value={String(metrics.byState.FREE)}
					hint={`of ${metrics.total} subscriptions`}
				/>
			</div>

			{metrics.planMix.length ? (
				<section className="rounded-2xl border border-slate-200/70 bg-white p-4">
					<h2 className="text-sm font-black text-slate-950">MRR by plan</h2>
					<ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
						{metrics.planMix.map((p) => (
							<li key={p.id}>
								<div className="flex items-baseline justify-between gap-2 text-sm">
									<span className="truncate font-bold text-slate-700">
										{p.name}
									</span>
									<span className="font-black text-slate-950">
										{compact(p.mrr)}
										<span className="ml-1.5 text-xs font-semibold text-slate-400">
											{p.count} paying
										</span>
									</span>
								</div>
								<div className="mt-1 h-2 rounded-full bg-slate-100">
									<div
										className="h-2 rounded-full bg-emerald-600"
										style={{
											width: `${Math.max(3, (p.mrr / maxPlanMrr) * 100)}%`,
										}}
									/>
								</div>
							</li>
						))}
					</ul>
				</section>
			) : null}

			<div className="grid gap-3">
				<nav
					aria-label="Lifecycle"
					className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0"
				>
					<Link
						href={href({ state: null })}
						aria-current={!filters.state ? "page" : undefined}
						className={cn(
							"inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-bold",
							!filters.state
								? "border-slate-900 bg-slate-900 text-white"
								: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
						)}
					>
						All
					</Link>
					{LIST_STATES.map((state, i) => (
						<Link
							key={state}
							href={href({ state })}
							aria-current={filters.state === state ? "page" : undefined}
							className={cn(
								"inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold",
								filters.state === state
									? "border-slate-900 bg-slate-900 text-white"
									: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
							)}
						>
							{STATE_LABEL[state]}
							<span
								className={cn(
									"rounded-full px-1.5 text-[10px]",
									filters.state === state ? "bg-white/20" : "bg-slate-100",
								)}
							>
								{stateCounts[i]}
							</span>
						</Link>
					))}
				</nav>

				<form className="grid gap-2 rounded-2xl border border-slate-200/70 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]">
					{filters.state ? (
						<input type="hidden" name="state" value={filters.state} />
					) : null}
					<label className="relative">
						<span className="sr-only">Search</span>
						<Search
							className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
							aria-hidden="true"
						/>
						<input
							type="search"
							name="q"
							defaultValue={filters.q ?? ""}
							placeholder="Restaurant, slug or owner"
							className="h-10 w-full rounded-lg border border-slate-200 pr-3 pl-9 text-base font-medium sm:text-sm"
						/>
					</label>
					<select
						name="plan"
						defaultValue={filters.planId ?? ""}
						aria-label="Plan"
						className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium"
					>
						<option value="">All plans</option>
						{plans.map((p) => (
							<option key={p.id} value={p.id}>
								{p.name}
							</option>
						))}
					</select>
					<select
						name="interval"
						defaultValue={filters.interval ?? ""}
						aria-label="Billing interval"
						className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium"
					>
						<option value="">Any billing</option>
						<option value="MONTHLY">Monthly</option>
						<option value="QUARTERLY">Quarterly</option>
						<option value="YEARLY">Yearly</option>
					</select>
					<select
						name="autorenew"
						defaultValue={filters.autoRenew ?? ""}
						aria-label="Auto-renew"
						className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium"
					>
						<option value="">Auto-renew: any</option>
						<option value="on">Auto-renew on</option>
						<option value="off">Auto-renew off</option>
					</select>
					<select
						name="sort"
						defaultValue={filters.sort}
						aria-label="Sort"
						className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium"
					>
						{Object.entries(SUBSCRIPTION_SORTS).map(([key, s]) => (
							<option key={key} value={key}>
								Sort: {s.label}
							</option>
						))}
					</select>
					<div className="flex gap-2">
						<button
							type="submit"
							className="h-10 flex-1 rounded-lg bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
						>
							Apply
						</button>
						{hasFilters ? (
							<Link
								href={withQuery(
									"/super-admin/subscriptions",
									{},
									{ state: filters.state },
								)}
								className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-bold text-slate-600 hover:bg-slate-100"
							>
								Clear
							</Link>
						) : null}
					</div>
				</form>
			</div>

			{rows.length === 0 ? (
				<p className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm font-bold text-slate-500">
					No subscriptions match.
				</p>
			) : (
				<div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
					<div className="overflow-x-auto">
						<table className="w-full min-w-[60rem] text-left text-sm">
							<thead className="bg-slate-50 text-[11px] font-black tracking-wide text-slate-500 uppercase">
								<tr>
									<th className="px-4 py-3">Restaurant</th>
									<th className="px-4 py-3">Plan</th>
									<th className="px-4 py-3">Renews / ends</th>
									<th className="px-4 py-3">Auto-renew</th>
									<th className="px-4 py-3">Status</th>
									<th className="w-12 px-2 py-3">
										<span className="sr-only">Actions</span>
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{rows.map((sub) => {
									const state = billingStateOf(sub, now.getTime());
									const price = subscriptionPrice(sub);
									const interval = parseBillingInterval(sub.billingInterval);
									const renewing = isAutoRenewing(sub);
									const days = daysLeftIn(sub.currentPeriodEnd, now.getTime());
									const name = sub.restaurant?.name ?? sub.user.email;
									return (
										<tr key={sub.id} className="align-top hover:bg-slate-50/60">
											<td className="px-4 py-3">
												<div className="flex flex-wrap items-center gap-1.5">
													{sub.restaurant ? (
														<Link
															href={`/super-admin/restaurants/${sub.restaurant.id}`}
															className="font-black text-slate-950 hover:text-emerald-700"
														>
															{sub.restaurant.name}
														</Link>
													) : (
														<span className="inline-flex items-center gap-1 font-black text-amber-700">
															<AlertTriangle
																className="size-3.5"
																aria-hidden="true"
															/>
															No restaurant yet
														</span>
													)}
													{sub.restaurant && !sub.restaurant.isActive ? (
														<AdminSuspendedBadge />
													) : null}
												</div>
												<p className="text-xs font-medium text-slate-500">
													{sub.user.name ? `${sub.user.name} · ` : ""}
													{sub.user.email}
												</p>
											</td>
											<td className="px-4 py-3">
												<p className="font-black text-slate-900">
													{sub.plan.name}
												</p>
												<p className="text-xs font-medium text-slate-500">
													{price > 0
														? `${naira(price)} ${BILLING_INTERVAL_DETAILS[interval].label.toLowerCase()}`
														: "Free"}
												</p>
											</td>
											<td className="px-4 py-3">
												{price > 0 ? (
													<>
														<p className="font-bold text-slate-800">
															{day(sub.currentPeriodEnd)}
														</p>
														<p
															className={cn(
																"text-xs font-semibold",
																state === "LAPSED"
																	? "text-red-600"
																	: state === "GRACE" ||
																			state === "EXPIRING_SOON"
																		? "text-amber-700"
																		: "text-slate-500",
															)}
														>
															{remaining(days, state)}
														</p>
													</>
												) : (
													<span className="text-slate-400">—</span>
												)}
											</td>
											<td className="px-4 py-3">
												{renewing ? (
													<span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700">
														<RefreshCw className="size-3" aria-hidden="true" />
														On
													</span>
												) : (
													<span className="text-xs font-bold text-slate-500">
														Off
													</span>
												)}
											</td>
											<td className="px-4 py-3">
												<BillingStateBadge state={state} />
												{sub.lastExpiryNoticeStage ? (
													<p className="mt-1 text-[11px] font-semibold text-slate-400">
														Last notice:{" "}
														{sub.lastExpiryNoticeStage.toLowerCase()}
													</p>
												) : null}
											</td>
											<td className="px-2 py-2 text-right">
												<SubscriptionActions
													plans={planOptions}
													target={{
														id: sub.id,
														label: name,
														restaurantId: sub.restaurant?.id ?? null,
														restaurantSlug: sub.restaurant?.slug ?? null,
														planId: sub.planId,
														interval,
														autoRenew: renewing,
														isFree: price <= 0,
														periodEnd: day(sub.currentPeriodEnd),
													}}
												/>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</div>
			)}

			<Pagination
				info={pageInfo(page, total)}
				basePath="/super-admin/subscriptions"
				query={params}
				noun="subscriptions"
			/>
		</div>
	);
}
