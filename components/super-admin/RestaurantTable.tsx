import { ArrowDownRight, ArrowUpRight, Star } from "lucide-react";
import Link from "next/link";
import {
	AdminSuspendedBadge,
	BillingStateBadge,
} from "@/components/super-admin/BillingStateBadge";
import { RestaurantRowActions } from "@/components/super-admin/RestaurantRowActions";
import { commissionLabel } from "@/lib/commission";
import { type ConsoleRow, HEALTH } from "@/lib/restaurant-admin";
import { cn } from "@/lib/utils";

const naira = (v: number) =>
	v >= 1_000_000
		? `₦${(v / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
		: v >= 10_000
			? `₦${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`
			: `₦${Math.round(v).toLocaleString()}`;

function ago(date: Date | null, now: number) {
	if (!date) return "Never";
	const days = Math.floor((now - date.getTime()) / 86_400_000);
	if (days <= 0) return "Today";
	if (days === 1) return "Yesterday";
	if (days < 30) return `${days} days ago`;
	return new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(date);
}

const TONE = {
	good: "bg-emerald-50 text-emerald-800 ring-emerald-200",
	warn: "bg-amber-50 text-amber-800 ring-amber-200",
	bad: "bg-red-50 text-red-700 ring-red-200",
	neutral: "bg-slate-100 text-slate-600 ring-slate-200",
} as const;

export function HealthBadge({ health }: { health: ConsoleRow["health"] }) {
	const h = HEALTH[health];
	return (
		<span
			title={h.hint}
			className={cn(
				"inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-black ring-1 ring-inset",
				TONE[h.tone],
			)}
		>
			{h.label}
		</span>
	);
}

function Trend({ now, before }: { now: number; before: number }) {
	if (before === 0) return null;
	const change = Math.round(((now - before) / before) * 100);
	if (change === 0) return null;
	const Icon = change > 0 ? ArrowUpRight : ArrowDownRight;
	return (
		<span
			className={cn(
				"inline-flex items-center text-[11px] font-bold",
				change > 0 ? "text-emerald-700" : "text-red-600",
			)}
		>
			<Icon className="size-3" aria-hidden="true" />
			{Math.abs(change)}%
		</span>
	);
}

const PAYMENTS = {
	online: { label: "Online", className: "text-emerald-700" },
	offline: { label: "Cash / transfer only", className: "text-amber-700" },
	none: { label: "None set up", className: "text-red-600" },
} as const;

function Logo({ row }: { row: ConsoleRow }) {
	return row.logoUrl ? (
		// biome-ignore lint/performance/noImgElement: tiny remote logos, any host
		<img
			src={row.logoUrl}
			alt=""
			className="size-9 shrink-0 rounded-lg object-cover"
		/>
	) : (
		<span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-sm font-black text-emerald-700">
			{row.name.charAt(0).toUpperCase()}
		</span>
	);
}

export function RestaurantTable({
	rows,
	platformPercent,
	now,
}: {
	rows: ConsoleRow[];
	platformPercent: number;
	now: number;
}) {
	if (rows.length === 0) {
		return (
			<div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm font-medium text-slate-500">
				No restaurants match.
			</div>
		);
	}
	const actions = (row: ConsoleRow) => (
		<RestaurantRowActions
			restaurant={{
				id: row.id,
				name: row.name,
				slug: row.slug,
				isActive: row.isActive,
				ownerEmail: row.owner.email,
			}}
			commission={{
				kind: row.commission.kind,
				percent: row.commission.percent,
				note: row.commissionNote,
			}}
			platformPercent={platformPercent}
		/>
	);

	return (
		<>
			<ul className="grid gap-2 md:hidden">
				{rows.map((row) => (
					<li
						key={row.id}
						className="rounded-2xl border border-slate-200/70 bg-white p-3"
					>
						<div className="flex items-start gap-3">
							<Logo row={row} />
							<Link
								href={`/super-admin/restaurants/${row.id}`}
								className="min-w-0 flex-1"
							>
								<p className="truncate text-sm font-black text-slate-900">
									{row.name}
								</p>
								<p className="truncate text-xs font-medium text-slate-500">
									{row.planName} · {row.owner.email}
								</p>
							</Link>
							{actions(row)}
						</div>
						<div className="mt-2 flex flex-wrap items-center gap-1.5">
							<HealthBadge health={row.health} />
							{!row.isActive ? <AdminSuspendedBadge /> : null}
							<BillingStateBadge state={row.billingState} />
						</div>
						<dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
							<div>
								<dt className="font-bold text-slate-500">Sales 30d</dt>
								<dd className="font-black text-slate-900">
									{naira(row.sales30)}
								</dd>
							</div>
							<div>
								<dt className="font-bold text-slate-500">Orders 30d</dt>
								<dd className="font-black text-slate-900">{row.orders30}</dd>
							</div>
							<div>
								<dt className="font-bold text-slate-500">Last order</dt>
								<dd className="font-black text-slate-900">
									{ago(row.lastOrderAt, now)}
								</dd>
							</div>
						</dl>
					</li>
				))}
			</ul>

			<div className="hidden overflow-hidden rounded-2xl border border-slate-200/70 bg-white md:block">
				<div className="overflow-x-auto">
					<table className="w-full min-w-[68rem] text-left text-sm">
						<thead className="bg-slate-50 text-[11px] font-black tracking-wide text-slate-500 uppercase">
							<tr>
								<th className="px-4 py-3">Restaurant</th>
								<th className="px-4 py-3">Health</th>
								<th className="px-4 py-3 text-right">Sales 30d</th>
								<th className="px-4 py-3 text-right">Orders 30d</th>
								<th className="px-4 py-3">Last order</th>
								<th className="px-4 py-3">Setup</th>
								<th className="px-4 py-3">Plan</th>
								<th className="w-12 px-2 py-3">
									<span className="sr-only">Actions</span>
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{rows.map((row) => (
								<tr key={row.id} className="align-top hover:bg-slate-50/60">
									<td className="px-4 py-3">
										<div className="flex items-start gap-3">
											<Logo row={row} />
											<div className="min-w-0">
												<div className="flex flex-wrap items-center gap-1.5">
													<Link
														href={`/super-admin/restaurants/${row.id}`}
														className="font-black text-slate-950 hover:text-emerald-700"
													>
														{row.name}
													</Link>
													{!row.isActive ? <AdminSuspendedBadge /> : null}
												</div>
												<p className="truncate text-xs font-medium text-slate-500">
													/{row.slug} · {row.owner.email}
												</p>
											</div>
										</div>
									</td>
									<td className="px-4 py-3">
										<HealthBadge health={row.health} />
									</td>
									<td className="px-4 py-3 text-right">
										<p className="font-black text-slate-900">
											{naira(row.sales30)}
										</p>
									</td>
									<td className="px-4 py-3 text-right">
										<p className="font-black text-slate-900">{row.orders30}</p>
										<Trend now={row.orders30} before={row.ordersPrev} />
									</td>
									<td className="px-4 py-3 font-semibold text-slate-600">
										{ago(row.lastOrderAt, now)}
									</td>
									<td className="px-4 py-3 text-xs">
										<p className="font-bold text-slate-700">
											{row.menuItems} dish{row.menuItems === 1 ? "" : "es"}
										</p>
										<p
											className={cn(
												"font-bold",
												PAYMENTS[row.payments].className,
											)}
										>
											{PAYMENTS[row.payments].label}
										</p>
										{row.rating ? (
											<p className="inline-flex items-center gap-0.5 font-bold text-slate-600">
												<Star
													className="size-3 fill-amber-400 text-amber-400"
													aria-hidden="true"
												/>
												{row.rating.toFixed(1)} ({row.ratingCount})
											</p>
										) : null}
									</td>
									<td className="px-4 py-3">
										<p className="font-bold text-slate-800">{row.planName}</p>
										<div className="mt-1 flex flex-wrap items-center gap-1">
											<BillingStateBadge state={row.billingState} />
										</div>
										{row.commission.kind !== "platform" ? (
											<p
												className="mt-1 text-[11px] font-black text-violet-700"
												title={row.commissionNote ?? undefined}
											>
												Commission: {commissionLabel(row.commission)}
											</p>
										) : null}
									</td>
									<td className="px-2 py-2 text-right">{actions(row)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</>
	);
}
