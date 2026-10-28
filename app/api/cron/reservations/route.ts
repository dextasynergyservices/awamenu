import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { recordCronRun } from "@/lib/cron-heartbeat";
import {
	expireNoShows,
	expireUnansweredRequests,
	releaseLapsedPaymentHolds,
} from "@/lib/reservation-booking";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Reservation housekeeping, triggered by cron-job.org.
 *
 * Not what keeps bookings correct — a lapsed hold stops blocking its table the
 * moment its deadline passes, and is swept inline before any booking write
 * (lib/reservation-booking.ts). This run makes the lapse *visible*: it moves
 * rows to EXPIRED, cancels unpaid pre-orders, and tells the guest and the
 * restaurant. So a slow schedule only delays those messages; it never causes
 * a double booking or a lost table.
 *
 * Suggested schedule: every 10 minutes. More often buys little, and on Neon's
 * free tier a job that wakes the database every few minutes keeps compute from
 * ever suspending, which spends the monthly compute allowance.
 *
 * cron-job.org setup: URL https://<domain>/api/cron/reservations, method GET,
 * header `Authorization: Bearer <CRON_SECRET>`, timeout 30s.
 *
 * Bounded per run (100 of each), so a backlog drains over a few runs instead of
 * one run outliving its function timeout.
 */
async function run(request: Request) {
	if (!(await isAuthorizedCronRequest(request, ""))) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const now = new Date();
	const released = await releaseLapsedPaymentHolds({ now });
	const unanswered = await expireUnansweredRequests({ now });
	const noShows = await expireNoShows({ now });

	await recordCronRun("reservations");
	return NextResponse.json({
		ok: true,
		ranAt: now.toISOString(),
		releasedUnpaidHolds: released,
		expiredUnansweredRequests: unanswered,
		expiredNoShows: noShows,
	});
}

export const GET = run;
export const POST = run;
