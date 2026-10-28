import Link from "next/link";
import { UsersTable } from "@/components/super-admin/UsersTable";
import { Pagination } from "@/components/ui/Pagination";
import { pageInfo, parsePage } from "@/lib/pagination";
import {
	ACCOUNT_FILTERS,
	getAccounts,
	parseAccountFilter,
} from "@/lib/super-admin-accounts";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SuperAdminUsersPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | undefined>>;
}) {
	const params = await searchParams;
	const { q } = params;
	const filter = parseAccountFilter(params.filter);
	const page = parsePage(params);
	const { rows, total, counts, issueCount } = await getAccounts({
		q,
		filter,
		skip: page.skip,
		take: page.take,
	});
	const href = (key: string) => {
		const params = new URLSearchParams();
		if (q) params.set("q", q);
		if (key !== "all") params.set("filter", key);
		const qs = params.toString();
		return `/super-admin/users${qs ? `?${qs}` : ""}`;
	};

	return (
		<div className="grid gap-5">
			<div>
				<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
					Accounts
				</h1>
				<p className="mt-1 text-sm font-medium text-slate-600">
					Every restaurant owner with their restaurants, billing, onboarding and
					sign-in status in one place. Billing states match what the owner and
					their customers see.
				</p>
			</div>

			{issueCount > 0 ? (
				<p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
					{issueCount} account{issueCount === 1 ? " has" : "s have"} data
					problems, listed under the owner&apos;s name.
				</p>
			) : null}

			<form className="flex gap-2">
				{filter !== "all" ? (
					<input type="hidden" name="filter" value={filter} />
				) : null}
				<input
					type="search"
					name="q"
					defaultValue={q ?? ""}
					placeholder="Search name, email, restaurant or slug"
					className="h-11 w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 md:text-sm"
				/>
				<button
					type="submit"
					className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
				>
					Search
				</button>
			</form>

			<nav
				aria-label="Filter accounts"
				className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 md:mx-0 md:flex-wrap md:px-0"
			>
				{ACCOUNT_FILTERS.map((f) => (
					<Link
						key={f.key}
						href={href(f.key)}
						aria-current={filter === f.key ? "page" : undefined}
						className={cn(
							"inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black transition-colors",
							filter === f.key
								? "border-emerald-700 bg-emerald-700 text-white"
								: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
						)}
					>
						{f.label}
						<span
							className={cn(
								"rounded-full px-1.5 text-[10px]",
								filter === f.key ? "bg-white/20" : "bg-slate-100",
							)}
						>
							{counts[f.key]}
						</span>
					</Link>
				))}
			</nav>

			<UsersTable rows={rows} />
			<Pagination
				info={pageInfo(page, total)}
				basePath="/super-admin/users"
				query={params}
				noun="accounts"
			/>
		</div>
	);
}
