import { OrderStatus } from "@prisma/client";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
	assignRestaurantPlanAction,
	sendOwnerPasswordResetAction,
	toggleRestaurantActiveAction,
} from "@/actions/super-admin.actions";
import {
	AdminSuspendedBadge,
	BillingStateBadge,
} from "@/components/super-admin/BillingStateBadge";
import { ChangePlanButton } from "@/components/super-admin/ChangePlanButton";
import { CommissionButton } from "@/components/super-admin/CommissionButton";
import { SuspendRestaurantButton } from "@/components/super-admin/SuspendRestaurantButton";
import { SubmitButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { BILLING_INTERVAL_DETAILS, parseBillingInterval } from "@/lib/billing";
import {
	billingStateOf,
	daysLeft,
	isAutoRenewing,
	lapsedAt,
	subscriptionPrice,
} from "@/lib/billing-state";
import {
	commissionLabel,
	effectiveCommission,
	getPlatformCommissionPercent,
} from "@/lib/commission";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const naira = (value: number) =>
	new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency: "NGN",
		maximumFractionDigits: 0,
	}).format(value);

function formatDate(value: Date | null | undefined) {
	if (!value) return "—";
	return new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(value);
}

function Row({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex items-start justify-between gap-3 py-1.5">
			<span className="text-sm font-medium text-slate-500">{label}</span>
			<span className="text-right text-sm font-black text-slate-900">
				{children}
			</span>
		</div>
	);
}

function Card({
	title,
	children,
	action,
}: {
	title: string;
	children: React.ReactNode;
	action?: React.ReactNode;
}) {
	return (
		<section className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
			<div className="mb-2 flex items-center justify-between gap-3">
				<h2 className="text-sm font-black text-slate-800">{title}</h2>
				{action}
			</div>
			{children}
		</section>
	);
}

