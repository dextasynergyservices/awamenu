import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Version stamp for a customer's order page (components/shared/LiveStatusPoller).
 *
 * One indexed primary-key read returning a single number, instead of a full
 * page render every few seconds. Every change a customer can see — status,
 * payment, items added — moves the order's `updatedAt`. Reveals nothing beyond
 * "something changed", so it needs no more protection than the order page.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ orderId: string }> },
) {
	const { orderId } = await params;
	const order = await db.order.findUnique({
		where: { id: orderId },
		select: { updatedAt: true },
	});

	return NextResponse.json(
		{ v: order ? order.updatedAt.getTime() : 0 },
		{ headers: { "Cache-Control": "no-store" } },
	);
}
