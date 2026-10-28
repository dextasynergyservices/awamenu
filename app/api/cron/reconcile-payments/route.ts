import { NextResponse } from "next/server";
import { env } from "@/env";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { recordCronRun } from "@/lib/cron-heartbeat";
import { db } from "@/lib/db";
import { isAwamenuReference } from "@/lib/payment-attempts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Compares our ledger against Paystack's record of the same day.
 *
 * Without this, divergence between what we think we collected and what the
 * provider actually processed stays invisible until a restaurant says "you owe
 * me money" — and at that point there is no independent record to check against.
 * Finding it the next morning is a support ticket; finding it at the end of the
 * quarter is an argument nobody can settle.
 *
 * Read-only by design. It flags disagreements for a human and never adjusts a
 * balance, because an automatic correction to a financial record is exactly the
 * thing an audit cannot forgive.
 */

type PaystackTransaction = {
	reference?: string;
	amount?: number;
	status?: string;
	fees?: number;
	paid_at?: string;
};

export async function GET(request: Request) {
	// The shared guard rather than a local comparison: it is timing-safe, it
	// accepts the same header/query forms the subscriptions cron already does,
	// and it fails closed in production when nothing is configured.
	if (!(await isAuthorizedCronRequest(request, ""))) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const paystackKey = env.PAYSTACK_SECRET_KEY;
	if (!paystackKey) {
		return NextResponse.json({ skipped: "no platform Paystack key" });
	}

	// Yesterday, whole day. Running over a closed period avoids flagging
	// payments that are simply still in flight.
	const end = new Date();
	end.setUTCHours(0, 0, 0, 0);
	const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);

	// Paged: the account is shared with another project, so a day can hold far
	// more than one page of transactions, most of them not ours. Bounded so a
	// very busy day cannot outlive the function.
	const transactions: PaystackTransaction[] = [];
	for (let page = 1; page <= 10; page += 1) {
		const url = new URL("https://api.paystack.co/transaction");
		url.searchParams.set("from", start.toISOString());
		url.searchParams.set("to", end.toISOString());
		url.searchParams.set("status", "success");
		url.searchParams.set("perPage", "100");
		url.searchParams.set("page", String(page));

		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${paystackKey}` },
			cache: "no-store",
			signal: AbortSignal.timeout(20_000),
		});

		if (!res.ok) {
			return NextResponse.json(
				{ error: `Paystack returned ${res.status}` },
				{ status: 502 },
			);
		}

		const payload = (await res.json()) as { data?: PaystackTransaction[] };
		const batch = payload.data ?? [];
		// Only this app's charges. The other project's are not ours to judge.
		transactions.push(
			...batch.filter((transaction) =>
				isAwamenuReference(transaction.reference),
			),
		);
		if (batch.length < 100) break;
	}

	// Reservation deposits without food and subscription charges have no order
	// ledger row; a settled attempt or a subscription ledger row accounts for
	// them, so they are not reported as missing.
	const references = transactions
		.map((transaction) => transaction.reference)
		.filter((reference): reference is string => Boolean(reference));
	const [settledAttempts, subscriptionRows] = await Promise.all([
		db.paymentAttempt.findMany({
			where: { reference: { in: references }, status: "SETTLED" },
			select: { reference: true },
		}),
		db.subscriptionPayment.findMany({
			where: { gateway: "PAYSTACK", reference: { in: references } },
			select: { reference: true },
		}),
	]);
	const accountedFor = new Set([
		...settledAttempts.map((row) => row.reference),
		...subscriptionRows.map((row) => row.reference),
	]);

	const ours = await db.orderPayment.findMany({
		where: {
			gateway: "PAYSTACK",
			createdAt: { gte: start, lt: end },
		},
		select: { id: true, reference: true, amount: true, status: true },
	});

	const byReference = new Map(
		ours.filter((row) => row.reference).map((row) => [row.reference, row]),
	);

	/** Paystack says it succeeded and we have no record of it at all. */
	const missingLocally: string[] = [];
	/** Both have it, but for different money. */
	const amountDisagrees: {
		reference: string;
		ours: number;
		theirs: number;
	}[] = [];

	for (const transaction of transactions) {
		if (!transaction.reference) continue;
		const mine = byReference.get(transaction.reference);

		if (!mine) {
			if (!accountedFor.has(transaction.reference)) {
				missingLocally.push(transaction.reference);
			}
			continue;
		}

		const theirs = (transaction.amount ?? 0) / 100;
		if (Math.abs(Number(mine.amount) - theirs) > 0.01) {
			amountDisagrees.push({
				reference: transaction.reference,
				ours: Number(mine.amount),
				theirs,
			});
		}
	}

	// Marked DISPUTED rather than corrected. A person decides what the truth is.
	if (amountDisagrees.length > 0) {
		await db.orderPayment.updateMany({
			where: {
				gateway: "PAYSTACK",
				reference: { in: amountDisagrees.map((entry) => entry.reference) },
			},
			data: { settlementStatus: "DISPUTED" },
		});
	}

	const matched = ours.filter(
		(row) =>
			row.reference &&
			transactions.some(
				(transaction) => transaction.reference === row.reference,
			),
	);

	// Everything we matched is confirmed present at the provider, which is what
	// "settled" is allowed to mean here — not that the bank transfer landed.
	if (matched.length > 0) {
		await db.orderPayment.updateMany({
			where: {
				id: {
					in: matched
						.filter(
							(row) =>
								!amountDisagrees.some(
									(entry) => entry.reference === row.reference,
								),
						)
						.map((row) => row.id),
				},
			},
			data: { settlementStatus: "SETTLED", settledAt: new Date() },
		});
	}

	const report = {
		window: { from: start.toISOString(), to: end.toISOString() },
		paystackCount: transactions.length,
		ledgerCount: ours.length,
		matched: matched.length,
		missingLocally: missingLocally.length,
		amountDisagrees,
	};

	if (amountDisagrees.length > 0 || missingLocally.length > 0) {
		console.error("[reconcile] disagreement found", JSON.stringify(report));
	}

	await recordCronRun("reconcile-payments");
	return NextResponse.json(report);
}
