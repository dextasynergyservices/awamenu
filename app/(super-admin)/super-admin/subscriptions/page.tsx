import {
	AlertTriangle,
	BadgeCheck,
	CalendarClock,
	CircleSlash,
	RefreshCw,
	Wallet,
} from "lucide-react";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth-guards";
import { getPlanIntervalPrice, parseBillingInterval } from "@/lib/billing";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type LifecycleState =
	| "ACTIVE"
	| "EXPIRING_SOON"
	| "GRACE"
	| "SUSPENDED"
	| "FREE";

const DAY_MS = 1000 * 60 * 60 * 24;
const GRACE_DAYS = 3;

const stateStyles: Record<
	LifecycleState,
	{ label: string; className: string; icon: typeof BadgeCheck }
> = {
	ACTIVE: {
		label: "Active",
		className: "bg-emerald-100 text-emerald-800",
		icon: BadgeCheck,
	},
	EXPIRING_SOON: {
		label: "Expiring soon",
		className: "bg-amber-100 text-amber-800",
		icon: CalendarClock,
	},
	GRACE: {
		label: "In grace period",
		className: "bg-orange-100 text-orange-800",
		icon: AlertTriangle,
	},
	SUSPENDED: {
		label: "Suspended",
		className: "bg-red-100 text-red-800",
		icon: CircleSlash,
	},
	FREE: {
		label: "Free",
		className: "bg-slate-100 text-slate-600",
		icon: Wallet,
	},
};

function formatDate(date: Date) {
	return new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(date);
}

