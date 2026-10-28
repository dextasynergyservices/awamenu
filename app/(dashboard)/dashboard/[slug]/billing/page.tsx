import {
	AlertTriangle,
	ArrowUpRight,
	CalendarClock,
	CheckCircle2,
	ChevronRight,
	FileText,
	Lock,
	RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { renewOrUpgradeAction } from "@/actions/subscription-lifecycle.actions";
import { BillingManageButton } from "@/components/admin/BillingManageButton";
import { BillingStateBadge } from "@/components/super-admin/BillingStateBadge";
import { SubmitButton } from "@/components/ui/action-button";
import { requireUser } from "@/lib/auth-guards";
import {
	type BillingDue,
	getOwnerBilling,
	type InvoiceStatus,
} from "@/lib/owner-billing";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const naira = (value: number) =>
	new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency: "NGN",
		maximumFractionDigits: 2,
		minimumFractionDigits: 0,
	}).format(value);

function day(iso: string) {
	return new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: "Africa/Lagos",
	}).format(new Date(iso));
}

const STATUS_STYLE: Record<
	InvoiceStatus,
	{ label: string; className: string }
> = {
	PAID: { label: "Paid", className: "bg-emerald-50 text-emerald-700" },
	REFUSED: { label: "Not applied", className: "bg-red-50 text-red-700" },
	REFUNDED: { label: "Refunded", className: "bg-slate-100 text-slate-600" },
};

function PayForm({
	restaurantId,
	slug,
	planId,
	interval,
	label,
	tone = "primary",
}: {
	restaurantId: string;
	slug: string;
	planId: string;
	interval: string;
	label: string;
	tone?: "primary" | "secondary";
}) {
	return (
		<form action={renewOrUpgradeAction}>
			<input type="hidden" name="restaurantId" value={restaurantId} />
			<input type="hidden" name="planId" value={planId} />
			<input type="hidden" name="billingInterval" value={interval} />
			<input type="hidden" name="slug" value={slug} />
			<SubmitButton
				loadingText="Opening payment..."
				className={cn(
					"inline-flex h-10 items-center justify-center rounded-lg px-4 text-xs font-bold",
					tone === "primary"
						? "bg-emerald-700 text-white hover:bg-emerald-800"
						: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
				)}
			>
				{label}
			</SubmitButton>
		</form>
	);
}

function DueCard({
	due,
	pay,
}: {
	due: BillingDue;
	pay:
		| ((label: string, tone?: "primary" | "secondary") => React.ReactNode)
		| null;
}) {
	const box = "rounded-2xl border p-4 sm:p-5";
	switch (due.kind) {
		case "overdue":
			return (
				<section className={cn(box, "border-red-200 bg-red-50")}>
					<p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-red-700">
						<Lock className="size-3.5" aria-hidden="true" /> Overdue
					</p>
					<p className="mt-2 text-2xl font-black text-red-950">
						{naira(due.amount)}
					</p>
					<p className="mt-1 text-sm font-medium text-red-900/80">
						Due since {day(due.dueSince)}. Your restaurant is read-only:
						customers can't order or book until you pay.
					</p>
					<div className="mt-4">{pay?.("Pay now and reactivate")}</div>
				</section>
			);
		case "due":
			return (
				<section className={cn(box, "border-orange-200 bg-orange-50")}>
					<p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-orange-700">
						<AlertTriangle className="size-3.5" aria-hidden="true" /> Payment
						due
					</p>
					<p className="mt-2 text-2xl font-black text-orange-950">
						{naira(due.amount)}
					</p>
					<p className="mt-1 text-sm font-medium text-orange-900/80">
						Your plan ended on {day(due.dueSince)}. Pay before{" "}
						{day(due.readOnlyOn)} to keep taking orders.
					</p>
					<div className="mt-4">{pay?.("Pay now")}</div>
				</section>
			);
		case "upcoming":
			return (
				<section className={cn(box, "border-amber-200 bg-amber-50/60")}>
					<p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-amber-800">
						<CalendarClock className="size-3.5" aria-hidden="true" /> Next
						payment
					</p>
					<p className="mt-2 text-2xl font-black text-slate-950">
						{naira(due.amount)}
					</p>
					<p className="mt-1 text-sm font-medium text-slate-600">
						Due {day(due.date)} (
						{due.daysLeft > 0
							? `in ${due.daysLeft} day${due.daysLeft === 1 ? "" : "s"}`
							: "today"}
						). Auto-renew is off, so pay before then. Renewing early adds a full
						period after the current one; you don't lose any days.
					</p>
					<div className="mt-4">{pay?.("Renew now", "secondary")}</div>
				</section>
			);
		case "next_charge":
			return (
				<section className={cn(box, "border-slate-200 bg-white")}>
					<p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
						<RefreshCw className="size-3.5" aria-hidden="true" /> Next charge
					</p>
					<p className="mt-2 text-2xl font-black text-slate-950">
						{naira(due.amount)}
					</p>
					<p className="mt-1 text-sm font-medium text-slate-600">
						Your saved card is charged automatically on {day(due.date)}.
					</p>
				</section>
			);
		case "free":
			return (
				<section className={cn(box, "border-slate-200 bg-white")}>
					<p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-500">
						<CheckCircle2 className="size-3.5" aria-hidden="true" /> Nothing due
					</p>
					<p className="mt-2 text-sm font-medium text-slate-600">
						You're on the Free plan, so there's nothing to pay. Upgrade any time
						for more items, templates and your own branding.
					</p>
				</section>
			);
		default:
			return null;
	}
}

