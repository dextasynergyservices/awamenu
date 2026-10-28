import { Search } from "lucide-react";
import Link from "next/link";
import { RestaurantTable } from "@/components/super-admin/RestaurantTable";
import { Pagination } from "@/components/ui/Pagination";
import { requireSuperAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { clampPage, pageInfo, parsePage, withQuery } from "@/lib/pagination";
import {
	getRestaurantConsole,
	HEALTH,
	parseRestaurantFilters,
	RESTAURANT_SORTS,
	type RestaurantHealth,
} from "@/lib/restaurant-admin";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const naira = (v: number) =>
	v >= 1_000_000
		? `₦${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
		: `₦${Math.round(v).toLocaleString()}`;

function Stat({
	label,
	value,
	hint,
}: {
	label: string;
	value: string;
	hint?: string;
}) {
	return (
		<div className="min-w-0 rounded-2xl border border-slate-200/70 bg-white p-4">
			<p className="truncate text-xs font-bold text-slate-500">{label}</p>
			<p className="mt-1 truncate text-xl font-black text-slate-950 sm:text-2xl">
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

export default async function SuperAdminRestaurantsPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | undefined>>;
}) {
	await requireSuperAdmin();
	const params = await searchParams;
	const filters = parseRestaurantFilters(params);
	const request = parsePage(params);
	const [data, plans] = await Promise.all([
		getRestaurantConsole(filters, request),
		db.plan.findMany({
			orderBy: { monthlyPrice: "asc" },
			select: { id: true, name: true },
		}),
	]);
	const page = clampPage(request, data.total);
	const rows =
		page.page === request.page
			? data.rows
			: data.allRows.slice(page.skip, page.skip + page.take);
	const href = (changes: Record<string, string | null>) =>
		withQuery("/super-admin/restaurants", params, { ...changes, page: null });
	const s = data.summary;
	const exportQuery = new URLSearchParams(
		Object.entries(params).filter(
			(e): e is [string, string] => typeof e[1] === "string",
		),
	).toString();

	return (
		<div className="grid gap-5">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
						Restaurants
					</h1>
					<p className="mt-1 max-w-2xl text-sm font-medium text-slate-600">
						How every restaurant is actually doing: sales, orders, last
						activity, menu and payment set-up. Health flags the ones that need a
						call.
					</p>
				</div>
				<a
					href={`/super-admin/restaurants/export${exportQuery ? `?${exportQuery}` : ""}`}
					className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
				>
					Export CSV
				</a>
			</div>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<Stat
					label="Restaurants"
					value={s.restaurants.toLocaleString()}
					hint={`${s.suspended} suspended by admin`}
				/>
				<Stat
					label="Active this week"
					value={s.active7.toLocaleString()}
					hint="ordered in the last 7 days"
				/>
				<Stat
					label="Need attention"
					value={s.needsAttention.toLocaleString()}
					hint="slowing, inactive, no orders or no menu"
				/>
				<Stat
					label="Sales, last 30 days"
					value={naira(s.sales30)}
					hint={`${s.orders30.toLocaleString()} orders across all restaurants`}
				/>
			</div>

			<nav
				aria-label="Health"
				className="-mx-4 flex gap-1.5 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0"
			>
				<Link
					href={href({ health: null })}
					aria-current={!filters.health ? "page" : undefined}
					className={cn(
						"inline-flex shrink-0 items-center rounded-full border px-3 py-1.5 text-xs font-bold",
						!filters.health
							? "border-slate-900 bg-slate-900 text-white"
							: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
					)}
				>
					All
				</Link>
				{(Object.keys(HEALTH) as RestaurantHealth[]).map((h) => (
					<Link
						key={h}
						href={href({ health: h })}
						title={HEALTH[h].hint}
						aria-current={filters.health === h ? "page" : undefined}
						className={cn(
							"inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold",
							filters.health === h
								? "border-slate-900 bg-slate-900 text-white"
								: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
						)}
					>
						{HEALTH[h].label}
						<span
							className={cn(
								"rounded-full px-1.5 text-[10px]",
								filters.health === h ? "bg-white/20" : "bg-slate-100",
							)}
						>
							{data.healthCounts[h]}
						</span>
					</Link>
				))}
			</nav>

			<form className="grid gap-2 rounded-2xl border border-slate-200/70 bg-white p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto]">
				{filters.health ? (
					<input type="hidden" name="health" value={filters.health} />
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
						placeholder="Name, slug, owner email or address"
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
					name="state"
					defaultValue={filters.state ?? ""}
					aria-label="Billing"
					className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium"
				>
					<option value="">Any billing</option>
					<option value="ACTIVE">Active</option>
					<option value="EXPIRING_SOON">Expiring soon</option>
					<option value="GRACE">In grace</option>
					<option value="LAPSED">Lapsed</option>
					<option value="FREE">Free</option>
					<option value="NONE">No plan</option>
				</select>
				<select
					name="commission"
					defaultValue={filters.commission ?? ""}
					aria-label="Commission"
					className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium"
				>
					<option value="">Any commission</option>
					<option value="custom">Custom rate</option>
					<option value="exempt">Exempt</option>
				</select>
				<select
					name="sort"
					defaultValue={filters.sort}
					aria-label="Sort"
					className="h-10 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium"
				>
					{Object.entries(RESTAURANT_SORTS).map(([key, label]) => (
						<option key={key} value={key}>
							Sort: {label}
						</option>
					))}
				</select>
				<div className="flex items-center gap-2">
					<label className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-slate-600">
						<input
							type="checkbox"
							name="suspended"
							value="1"
							defaultChecked={filters.suspended}
							className="size-4 rounded border-slate-300"
						/>
						Suspended
					</label>
					<button
						type="submit"
						className="h-10 flex-1 rounded-lg bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
					>
						Apply
					</button>
				</div>
			</form>

			<RestaurantTable
				rows={rows}
				platformPercent={data.platformRate}
				now={Date.now()}
			/>

			<Pagination
				info={pageInfo(page, data.total)}
				basePath="/super-admin/restaurants"
				query={params}
				noun="restaurants"
			/>
		</div>
	);
}
