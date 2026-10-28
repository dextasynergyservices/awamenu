import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Proof that AwaMenu Pay commission is actually collected.
 *
 * For every AwaMenu Pay payment the ledger records the commission AwaMenu
 * expected (at the rate the charge was made at). Paystack's own transaction
 * record, stored with the payment, says what it actually split:
 * `fees_split.integration` is AwaMenu's share after Paystack's fee, and
 * `fees_split.subaccount` the restaurant's. Comparing the two shows the
 * commission was enforced, payment by payment.
 *
 * A small difference is normal: the provider fee is estimated when the charge
 * starts and Paystack's real fee can differ by kobo. Anything beyond ₦100 or
 * 1% of the payment is flagged.
 *
 * Providers that don't report a split (Monnify) are counted but marked
 * unverifiable.
 */

const received = Prisma.sql`(("rawPayload"->'fees_split'->>'integration')::numeric / 100)`;
const verifiable = Prisma.sql`("rawPayload"->'fees_split'->>'integration') IS NOT NULL`;
const mismatch = Prisma.sql`${verifiable} AND abs(${received} - coalesce("platformFee", 0)) > greatest(100, amount * 0.01)`;
const awamenuPay = Prisma.sql`direction = 'CREDIT' AND status = 'SUCCESS' AND "subaccountCode" IS NOT NULL`;

export async function getCommissionAudit(from: Date) {
	const [byRestaurant, recentMismatches] = await Promise.all([
		db.$queryRaw<
			{
				restaurantId: string;
				payments: number;
				gross: number;
				expected: number;
				expectedVerified: number;
				received: number | null;
				verifiable: number;
				mismatches: number;
			}[]
		>`
			SELECT "restaurantId",
				count(*)::int AS payments,
				sum(amount)::float AS gross,
				coalesce(sum("platformFee"), 0)::float AS expected,
				coalesce(sum("platformFee") FILTER (WHERE ${verifiable}), 0)::float AS "expectedVerified",
				sum(${received}) FILTER (WHERE ${verifiable})::float AS received,
				count(*) FILTER (WHERE ${verifiable})::int AS verifiable,
				count(*) FILTER (WHERE ${mismatch})::int AS mismatches
			FROM "OrderPayment"
			WHERE ${awamenuPay} AND "createdAt" >= ${from}
			GROUP BY 1`,
		db.$queryRaw<
			{
				id: string;
				createdAt: Date;
				restaurantId: string;
				orderId: string;
				amount: number;
				expected: number;
				received: number;
			}[]
		>`
			SELECT id, "createdAt", "restaurantId", "orderId", amount::float AS amount,
				coalesce("platformFee", 0)::float AS expected, ${received}::float AS received
			FROM "OrderPayment"
			WHERE ${awamenuPay} AND "createdAt" >= ${from} AND ${mismatch}
			ORDER BY "createdAt" DESC
			LIMIT 20`,
	]);

	const restaurants = await db.restaurant.findMany({
		where: {
			id: {
				in: [
					...new Set(
						[...byRestaurant, ...recentMismatches].map((r) => r.restaurantId),
					),
				],
			},
		},
		select: {
			id: true,
			name: true,
			slug: true,
			commissionPercentOverride: true,
		},
	});
	const named = new Map(restaurants.map((r) => [r.id, r]));

	const rows = byRestaurant
		.map((r) => ({
			...r,
			restaurant: named.get(r.restaurantId) ?? null,
			variance: r.received === null ? null : r.received - r.expectedVerified,
			effectiveRate: r.gross > 0 ? (r.expected / r.gross) * 100 : 0,
		}))
		.sort((a, b) => b.gross - a.gross);

	const sum = (pick: (r: (typeof rows)[number]) => number) =>
		rows.reduce((t, r) => t + pick(r), 0);
	return {
		rows,
		mismatches: recentMismatches.map((m) => ({
			...m,
			restaurant: named.get(m.restaurantId) ?? null,
		})),
		totals: {
			payments: sum((r) => r.payments),
			gross: sum((r) => r.gross),
			expected: sum((r) => r.expected),
			expectedVerified: sum((r) => r.expectedVerified),
			received: sum((r) => r.received ?? 0),
			verifiable: sum((r) => r.verifiable),
			mismatches: sum((r) => r.mismatches),
		},
	};
}
