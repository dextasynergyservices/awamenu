import type { PaymentMethod, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Reads the payment ledger for reporting.
 *
 * Everything here derives from OrderPayment rather than from Order, because the
 * order carries a status while the ledger carries the money. Reporting off
 * `Order.paymentStatus` would count an order once at its total no matter what
 * was actually collected, which is exactly the disagreement a restaurant would
 * find at the end of the month and be unable to explain.
 */

export type LedgerRow = {
	id: string;
	createdAt: Date;
	orderId: string;
	orderRef: string;
	direction: "CREDIT" | "REFUND";
	status: string;
	method: PaymentMethod;
	gateway: string | null;
	reference: string | null;
	gross: number;
	gatewayFee: number | null;
	platformFee: number | null;
	net: number | null;
	settlementStatus: string;
	note: string | null;
};

export type FinancialSummary = {
	/** Money in, less refunds. Only entries that actually matched. */
	netCollected: number;
	grossCollected: number;
	refunded: number;
	gatewayFees: number;
	platformFees: number;
	/** What should reach the restaurant's bank, after every deduction. */
	payoutExpected: number;
	transactionCount: number;
	/** Entries the gateway reported but which failed the amount check. */
	mismatchCount: number;
	byMethod: { method: string; amount: number; count: number }[];
};

const num = (value: Prisma.Decimal | null) => (value ? value.toNumber() : 0);

/** Inclusive of both endpoints, in the server's timezone. */
export function parseDateRange(from?: string | null, to?: string | null) {
	const end = to ? new Date(`${to}T23:59:59.999`) : new Date();
	const start = from
		? new Date(`${from}T00:00:00.000`)
		: new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);

	// A reversed range returns nothing and looks like a bug in the data rather
	// than a typo in the filter, so it is corrected rather than obeyed.
	return start > end ? { start: end, end: start } : { start, end };
}

export async function getLedgerRows(
	restaurantId: string,
	range: { start: Date; end: Date },
): Promise<LedgerRow[]> {
	const entries = await db.orderPayment.findMany({
		where: {
			restaurantId,
			createdAt: { gte: range.start, lte: range.end },
		},
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			createdAt: true,
			orderId: true,
			direction: true,
			status: true,
			method: true,
			gateway: true,
			reference: true,
			amount: true,
			gatewayFee: true,
			platformFee: true,
			netToRestaurant: true,
			settlementStatus: true,
			note: true,
		},
	});

	return entries.map((entry) => ({
		id: entry.id,
		createdAt: entry.createdAt,
		orderId: entry.orderId,
		orderRef: `#${entry.orderId.slice(-6).toUpperCase()}`,
		direction: entry.direction,
		status: entry.status,
		method: entry.method,
		gateway: entry.gateway,
		reference: entry.reference,
		gross: num(entry.amount),
		gatewayFee: entry.gatewayFee ? num(entry.gatewayFee) : null,
		platformFee: entry.platformFee ? num(entry.platformFee) : null,
		net: entry.netToRestaurant ? num(entry.netToRestaurant) : null,
		settlementStatus: entry.settlementStatus,
		note: entry.note,
	}));
}

export function summarise(rows: LedgerRow[]): FinancialSummary {
	// A reversed credit still counts as collected — it was — and the matching
	// refund row is what takes it back out. Dropping it here would understate
	// gross takings and double-count the refund.
	const credits = rows.filter(
		(row) =>
			row.direction === "CREDIT" &&
			(row.status === "SUCCESS" || row.status === "REVERSED"),
	);
	const refunds = rows.filter(
		(row) => row.direction === "REFUND" && row.status === "SUCCESS",
	);

	const grossCollected = credits.reduce((sum, row) => sum + row.gross, 0);
	const refunded = refunds.reduce((sum, row) => sum + row.gross, 0);
	const gatewayFees = credits.reduce(
		(sum, row) => sum + (row.gatewayFee ?? 0),
		0,
	);
	const platformFees = credits.reduce(
		(sum, row) => sum + (row.platformFee ?? 0),
		0,
	);

	const byMethod = new Map<string, { amount: number; count: number }>();
	for (const row of credits) {
		const key = row.gateway ? `${row.method} (${row.gateway})` : row.method;
		const current = byMethod.get(key) ?? { amount: 0, count: 0 };
		byMethod.set(key, {
			amount: current.amount + row.gross,
			count: current.count + 1,
		});
	}

	return {
		grossCollected,
		refunded,
		netCollected: grossCollected - refunded,
		gatewayFees,
		platformFees,
		// Cash never passes through a gateway, so it has no net figure — it is
		// already in the till and counts toward the payout in full.
		payoutExpected:
			credits.reduce((sum, row) => sum + (row.net ?? row.gross), 0) - refunded,
		transactionCount: credits.length,
		mismatchCount: rows.filter((row) => row.status === "MISMATCH").length,
		byMethod: [...byMethod.entries()]
			.map(([method, value]) => ({ method, ...value }))
			.sort((a, b) => b.amount - a.amount),
	};
}

const csvCell = (value: string | number | null) => {
	if (value === null) return "";
	const text = String(value);
	// Excel treats a leading =, +, - or @ as a formula. Prefixing breaks that
	// without changing what a human reads.
	const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
	return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** A bookkeeper's export: one row per movement, no derived totals. */
export function toCsv(rows: LedgerRow[]): string {
	const header = [
		"Date",
		"Order",
		"Direction",
		"Status",
		"Method",
		"Provider",
		"Reference",
		"Gross (NGN)",
		"Gateway fee",
		"Platform fee",
		"Net to you",
		"Settlement",
		"Note",
	];

	const body = rows.map((row) =>
		[
			row.createdAt.toISOString(),
			row.orderRef,
			row.direction,
			row.status,
			row.method,
			row.gateway ?? "",
			row.reference ?? "",
			row.gross.toFixed(2),
			row.gatewayFee?.toFixed(2) ?? "",
			row.platformFee?.toFixed(2) ?? "",
			row.net?.toFixed(2) ?? "",
			row.settlementStatus,
			row.note ?? "",
		]
			.map(csvCell)
			.join(","),
	);

	return [header.map(csvCell).join(","), ...body].join("\n");
}