function describeRemaining(days: number, state: LifecycleState) {
	if (state === "FREE") return "No expiry";
	if (state === "SUSPENDED") return "Grace period elapsed";
	if (days > 1) return `${days} days left`;
	if (days === 1) return "1 day left";
	if (days === 0) return "Expires today";
	return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} into grace`;
}

export default async function SuperAdminSubscriptionsPage() {
	await requireSuperAdmin();

	const subscriptions = await db.subscription.findMany({
		orderBy: { currentPeriodEnd: "asc" },
		select: {
			id: true,
			status: true,
			billingInterval: true,
			currentPeriodStart: true,
			currentPeriodEnd: true,
			paystackSubscriptionCode: true,
			lastExpiryNoticeStage: true,
			user: { select: { name: true, email: true } },
			restaurant: { select: { name: true, slug: true, isActive: true } },
			plan: {
				select: {
					name: true,
					tier: true,
					monthlyPrice: true,
					quarterlyPrice: true,
					yearlyPrice: true,
				},
			},
		},
	});

	const now = Date.now();

	const rows = subscriptions.map((sub) => {
		const interval = parseBillingInterval(sub.billingInterval);
		const price = getPlanIntervalPrice(sub.plan, interval);
		const isPaid = price > 0;
		const daysLeft = Math.ceil((sub.currentPeriodEnd.getTime() - now) / DAY_MS);

		let state: LifecycleState;
		if (!isPaid) state = "FREE";
		else if (sub.restaurant && !sub.restaurant.isActive) state = "SUSPENDED";
		else if (daysLeft < -GRACE_DAYS) state = "SUSPENDED";
		else if (daysLeft < 0) state = "GRACE";
		else if (daysLeft <= 7) state = "EXPIRING_SOON";
		else state = "ACTIVE";

		return { sub, interval, price, isPaid, daysLeft, state };
	});

	const summary = {
		total: rows.length,
		paid: rows.filter((r) => r.isPaid).length,
		expiringSoon: rows.filter((r) => r.state === "EXPIRING_SOON").length,
		grace: rows.filter((r) => r.state === "GRACE").length,
		suspended: rows.filter((r) => r.state === "SUSPENDED").length,
		mrr: rows
			.filter(
				(r) =>
					r.isPaid && (r.state === "ACTIVE" || r.state === "EXPIRING_SOON"),
			)
			.reduce((total, r) => total + Number(r.sub.plan.monthlyPrice), 0),
	};

	const stats = [
		{ label: "Subscriptions", value: summary.total.toString() },
		{ label: "On a paid plan", value: summary.paid.toString() },
		{ label: "Expiring ≤ 7 days", value: summary.expiringSoon.toString() },
		{ label: "In grace", value: summary.grace.toString() },
		{ label: "Suspended", value: summary.suspended.toString() },
		{ label: "Monthly recurring", value: `₦${summary.mrr.toLocaleString()}` },
	];

	return (
		<div className="grid gap-6">
			<div>
				<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
					Subscriptions
				</h1>
				<p className="mt-1 text-sm font-medium text-slate-600">
					Every restaurant&apos;s plan, billing cycle and renewal date — plus
					where they sit in the expiry lifecycle.
				</p>
			</div>

			<div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
				{stats.map((stat) => (
					<div
						key={stat.label}
						className="rounded-2xl border border-slate-100 bg-white p-4"
					>
						<p className="text-xs font-bold uppercase tracking-wide text-slate-500">
							{stat.label}
						</p>
						<p className="mt-1 text-xl font-black text-slate-950">
							{stat.value}
						</p>
					</div>
				))}
			</div>

			{/* Mobile: cards. Desktop: table. */}
			<div className="grid gap-3 md:hidden">
				{rows.map(({ sub, interval, price, daysLeft, state }) => {
					const badge = stateStyles[state];
					const Icon = badge.icon;
					return (
						<div
							key={sub.id}
							className="rounded-2xl border border-slate-100 bg-white p-4"
						>
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0">
									<p className="truncate font-black text-slate-950">
										{sub.restaurant?.name ?? "— no restaurant —"}
									</p>
									<p className="truncate text-xs font-medium text-slate-500">
										{sub.user.email}
									</p>
								</div>
								<span
									className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${badge.className}`}
								>
									<Icon className="size-3" aria-hidden="true" />
									{badge.label}
								</span>
							</div>
							<dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
								<div>
									<dt className="font-bold text-slate-500">Plan</dt>
									<dd className="font-black text-slate-900">{sub.plan.name}</dd>
								</div>
								<div>
									<dt className="font-bold text-slate-500">Billing</dt>
									<dd className="font-black text-slate-900">
										{price > 0
											? `₦${price.toLocaleString()} · ${interval.toLowerCase()}`
											: "Free"}
									</dd>
								</div>
								<div>
									<dt className="font-bold text-slate-500">Renews / expires</dt>
									<dd className="font-black text-slate-900">
										{price > 0 ? formatDate(sub.currentPeriodEnd) : "—"}
									</dd>
								</div>
								<div>
									<dt className="font-bold text-slate-500">Auto-renew</dt>
									<dd className="font-black text-slate-900">
										{sub.paystackSubscriptionCode ? "On" : "Off"}
									</dd>
								</div>
							</dl>
							<p className="mt-2 text-xs font-bold text-slate-500">
								{describeRemaining(daysLeft, state)}
							</p>
							{sub.restaurant ? (
								<Link
									href={`/${sub.restaurant.slug}`}
									className="mt-3 inline-flex h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700"
								>
									View menu
								</Link>
							) : null}
						</div>
					);
				})}
			</div>

			<div className="hidden overflow-hidden rounded-2xl border border-slate-100 bg-white md:block">
				<div className="overflow-x-auto">
					<table className="w-full min-w-[64rem] text-left text-sm">
						<thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
							<tr>
								<th className="px-4 py-3">Restaurant</th>
								<th className="px-4 py-3">Owner</th>
								<th className="px-4 py-3">Plan</th>
								<th className="px-4 py-3">Billing</th>
								<th className="px-4 py-3">Renews / expires</th>
								<th className="px-4 py-3">Auto-renew</th>
								<th className="px-4 py-3">Lifecycle</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-slate-100">
							{rows.map(({ sub, interval, price, daysLeft, state }) => {
								const badge = stateStyles[state];
								const Icon = badge.icon;
								return (
									<tr key={sub.id} className="align-top">
										<td className="px-4 py-3">
											<p className="font-black text-slate-950">
												{sub.restaurant?.name ?? "— no restaurant —"}
											</p>
											{sub.restaurant ? (
												<Link
													href={`/${sub.restaurant.slug}`}
													className="text-xs font-bold text-emerald-700 hover:underline"
												>
													/{sub.restaurant.slug}
												</Link>
											) : null}
										</td>
										<td className="px-4 py-3">
											<p className="font-bold text-slate-900">
												{sub.user.name ?? "—"}
											</p>
											<p className="text-xs font-medium text-slate-500">
												{sub.user.email}
											</p>
										</td>
										<td className="px-4 py-3 font-black text-slate-900">
											{sub.plan.name}
										</td>
										<td className="px-4 py-3 font-bold text-slate-700">
											{price > 0 ? (
												<>
													₦{price.toLocaleString()}
													<span className="block text-xs font-medium text-slate-500">
														{interval.toLowerCase()}
													</span>
												</>
											) : (
												"Free"
											)}
										</td>
										<td className="px-4 py-3 font-bold text-slate-700">
											{price > 0 ? (
												<>
													{formatDate(sub.currentPeriodEnd)}
													<span className="block text-xs font-medium text-slate-500">
														{describeRemaining(daysLeft, state)}
													</span>
												</>
											) : (
												"—"
											)}
										</td>
										<td className="px-4 py-3">
											{sub.paystackSubscriptionCode ? (
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
											<span
												className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${badge.className}`}
											>
												<Icon className="size-3" aria-hidden="true" />
												{badge.label}
											</span>
											{sub.lastExpiryNoticeStage ? (
												<span className="mt-1 block text-[11px] font-bold text-slate-400">
													last notice: {sub.lastExpiryNoticeStage}
												</span>
											) : null}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			</div>

			{rows.length === 0 ? (
				<p className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm font-bold text-slate-500">
					No subscriptions yet.
				</p>
			) : null}
		</div>
	);
}