export default async function BillingPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const user = await requireUser();
	const { slug } = await params;
	const billing = await getOwnerBilling(slug, user.id);
	if (!billing) redirect("/dashboard");

	const { plan, state, due, invoices, totals, restaurant } = billing;
	const pay =
		plan && plan.price > 0 && plan.interval
			? (label: string, tone: "primary" | "secondary" = "primary") => (
					<PayForm
						restaurantId={restaurant.id}
						slug={slug}
						planId={plan.id}
						interval={plan.interval as string}
						label={`${label} · ${naira(plan.price)}`}
						tone={tone}
					/>
				)
			: null;

	return (
		<div className="grid max-w-5xl gap-5">
			<div className="hidden md:block">
				<h1 className="text-2xl font-black text-slate-950">Billing</h1>
				<p className="mt-1 text-sm font-medium text-slate-500">
					Your plan, what's due, and every invoice.
				</p>
			</div>

			<div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
				{/* Current plan */}
				<section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
					<div className="flex flex-wrap items-start justify-between gap-3">
						<div>
							<p className="text-xs font-black uppercase tracking-wide text-slate-500">
								Current plan
							</p>
							<p className="mt-1 text-2xl font-black text-slate-950">
								{plan?.name ?? "No plan"}
							</p>
							{plan && plan.price > 0 ? (
								<p className="text-sm font-semibold text-slate-600">
									{naira(plan.price)} / {plan.intervalLabel?.toLowerCase()}
								</p>
							) : null}
						</div>
						<BillingStateBadge state={state} />
					</div>

					{plan && plan.price > 0 ? (
						<dl className="mt-4 grid grid-cols-2 gap-3 border-slate-100 border-t pt-4 text-sm sm:grid-cols-3">
							<div>
								<dt className="text-xs font-bold text-slate-500">
									Current period
								</dt>
								<dd className="mt-0.5 font-bold text-slate-900">
									{day(plan.periodStart)} – {day(plan.periodEnd)}
								</dd>
							</div>
							<div>
								<dt className="text-xs font-bold text-slate-500">Auto-renew</dt>
								<dd className="mt-0.5 font-bold text-slate-900">
									{plan.autoRenew ? "On" : "Off"}
								</dd>
							</div>
							<div>
								<dt className="text-xs font-bold text-slate-500">
									Payment method
								</dt>
								<dd className="mt-0.5 font-bold text-slate-900">
									{plan.hasCard
										? (invoices.find((i) => i.paymentMethod)?.paymentMethod ??
											"Card on file")
										: "None saved"}
								</dd>
							</div>
						</dl>
					) : null}

					<div className="mt-4 flex flex-wrap gap-2">
						<Link
							href={`/dashboard/${slug}/settings/plan`}
							className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"
						>
							<ArrowUpRight className="size-3.5" aria-hidden="true" />
							Change plan
						</Link>
						{plan && plan.price > 0 ? (
							<BillingManageButton
								planName={plan.name}
								status={
									state === "LAPSED" || state === "GRACE"
										? "PAST_DUE"
										: "ACTIVE"
								}
								currentPeriodEnd={plan.periodEnd}
								hasCard={plan.hasCard}
								slug={slug}
							/>
						) : null}
					</div>
				</section>

				<DueCard due={due} pay={pay} />
			</div>

			{/* Invoices */}
			<section className="rounded-2xl border border-slate-200 bg-white">
				<div className="flex flex-wrap items-end justify-between gap-2 border-slate-100 border-b p-4 sm:p-5">
					<div>
						<h2 className="text-base font-black text-slate-950">Invoices</h2>
						<p className="text-xs font-medium text-slate-500">
							{totals.paidCount > 0
								? `${totals.paidCount} paid · ${naira(totals.paidTotal)} in total`
								: "Your subscription payments will appear here."}
						</p>
					</div>
				</div>

				{invoices.length === 0 ? (
					<div className="grid place-items-center gap-2 p-10 text-center">
						<FileText className="size-8 text-slate-300" aria-hidden="true" />
						<p className="text-sm font-medium text-slate-500">
							No invoices yet.
						</p>
					</div>
				) : (
					<>
						{/* Desktop */}
						<table className="hidden w-full text-left text-sm md:table">
							<thead>
								<tr className="border-slate-100 border-b text-xs font-bold uppercase tracking-wide text-slate-500">
									<th className="px-5 py-3">Invoice</th>
									<th className="px-5 py-3">Date</th>
									<th className="px-5 py-3">Description</th>
									<th className="px-5 py-3 text-right">Amount</th>
									<th className="px-5 py-3">Status</th>
									<th className="w-12 px-5 py-3">
										<span className="sr-only">View</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{invoices.map((inv) => (
									<tr
										key={inv.id}
										className="border-slate-50 border-b last:border-0 hover:bg-slate-50/60"
									>
										<td className="px-5 py-3 font-mono text-xs font-bold text-slate-700">
											{inv.number}
										</td>
										<td className="px-5 py-3 text-slate-600">
											{day(inv.issuedAt)}
										</td>
										<td className="px-5 py-3 text-slate-700">
											{inv.description}
										</td>
										<td className="px-5 py-3 text-right font-bold text-slate-900">
											{naira(inv.amount)}
										</td>
										<td className="px-5 py-3">
											<span
												className={cn(
													"rounded-full px-2 py-0.5 text-[11px] font-bold",
													STATUS_STYLE[inv.status].className,
												)}
											>
												{STATUS_STYLE[inv.status].label}
											</span>
										</td>
										<td className="px-5 py-3 text-right">
											<Link
												href={`/dashboard/${slug}/billing/invoices/${inv.id}`}
												className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
											>
												View
											</Link>
										</td>
									</tr>
								))}
							</tbody>
						</table>
						{/* Mobile */}
						<ul className="divide-y divide-slate-100 md:hidden">
							{invoices.map((inv) => (
								<li key={inv.id}>
									<Link
										href={`/dashboard/${slug}/billing/invoices/${inv.id}`}
										className="flex items-center justify-between gap-3 px-4 py-3 active:bg-slate-50"
									>
										<div className="min-w-0">
											<p className="truncate text-sm font-bold text-slate-900">
												{inv.description}
											</p>
											<p className="text-xs font-medium text-slate-500">
												{day(inv.issuedAt)} · {inv.number}
											</p>
										</div>
										<div className="flex shrink-0 items-center gap-2">
											<div className="text-right">
												<p className="text-sm font-black text-slate-950">
													{naira(inv.amount)}
												</p>
												<span
													className={cn(
														"rounded-full px-1.5 py-0.5 text-[10px] font-bold",
														STATUS_STYLE[inv.status].className,
													)}
												>
													{STATUS_STYLE[inv.status].label}
												</span>
											</div>
											<ChevronRight
												className="size-4 text-slate-400"
												aria-hidden="true"
											/>
										</div>
									</Link>
								</li>
							))}
						</ul>
					</>
				)}
			</section>
		</div>
	);
}