export default async function SuperAdminRestaurantDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const restaurant = await db.restaurant.findUnique({
		where: { id },
		select: {
			id: true,
			name: true,
			slug: true,
			phone: true,
			address: true,
			isActive: true,
			suspensionReason: true,
			suspendedAt: true,
			currency: true,
			createdAt: true,
			commissionPercentOverride: true,
			commissionNote: true,
			commissionUpdatedAt: true,
			owner: {
				select: {
					id: true,
					name: true,
					email: true,
					emailVerified: true,
					isActive: true,
					suspensionReason: true,
					sessions: {
						orderBy: { updatedAt: "desc" },
						take: 1,
						select: { updatedAt: true },
					},
				},
			},
			subscription: {
				select: {
					status: true,
					currentPeriodStart: true,
					currentPeriodEnd: true,
					billingInterval: true,
					paystackSubscriptionCode: true,
					plan: {
						select: {
							id: true,
							name: true,
							monthlyPrice: true,
							quarterlyPrice: true,
							yearlyPrice: true,
						},
					},
				},
			},
			_count: { select: { orders: true, staff: true, ratings: true } },
		},
	});

	if (!restaurant) notFound();

	const platformRate = await getPlatformCommissionPercent();
	const commission = effectiveCommission(
		restaurant.commissionPercentOverride,
		platformRate,
	);

	const [revenueAgg, plans, menuItemCount, categoryCount, lastOrder, payments] =
		await Promise.all([
			db.order.aggregate({
				where: { restaurantId: restaurant.id, status: OrderStatus.COMPLETED },
				_sum: { total: true },
			}),
			db.plan.findMany({
				where: { isActive: true },
				orderBy: { monthlyPrice: "asc" },
			}),
			db.menuItem.count({
				where: { category: { restaurantId: restaurant.id } },
			}),
			db.menuCategory.count({ where: { restaurantId: restaurant.id } }),
			db.order.findFirst({
				where: { restaurantId: restaurant.id },
				orderBy: { createdAt: "desc" },
				select: { createdAt: true },
			}),
			db.subscriptionPayment.findMany({
				where: { restaurantId: restaurant.id },
				orderBy: { createdAt: "desc" },
				take: 6,
				select: {
					id: true,
					amount: true,
					kind: true,
					status: true,
					reference: true,
					createdAt: true,
				},
			}),
		]);

	const sub = restaurant.subscription;
	const state = billingStateOf(sub);
	const paid = sub ? subscriptionPrice(sub) > 0 : false;
	const interval = sub ? parseBillingInterval(sub.billingInterval) : null;
	const left = sub ? daysLeft(sub.currentPeriodEnd) : null;
	const owner = restaurant.owner;

	return (
		<div className="grid max-w-4xl gap-5">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
						{restaurant.name}
					</h1>
					<div className="mt-2 flex flex-wrap items-center gap-1.5">
						{!restaurant.isActive ? <AdminSuspendedBadge /> : null}
						<BillingStateBadge state={state} />
						<Link
							href={`/${restaurant.slug}`}
							target="_blank"
							className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
						>
							/{restaurant.slug}
							<ExternalLink className="size-3" aria-hidden="true" />
						</Link>
					</div>
				</div>
				{restaurant.isActive ? (
					<SuspendRestaurantButton
						restaurantId={restaurant.id}
						restaurantName={restaurant.name}
					/>
				) : (
					<ActionForm action={toggleRestaurantActiveAction}>
						<input type="hidden" name="restaurantId" value={restaurant.id} />
						<input type="hidden" name="isActive" value="true" />
						<SubmitButton
							loadingText="Restoring..."
							successText="Restored"
							className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-700 px-3 text-xs font-black text-white hover:bg-emerald-800"
						>
							Restore restaurant
						</SubmitButton>
					</ActionForm>
				)}
			</div>

			{!restaurant.isActive ? (
				<p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">
					<span className="font-black">
						Suspended by admin since {formatDate(restaurant.suspendedAt)}.
					</span>{" "}
					{restaurant.suspensionReason
						? `Reason: ${restaurant.suspensionReason}`
						: "No reason recorded."}
				</p>
			) : state === "LAPSED" && sub ? (
				<p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
					<span className="font-black">
						Read-only since {formatDate(lapsedAt(sub.currentPeriodEnd))}
					</span>{" "}
					(unpaid). Customers can view the menu but not order; the owner can
					sign in and pay to reactivate.
				</p>
			) : null}

			<div className="grid gap-4 md:grid-cols-2">
				<Card
					title="Subscription"
					action={
						<Link
							href="/super-admin/subscriptions"
							className="text-xs font-black text-emerald-700"
						>
							All subscriptions
						</Link>
					}
				>
					<Row label="Plan">{sub?.plan.name ?? "No plan"}</Row>
					<Row label="Billing">
						{paid && interval
							? `${naira(sub ? subscriptionPrice(sub) : 0)} · ${BILLING_INTERVAL_DETAILS[interval].label}`
							: "Free"}
					</Row>
					{paid && sub ? (
						<>
							<Row label="Current period">
								{formatDate(sub.currentPeriodStart)} –{" "}
								{formatDate(sub.currentPeriodEnd)}
							</Row>
							<Row label="Time left">
								{left === null
									? "—"
									: left > 0
										? `${left} day${left === 1 ? "" : "s"}`
										: `Ended ${Math.abs(left)} day${Math.abs(left) === 1 ? "" : "s"} ago`}
							</Row>
							<Row label="Auto-renew">{isAutoRenewing(sub) ? "On" : "Off"}</Row>
							{sub.status === "ACTIVE" &&
							(state === "LAPSED" || state === "GRACE") ? (
								<p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
									The billing record still says active after its end date: the
									subscriptions cron hasn&apos;t synced it. Access already
									follows the dates.
								</p>
							) : null}
						</>
					) : null}
					<div className="mt-3 border-slate-100 border-t pt-3">
						<p className="mb-2 text-xs font-bold text-slate-500">
							Change plan (complimentary; no charge)
						</p>
						<ChangePlanButton
							restaurantId={restaurant.id}
							currentPlanId={sub?.plan.id}
							currentPlanName={sub?.plan.name ?? "No plan"}
							plans={plans.map((plan) => ({ id: plan.id, name: plan.name }))}
						/>
						<ActionForm
							action={assignRestaurantPlanAction}
							className="hidden flex-wrap gap-2 md:flex"
						>
							<input type="hidden" name="restaurantId" value={restaurant.id} />
							<select
								name="planId"
								defaultValue={sub?.plan.id ?? ""}
								required
								className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							>
								<option value="" disabled>
									Select a plan
								</option>
								{plans.map((plan) => (
									<option key={plan.id} value={plan.id}>
										{plan.name}
									</option>
								))}
							</select>
							<SubmitButton
								loadingText="Assigning..."
								successText="Assigned"
								className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
							>
								Change plan
							</SubmitButton>
						</ActionForm>
					</div>
				</Card>

				<Card
					title="Owner account"
					action={
						<Link
							href={`/super-admin/users?q=${encodeURIComponent(owner.email)}`}
							className="text-xs font-black text-emerald-700"
						>
							View in Accounts
						</Link>
					}
				>
					<Row label="Name">{owner.name ?? "Unnamed"}</Row>
					<Row label="Email">
						{owner.email}
						{!owner.emailVerified ? (
							<span className="block text-[11px] font-bold text-amber-700">
								Not verified
							</span>
						) : null}
					</Row>
					<Row label="Sign-in">
						{owner.isActive ? (
							"Allowed"
						) : (
							<span className="text-red-700">
								Account suspended
								{owner.suspensionReason ? (
									<span className="block text-[11px] font-bold">
										{owner.suspensionReason}
									</span>
								) : null}
							</span>
						)}
					</Row>
					<Row label="Last active">
						{formatDate(owner.sessions[0]?.updatedAt)}
					</Row>
					<div className="mt-3 border-slate-100 border-t pt-3">
						<ConfirmForm
							action={sendOwnerPasswordResetAction}
							tone="default"
							hiddenFields={{ userId: owner.id }}
							confirmMessage={`Email ${owner.email} a password reset code? They will choose the new password themselves.`}
						>
							<SubmitButton
								loadingText="Sending..."
								successText="Sent"
								className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700 hover:bg-slate-50"
							>
								Send password reset
							</SubmitButton>
						</ConfirmForm>
					</div>
				</Card>
			</div>

			<Card
				title="Subscription payments"
				action={
					<Link
						href="/super-admin/payments"
						className="text-xs font-black text-emerald-700"
					>
						All payments
					</Link>
				}
			>
				{payments.length > 0 ? (
					<ul className="divide-y divide-slate-100">
						{payments.map((p) => (
							<li
								key={p.id}
								className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
							>
								<span className="font-bold text-slate-800">
									{naira(Number(p.amount))}{" "}
									<span className="text-xs font-semibold text-slate-500">
										{p.kind === "RENEWAL" ? "Renewal" : "Checkout"} ·{" "}
										{formatDate(p.createdAt)}
									</span>
								</span>
								<span
									className={`rounded-full px-2 py-0.5 text-[11px] font-black ${
										p.status === "SUCCESS"
											? "bg-emerald-50 text-emerald-700"
											: p.status === "MISMATCH"
												? "bg-red-50 text-red-700"
												: "bg-slate-100 text-slate-600"
									}`}
								>
									{p.status === "MISMATCH"
										? "Wrong amount"
										: p.status.toLowerCase()}
								</span>
							</li>
						))}
					</ul>
				) : (
					<p className="text-sm font-medium text-slate-500">
						No subscription payments yet.
					</p>
				)}
			</Card>

			<Card
				title="AwaMenu Pay commission"
				action={
					<CommissionButton
						restaurantId={restaurant.id}
						restaurantName={restaurant.name}
						current={{
							kind: commission.kind,
							percent: commission.percent,
							note: restaurant.commissionNote,
						}}
						platformPercent={platformRate}
					/>
				}
			>
				<p className="text-lg font-black text-slate-950">
					{commissionLabel(commission)}
				</p>
				<p className="text-xs font-medium text-slate-500">
					{commission.kind === "platform"
						? "Follows the platform rate."
						: (restaurant.commissionNote ?? "Differs from the platform rate.")}
					{restaurant.commissionUpdatedAt
						? ` Set ${formatDate(restaurant.commissionUpdatedAt)}.`
						: ""}
				</p>
			</Card>

			<Card title="Restaurant">
				<Row label="Contact">{restaurant.phone ?? "—"}</Row>
				<Row label="Address">{restaurant.address ?? "—"}</Row>
				<Row label="Joined">{formatDate(restaurant.createdAt)}</Row>
				<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
					{[
						["Menu items", menuItemCount.toLocaleString()],
						["Categories", categoryCount.toLocaleString()],
						["Orders", restaurant._count.orders.toLocaleString()],
						["Staff", restaurant._count.staff.toLocaleString()],
						["Reviews", restaurant._count.ratings.toLocaleString()],
						[
							"Completed sales",
							new Intl.NumberFormat("en-NG", {
								style: "currency",
								currency: restaurant.currency,
								maximumFractionDigits: 0,
							}).format(Number(revenueAgg._sum.total ?? 0)),
						],
						[
							"Last order",
							lastOrder ? formatDate(lastOrder.createdAt) : "None",
						],
					].map(([label, value]) => (
						<div key={label} className="rounded-xl bg-slate-50 p-3">
							<p className="text-[11px] font-black uppercase tracking-wide text-slate-500">
								{label}
							</p>
							<p className="mt-1 text-sm font-black text-slate-950">{value}</p>
						</div>
					))}
				</div>
			</Card>
		</div>
	);
}
