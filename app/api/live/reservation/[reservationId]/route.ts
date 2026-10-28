import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Version stamp for a guest's reservation page. Approval, payment, release
 * and check-in all move the reservation's `updatedAt`. See the order variant.
 */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ reservationId: string }> },
) {
	const { reservationId } = await params;
	const reservation = await db.reservation.findUnique({
		where: { id: reservationId },
		select: { updatedAt: true },
	});

	return NextResponse.json(
		{ v: reservation ? reservation.updatedAt.getTime() : 0 },
		{ headers: { "Cache-Control": "no-store" } },
	);
}
