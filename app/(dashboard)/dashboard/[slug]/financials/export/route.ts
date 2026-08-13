import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { getLedgerRows, parseDateRange, toCsv } from "@/lib/financials";

/**
 * Downloads the payment ledger as CSV.
 *
 * Owner-only, and scoped by ownerId in the same query that finds the restaurant
 * — a slug in the URL is a guess, not a permission. Staff must never reach this:
 * takings are the owner's business, not the till's.
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ slug: string }> },
) {
	const user = await requireUser();
	const { slug } = await params;

	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		select: { id: true, name: true },
	});

	if (!restaurant) {
		return new Response("Not found", { status: 404 });
	}

	const url = new URL(request.url);
	const range = parseDateRange(
		url.searchParams.get("from"),
		url.searchParams.get("to"),
	);

	const rows = await getLedgerRows(restaurant.id, range);
	const stamp = (date: Date) => date.toISOString().slice(0, 10);
	const filename = `${slug}-payments-${stamp(range.start)}-to-${stamp(range.end)}.csv`;

	return new Response(toCsv(rows), {
		headers: {
			"Content-Type": "text/csv; charset=utf-8",
			"Content-Disposition": `attachment; filename="${filename}"`,
			// Financial data should not sit in a shared cache.
			"Cache-Control": "no-store, private",
		},
	});
}
