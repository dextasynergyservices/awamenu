import { BadgeCheck, CircleAlert, CircleHelp } from "lucide-react";
import Link from "next/link";
import { RestaurantRowActions } from "@/components/super-admin/RestaurantRowActions";
import { requireSuperAdmin } from "@/lib/auth-guards";
import {
	commissionLabel,
	effectiveCommission,
	getPlatformCommissionPercent,
} from "@/lib/commission";
import { getCommissionAudit } from "@/lib/commission-audit";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const RANGES = [
	{ days: 30, label: "30 days" },
	{ days: 90, label: "90 days" },
	{ days: 365, label: "12 months" },
] as const;

const naira = (v: number) =>
	`₦${v.toLocaleString("en-NG", { maximumFractionDigits: v < 100 ? 2 : 0 })}`;
const day = (d: Date) =>
	new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(d);

function Card({
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
				<p className="mt-1 text-xs font-medium text-slate-500">{hint}</p>
			) : null}
		</div>
	);
}

export default async function SuperAdminCommissionPage({
	searchParams,
}: {
	searchParams: Promise<{ range?: string }>;
}) {
	await requireSuperAdmin();
	const { range } = await searchParams;
	const days = RANGES.find((r) => String(r.days) === range)?.days ?? 30;
	const from = new Date(Date.now() - days * 86_400_000);

	const [platformRate, audit, overrides] = await Promise.all([
		getPlatformCommissionPercent(),
		getCommissionAudit(from),
		db.restaurant.findMany({
			where: { commissionPercentOverride: { not: null } },
			orderBy: { commissionUpdatedAt: "desc" },
			select: {
				id: true,
				name: true,
				slug: true,
				isActive: true,
				commissionPercentOverride: true,
				commissionNote: true,
				commissionUpdatedAt: true,
				owner: { select: { email: true } },
			},
		}),
	]);
	const t = audit.totals;
	const unverifiable = t.payments - t.verifiable;

	return (
		<div className="grid gap-5">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
						Commission
					</h1>
					<p className="mt-1 max-w-2xl text-sm font-medium text-slate-600">
						AwaMenu Pay commission: the platform rate, the restaurants that
						differ from it, and proof it was collected, checked against the
						payment provider&apos;s own split for every payment.
					</p>
				</div>
				<nav
					aria-label="Period"
					className="flex rounded-xl border border-slate-200 bg-white p-1"
				>
					{RANGES.map((r) => (
						<Link
							key={r.days}
							href={`/super-admin/commission?range=${r.days}`}
							aria-current={days === r.days ? "page" : undefined}
							className={cn(
								"rounded-lg px-3 py-1.5 text-xs font-bold",
								days === r.days
									? "bg-slate-900 text-white"
									: "text-slate-600 hover:bg-slate-100",
							)}
						>
							{r.label}
						</Link>
					))}
				</nav>
			</div>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
				<Card
					label="Platform rate"
					value={`${platformRate}%`}
					hint={`${overrides.length} restaurant${overrides.length === 1 ? "" : "s"} on a custom or exempt rate`}
				/>
				<Card
					label="AwaMenu Pay volume"
					value={naira(t.gross)}
					hint={`${t.payments} payments`}
				/>
				<Card
					label="Commission expected"
					value={naira(t.expected)}
					hint="at the rate each charge was made"
				/>
				<Card
					label="Confirmed by provider"
					value={naira(t.received)}
					hint={`${t.verifiable} of ${t.payments} payments verifiable`}
				/>
			</div>

			<section
				className={cn(
					"flex items-start gap-3 rounded-2xl border p-4",
					t.mismatches
						? "border-red-200 bg-red-50"
						: t.payments
							? "border-emerald-200 bg-emerald-50"
							: "border-slate-200 bg-white",
				)}
			>
				{t.mismatches ? (
					<CircleAlert
						className="mt-0.5 size-5 shrink-0 text-red-600"
						aria-hidden="true"
					/>
				) : (
					<BadgeCheck
						className="mt-0.5 size-5 shrink-0 text-emerald-700"
						aria-hidden="true"
					/>
				)}
				<div className="text-sm font-medium text-slate-700">
					{t.payments === 0 ? (
						<p className="font-bold text-slate-900">
							No AwaMenu Pay payments in this period.
						</p>
					) : t.mismatches ? (
						<p>
							<span className="font-black text-red-700">
								{t.mismatches} payment{t.mismatches === 1 ? "" : "s"} where the
								provider&apos;s split differs from the expected commission
							</span>{" "}
							by more than ₦100 or 1%. Listed below; check the restaurant&apos;s
							subaccount on Paystack.
						</p>
					) : (
						<p>
							<span className="font-black text-emerald-800">
								Commission is being enforced.
							</span>{" "}
							Every verifiable payment matched the provider&apos;s split
							(difference {naira(Math.abs(t.received - t.expectedVerified))},
							from provider fee rounding).
						</p>
					)}
					{unverifiable > 0 ? (
						<p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
							<CircleHelp className="size-3.5" aria-hidden="true" />
							{unverifiable} payment{unverifiable === 1 ? "" : "s"} came through
							a provider that doesn&apos;t report its split, so{" "}
							{unverifiable === 1 ? "it" : "they"} can&apos;t be verified here.
						</p>
					) : null}
				</div>
			</section>

			<section className="rounded-2xl border border-slate-200/70 bg-white">
				<div className="flex flex-wrap items-center justify-between gap-2 border-slate-100 border-b p-4">
					<div>
						<h2 className="text-base font-black text-slate-950">
							Custom and exempt rates
						</h2>
						<p className="text-xs font-medium text-slate-500">
							Every other restaurant pays the platform rate ({platformRate}%).
							Set a rate from a restaurant&apos;s ⋯ menu on the Restaurants
							page.
						</p>
					</div>
					<Link
						href="/super-admin/restaurants"
						className="text-xs font-black text-emerald-700"
					>
						Go to Restaurants
					</Link>
				</div>
				{overrides.length === 0 ? (
					<p className="p-6 text-center text-sm font-medium text-slate-500">
						No restaurant has a custom rate. All pay {platformRate}%.
					</p>
				) : (
					<ul className="divide-y divide-slate-100">
						{overrides.map((r) => {
							const c = effectiveCommission(
								r.commissionPercentOverride,
								platformRate,
							);
							return (
								<li key={r.id} className="flex items-start gap-3 p-4">
									<div className="min-w-0 flex-1">
										<p className="flex flex-wrap items-center gap-2">
											<Link
												href={`/super-admin/restaurants/${r.id}`}
												className="font-black text-slate-950 hover:text-emerald-700"
											>
												{r.name}
											</Link>
											<span
												className={cn(
													"rounded-full px-2 py-0.5 text-[11px] font-black",
													c.kind === "exempt"
														? "bg-slate-100 text-slate-700"
														: "bg-violet-50 text-violet-700",
												)}
											>
												{commissionLabel(c)}
											</span>
										</p>
										{r.commissionNote ? (
											<p className="mt-0.5 text-sm font-medium text-slate-600">
												{r.commissionNote}
											</p>
										) : null}
										{r.commissionUpdatedAt ? (
											<p className="text-xs font-medium text-slate-400">
												Set {day(r.commissionUpdatedAt)}
											</p>
										) : null}
									</div>
									<RestaurantRowActions
										restaurant={{
											id: r.id,
											name: r.name,
											slug: r.slug,
											isActive: r.isActive,
											ownerEmail: r.owner.email,
										}}
										commission={{
											kind: c.kind,
											percent: c.percent,
											note: r.commissionNote,
										}}
										platformPercent={platformRate}
									/>
								</li>
							);
						})}
					</ul>
				)}
			</section>

			<section className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white">
				<div className="border-slate-100 border-b p-4">
					<h2 className="text-base font-black text-slate-950">By restaurant</h2>
					<p className="text-xs font-medium text-slate-500">
						Expected is the commission recorded at each charge&apos;s rate;
						confirmed is what the provider reports AwaMenu received.
					</p>
				</div>
				{audit.rows.length === 0 ? (
					<p className="p-6 text-center text-sm font-medium text-slate-500">
						No AwaMenu Pay payments in this period.
					</p>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full min-w-[46rem] text-left text-sm">
							<thead className="bg-slate-50 text-[11px] font-black tracking-wide text-slate-500 uppercase">
								<tr>
									<th className="px-4 py-3">Restaurant</th>
									<th className="px-4 py-3">Current rate</th>
									<th className="px-4 py-3 text-right">Volume</th>
									<th className="px-4 py-3 text-right">Expected</th>
									<th className="px-4 py-3 text-right">Confirmed</th>
									<th className="px-4 py-3">Check</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{audit.rows.map((r) => {
									const c = effectiveCommission(
										r.restaurant?.commissionPercentOverride,
										platformRate,
									);
									return (
										<tr key={r.restaurantId}>
											<td className="px-4 py-3">
												{r.restaurant ? (
													<Link
														href={`/super-admin/restaurants/${r.restaurantId}`}
														className="font-black text-slate-900 hover:text-emerald-700"
													>
														{r.restaurant.name}
													</Link>
												) : (
													<span className="font-bold text-slate-500">
														Deleted restaurant
													</span>
												)}
												<p className="text-xs font-medium text-slate-500">
													{r.payments} payments
												</p>
											</td>
											<td className="px-4 py-3 font-bold text-slate-700">
												{commissionLabel(c)}
											</td>
											<td className="px-4 py-3 text-right font-bold text-slate-900">
												{naira(r.gross)}
											</td>
											<td className="px-4 py-3 text-right font-bold text-slate-900">
												{naira(r.expected)}
											</td>
											<td className="px-4 py-3 text-right font-bold text-slate-900">
												{r.received === null ? "—" : naira(r.received)}
											</td>
											<td className="px-4 py-3">
												{r.mismatches ? (
													<span className="inline-flex items-center gap-1 text-xs font-black text-red-600">
														<CircleAlert
															className="size-3.5"
															aria-hidden="true"
														/>
														{r.mismatches} mismatch
														{r.mismatches === 1 ? "" : "es"}
													</span>
												) : r.verifiable ? (
													<span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700">
														<BadgeCheck
															className="size-3.5"
															aria-hidden="true"
														/>
														Verified
													</span>
												) : (
													<span className="text-xs font-bold text-slate-400">
														Not verifiable
													</span>
												)}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</section>

			{audit.mismatches.length ? (
				<section className="rounded-2xl border border-red-200 bg-white">
					<h2 className="border-red-100 border-b p-4 text-base font-black text-red-700">
						Mismatched payments
					</h2>
					<ul className="divide-y divide-slate-100">
						{audit.mismatches.map((m) => (
							<li
								key={m.id}
								className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"
							>
								<span>
									<span className="font-black text-slate-900">
										{m.restaurant?.name ?? "Deleted restaurant"}
									</span>{" "}
									<span className="text-slate-500">
										· order #{m.orderId.slice(-6).toUpperCase()} ·{" "}
										{day(m.createdAt)}
									</span>
								</span>
								<span className="font-bold text-slate-700">
									{naira(m.amount)} · expected {naira(m.expected)} · received{" "}
									{naira(m.received)}
								</span>
							</li>
						))}
					</ul>
				</section>
			) : null}
		</div>
	);
}
