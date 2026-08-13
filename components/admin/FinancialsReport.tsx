"use client";

import {
	AlertTriangle,
	ArrowDownToLine,
	Banknote,
	Receipt,
	ShieldCheck,
	Wallet,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { FinancialSummary } from "@/lib/financials";

type Row = {
	id: string;
	createdAt: string;
	orderRef: string;
	direction: "CREDIT" | "REFUND";
	status: string;
	method: string;
	gateway: string | null;
	reference: string | null;
	gross: number;
	gatewayFee: number | null;
	platformFee: number | null;
	net: number | null;
	settlementStatus: string;
	note: string | null;
};

type AuditEvent = {
	id: string;
	createdAt: string;
	actorName: string;
	actorType: string;
	action: string;
	label: string;
	target: string;
	previousValue: string | null;
	newValue: string | null;
};

const naira = (value: number) =>
	`₦${value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const shortDate = (iso: string) =>
	new Date(iso).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});

const dateTime = (iso: string) =>
	new Date(iso).toLocaleString("en-GB", {
		day: "numeric",
		month: "short",
		hour: "2-digit",
		minute: "2-digit",
	});

/**
 * The owner's financial record.
 *
 * Built from the payment ledger rather than from order totals, so what it shows
 * is what was actually collected — including the cases where those two disagree.
 * A mismatch is surfaced at the top rather than filtered out: an entry the
 * gateway called successful but which failed the amount check is the single
 * most important thing on this page when it exists.
 */
export function FinancialsReport({
	slug,
	rows,
	summary,
	range,
	auditEvents,
}: {
	slug: string;
	rows: Row[];
	summary: FinancialSummary;
	range: { from: string; to: string };
	auditEvents: AuditEvent[];
}) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [from, setFrom] = useState(range.from);
	const [to, setTo] = useState(range.to);
	const [tab, setTab] = useState<"payments" | "activity">("payments");

	function applyRange() {
		const next = new URLSearchParams(searchParams.toString());
		next.set("from", from);
		next.set("to", to);
		router.push(`/dashboard/${slug}/financials?${next}`);
	}

	const exportHref = `/dashboard/${slug}/financials/export?from=${from}&to=${to}`;

	return (
		<div className="grid min-w-0 gap-5 pb-10">
			<header className="min-w-0">
				<h1 className="text-2xl font-black text-slate-950">
					Payments &amp; reports
				</h1>
				<p className="mt-1 text-sm font-medium leading-6 text-slate-500">
					Every payment recorded against your orders — card, cash, POS and
					transfer — with what each one cost you and what reaches your bank.
				</p>
			</header>

			{/* A grid, not flex-wrap. A date input carries a wide intrinsic minimum
			    (the dd/mm/yyyy mask plus the picker button), so two of them at
			    flex-1 refuse to shrink on a phone and squash the buttons off the
			    row. Explicit tracks give each control a full-width row on mobile
			    and put everything on one line from `sm` up, where there is room. */}
			<div className="grid min-w-0 gap-2 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
				<label className="min-w-0">
					<span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
						From
					</span>
					<input
						type="date"
						value={from}
						max={to}
						onChange={(event) => setFrom(event.target.value)}
						className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 sm:text-sm"
					/>
				</label>
				<label className="min-w-0">
					<span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
						To
					</span>
					<input
						type="date"
						value={to}
						min={from}
						onChange={(event) => setTo(event.target.value)}
						className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 sm:text-sm"
					/>
				</label>
				<button
					type="button"
					onClick={applyRange}
					className="inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl bg-slate-950 px-4 text-xs font-black text-white"
				>
					Apply
				</button>
				<a
					href={exportHref}
					className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700 transition-colors hover:bg-slate-50"
				>
					<ArrowDownToLine className="size-3.5" aria-hidden="true" />
					Export CSV
				</a>
			</div>

			{summary.mismatchCount > 0 ? (
				<div className="flex min-w-0 items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
					<AlertTriangle
						className="size-5 shrink-0 text-amber-700"
						aria-hidden="true"
					/>
					<div className="min-w-0">
						<p className="text-sm font-black text-amber-900">
							{summary.mismatchCount} payment
							{summary.mismatchCount === 1 ? "" : "s"} did not match the order
							total
						</p>
						<p className="mt-0.5 text-xs font-medium leading-5 text-amber-800">
							These were recorded but not credited, so the orders are still
							showing as unpaid. They are listed below marked{" "}
							<strong>Mismatch</strong>. Contact us if you can&apos;t account
							for one.
						</p>
					</div>
				</div>
			) : null}

			<div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				<SummaryCard
					icon={<Banknote className="size-5" aria-hidden="true" />}
					label="Collected"
					value={naira(summary.netCollected)}
					hint={`${summary.transactionCount} payment${summary.transactionCount === 1 ? "" : "s"}`}
				/>
				<SummaryCard
					icon={<Receipt className="size-5" aria-hidden="true" />}
					label="Fees"
					value={naira(summary.gatewayFees + summary.platformFees)}
					hint={`${naira(summary.gatewayFees)} provider · ${naira(summary.platformFees)} AwaMenu`}
				/>
				<SummaryCard
					icon={<Wallet className="size-5" aria-hidden="true" />}
					label="Your share"
					value={naira(summary.payoutExpected)}
					hint="After every deduction"
					emphasis
				/>
				<SummaryCard
					icon={<ShieldCheck className="size-5" aria-hidden="true" />}
					label="Refunded"
					value={naira(summary.refunded)}
					hint={summary.refunded > 0 ? "Returned to customers" : "None"}
				/>
			</div>

			{summary.byMethod.length > 0 ? (
				<section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
					<p className="text-sm font-black text-slate-900">How you were paid</p>
					<ul className="mt-3 grid gap-2">
						{summary.byMethod.map((entry) => {
							const share = summary.grossCollected
								? (entry.amount / summary.grossCollected) * 100
								: 0;
							return (
								<li key={entry.method} className="min-w-0">
									<div className="flex min-w-0 items-center justify-between gap-3">
										<span className="min-w-0 truncate text-xs font-bold text-slate-700">
											{entry.method}
										</span>
										<span className="shrink-0 text-xs font-black tabular-nums text-slate-900">
											{naira(entry.amount)}
										</span>
									</div>
									<div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
										<div
											className="h-full rounded-full bg-emerald-600"
											style={{ width: `${share}%` }}
										/>
									</div>
								</li>
							);
						})}
					</ul>
				</section>
			) : null}

			<div className="flex min-w-0 gap-1 rounded-xl bg-slate-100 p-1">
				{(["payments", "activity"] as const).map((value) => (
					<button
						key={value}
						type="button"
						onClick={() => setTab(value)}
						className={`min-h-10 min-w-0 flex-1 rounded-lg text-xs font-black capitalize transition-colors ${
							tab === value
								? "bg-white text-slate-950 shadow-sm"
								: "text-slate-500"
						}`}
					>
						{value === "payments" ? "Payments" : "Activity log"}
					</button>
				))}
			</div>

			{tab === "payments" ? (
				<PaymentsTable rows={rows} range={range} slug={slug} />
			) : (
				<ActivityLog events={auditEvents} />
			)}
		</div>
	);
}

function SummaryCard({
	icon,
	label,
	value,
	hint,
	emphasis,
}: {
	icon: React.ReactNode;
	label: string;
	value: string;
	hint: string;
	emphasis?: boolean;
}) {
	return (
		<div
			className={`min-w-0 rounded-2xl border p-4 ${
				emphasis
					? "border-emerald-200 bg-emerald-50"
					: "border-slate-200 bg-white"
			}`}
		>
			<span
				className={`grid size-9 place-items-center rounded-xl ${
					emphasis
						? "bg-emerald-100 text-emerald-700"
						: "bg-slate-50 text-slate-500"
				}`}
			>
				{icon}
			</span>
			<p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">
				{label}
			</p>
			<p className="mt-0.5 truncate text-lg font-black tabular-nums text-slate-950">
				{value}
			</p>
			<p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
				{hint}
			</p>
		</div>
	);
}

function PaymentsTable({
	rows,
	range,
	slug,
}: {
	rows: Row[];
	range: { from: string; to: string };
	slug: string;
}) {
	if (rows.length === 0) {
		return (
			<div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
				<p className="text-sm font-black text-slate-900">
					No payments in this period
				</p>
				<p className="mx-auto mt-1 max-w-sm text-xs font-medium leading-5 text-slate-500">
					Nothing was recorded between {shortDate(range.from)} and{" "}
					{shortDate(range.to)}. Try a wider date range.
				</p>
			</div>
		);
	}

	return (
		<section className="min-w-0 rounded-2xl border border-slate-200 bg-white">
			{/* The table scrolls inside its own box. Letting the page scroll
			    sideways instead is what makes a dashboard unusable on a phone. */}
			<div className="min-w-0 overflow-x-auto">
				<table className="w-full min-w-[46rem] border-collapse text-left">
					<thead>
						<tr className="border-b border-slate-100">
							{[
								"Date",
								"Order",
								"Method",
								"Gross",
								"Fees",
								"Your share",
								"Status",
							].map((heading) => (
								<th
									key={heading}
									className="px-4 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500"
								>
									{heading}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{rows.map((row) => {
							const fees = (row.gatewayFee ?? 0) + (row.platformFee ?? 0);
							const refund = row.direction === "REFUND";
							return (
								<tr key={row.id} className="align-middle">
									<td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-500">
										{dateTime(row.createdAt)}
									</td>
									<td className="whitespace-nowrap px-4 py-3 text-xs font-black text-slate-900">
										{row.orderRef}
									</td>
									<td className="px-4 py-3 text-xs font-bold text-slate-700">
										{row.method}
										{row.gateway ? (
											<span className="block text-[11px] font-medium text-slate-400">
												{row.gateway}
											</span>
										) : null}
									</td>
									<td
										className={`whitespace-nowrap px-4 py-3 text-xs font-black tabular-nums ${
											refund ? "text-red-600" : "text-slate-900"
										}`}
									>
										{refund ? "−" : ""}
										{naira(row.gross)}
									</td>
									<td className="whitespace-nowrap px-4 py-3 text-xs font-medium tabular-nums text-slate-500">
										{fees > 0 ? naira(fees) : "—"}
									</td>
									<td className="whitespace-nowrap px-4 py-3 text-xs font-black tabular-nums text-slate-900">
										{row.net != null ? naira(row.net) : naira(row.gross)}
									</td>
									<td className="px-4 py-3">
										<div className="flex items-center gap-2">
											<StatusPill status={row.status} note={row.note} />
											{row.direction === "CREDIT" &&
											row.status === "SUCCESS" ? (
												<RefundButton
													slug={slug}
													paymentId={row.id}
													amount={row.gross}
												/>
											) : null}
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</section>
	);
}

/**
 * Refunding is two deliberate steps, not one click.
 *
 * Money leaving the business on a single tap next to every row is how mistakes
 * happen — especially on a phone. The confirm step also carries the choice
 * between sending it back through the provider and recording one already
 * handed over in cash, which are different events and should not be conflated.
 */
function RefundButton({
	slug,
	paymentId,
	amount,
}: {
	slug: string;
	paymentId: string;
	amount: number;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function submit(offline: boolean) {
		setBusy(true);
		setError(null);
		const { refundPaymentAction } = await import("@/actions/refund.actions");
		const result = await refundPaymentAction({
			slug,
			paymentId,
			reason: reason.trim() || undefined,
			offline,
		});
		setBusy(false);

		if ("error" in result) {
			setError(result.error);
			return;
		}
		setOpen(false);
		router.refresh();
	}

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="whitespace-nowrap rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-black text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
			>
				Refund
			</button>
		);
	}

	return (
		<div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/40 p-0 sm:place-items-center sm:p-4">
			<div className="w-full min-w-0 rounded-t-2xl bg-white p-5 sm:max-w-md sm:rounded-2xl">
				<p className="text-base font-black text-slate-950">
					Refund {naira(amount)}?
				</p>
				<p className="mt-1 text-xs font-medium leading-5 text-slate-500">
					This can&apos;t be undone. The payment stays on your record and a
					matching refund is added beside it.
				</p>

				<label className="mt-4 block">
					<span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
						Reason (optional)
					</span>
					<input
						type="text"
						value={reason}
						maxLength={200}
						onChange={(event) => setReason(event.target.value)}
						placeholder="Order cancelled"
						className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 px-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 sm:text-sm"
					/>
				</label>

				{error ? (
					<p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
						{error}
					</p>
				) : null}

				<div className="mt-4 grid gap-2">
					<button
						type="button"
						onClick={() => submit(false)}
						disabled={busy}
						className="min-h-12 w-full rounded-2xl bg-red-600 text-sm font-black text-white disabled:opacity-50"
					>
						{busy ? "Refunding…" : "Send refund to customer"}
					</button>
					<button
						type="button"
						onClick={() => submit(true)}
						disabled={busy}
						className="min-h-11 w-full rounded-2xl border border-slate-200 text-xs font-black text-slate-700 disabled:opacity-50"
					>
						I already paid them — just record it
					</button>
					<button
						type="button"
						onClick={() => setOpen(false)}
						disabled={busy}
						className="min-h-10 w-full text-xs font-black text-slate-500"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}

function StatusPill({ status, note }: { status: string; note: string | null }) {
	if (status === "MISMATCH") {
		return (
			<span
				title={note ?? undefined}
				className="inline-block whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-700"
			>
				Mismatch
			</span>
		);
	}
	if (status === "REVERSED") {
		return (
			<span className="inline-block whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
				Reversed
			</span>
		);
	}
	return (
		<span className="inline-block whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">
			Paid
		</span>
	);
}

function ActivityLog({ events }: { events: AuditEvent[] }) {
	if (events.length === 0) {
		return (
			<div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
				<p className="text-sm font-black text-slate-900">Nothing logged yet</p>
				<p className="mx-auto mt-1 max-w-sm text-xs font-medium leading-5 text-slate-500">
					Payments you record, and changes to where your money is sent, will
					appear here with who made them.
				</p>
			</div>
		);
	}

	return (
		<section className="min-w-0 rounded-2xl border border-slate-200 bg-white">
			<ul className="divide-y divide-slate-100">
				{events.map((event) => (
					<li key={event.id} className="min-w-0 px-4 py-3">
						<div className="flex min-w-0 flex-wrap items-center gap-2">
							<span className="text-sm font-black text-slate-900">
								{event.label}
							</span>
							<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">
								{event.actorName}
							</span>
						</div>
						<p className="mt-0.5 text-xs font-medium leading-5 text-slate-500">
							{event.target}
							{event.previousValue ? (
								<>
									{" — "}
									<span className="line-through">{event.previousValue}</span>
									{" → "}
									<span className="font-bold text-slate-700">
										{event.newValue}
									</span>
								</>
							) : event.newValue ? (
								<>
									{" — "}
									<span className="font-bold text-slate-700">
										{event.newValue}
									</span>
								</>
							) : null}
						</p>
						<p className="mt-0.5 text-[11px] font-medium text-slate-400">
							{dateTime(event.createdAt)}
						</p>
					</li>
				))}
			</ul>
		</section>
	);
}
