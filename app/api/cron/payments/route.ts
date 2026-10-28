import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { recordCronRun } from "@/lib/cron-heartbeat";
import { sweepOutbox } from "@/lib/outbox";
import { sweepPendingPaymentAttempts } from "@/lib/payment-attempts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Confirms payments by asking the provider — the primary confirmation path.
 *
 * AwaMenu cannot rely on webhooks: the Paystack account is shared with another
 * project whose webhook URL it keeps, and restaurants on their own gateway keys
 * send webhooks to their own accounts. Every checkout is recorded as a
 * PaymentAttempt, and this run verifies the pending ones by reference. It
 * catches every customer who paid and closed the tab before returning.
 *
 * Each attempt is checked with back-off (minutes when fresh, hours when old)
 * for up to 24 hours, so provider calls stay roughly flat however many
 * checkouts are abandoned.
 *
 * Also retries the outbox (emails, WhatsApp/SMS, Web Push that failed on
 * their first, after-response attempt) and purges old sent jobs.
 *
 * cron-job.org: GET https://<domain>/api/cron/payments every 5 minutes,
 * header `Authorization: Bearer <CRON_SECRET>`, timeout 60s. Every 5 minutes is
 * the right trade: a paid customer is confirmed within minutes even if they
 * never return, and the run exits early when nothing is pending.
 */
async function run(request: Request) {
	if (!(await isAuthorizedCronRequest(request, ""))) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const payments = await sweepPendingPaymentAttempts({
		limit: 40,
		// Both budgets together stay under cron-job.org's 30-second request
		// timeout, so a run is never reported as failed just for being slow.
		budgetMs: 15_000,
	});
	// The outbox rides on this schedule rather than its own, so retrying
	// failed emails/messages costs no extra database wake-ups.
	const outbox = await sweepOutbox({ limit: 50, budgetMs: 8_000 });
	await recordCronRun("payments");
	return NextResponse.json({ ok: true, payments, outbox });
}

export const GET = run;
export const POST = run;
