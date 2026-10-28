import type { OutboxJob, OutboxJobKind, Prisma } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { after } from "next/server";
import type { ReactElement } from "react";
import { renderEmail } from "@/emails/render";
import { db } from "@/lib/db";
import { getResendClient } from "@/lib/email";
import { sendTwilioMessage } from "@/lib/otp-delivery";
import { sendWebPush } from "@/lib/web-push";
import type { WhatsAppTemplate } from "@/lib/whatsapp-templates";

/**
 * The outbox: emails, WhatsApp/SMS and Web Push, delivered after the response.
 *
 * Side effects used to run inline, in the request, after the database write.
 * A slow email provider made a customer wait to see "order placed", and a
 * failed send was simply lost — Resend reports failures by *returning*
 * `{ error }`, which nothing checked.
 *
 * Now a side effect is one database insert. It is sent right after the
 * response (`after()`), and if that fails it is retried with backoff by the
 * payments cron, up to `maxAttempts`, then marked DEAD and reported. Emails
 * carry the job id as Resend's idempotency key, so a retry after a crash
 * can never deliver the same email twice.
 *
 * Sends the person is actively waiting for — sign-in and password-reset codes,
 * email verification — stay synchronous, so a failure is shown to them.
 */

export type EmailJob = {
	from: string;
	to: string | string[];
	subject: string;
	text?: string;
	html?: string;
	replyTo?: string | string[];
};

export type MessageJob = {
	to: string;
	channel: "whatsapp" | "sms";
	body: string;
	/** WhatsApp's approved template and its variables. */
	template?: WhatsAppTemplate;
};

export type WebPushJob = Parameters<typeof sendWebPush>[0];

type Payloads = {
	EMAIL: EmailJob;
	MESSAGE: MessageJob;
	WEB_PUSH: WebPushJob;
};

const LOCK_MS = 2 * 60_000;
/** Backoff after each failed attempt: 1m, 5m, 15m, 1h, 3h. */
const BACKOFF_MS = [
	60_000,
	5 * 60_000,
	15 * 60_000,
	60 * 60_000,
	3 * 60 * 60_000,
];
const RETENTION_MS = 14 * 24 * 60 * 60_000;

export async function enqueue<K extends OutboxJobKind>(
	kind: K,
	payload: Payloads[K],
) {
	const job = await db.outboxJob.create({
		data: { kind, payload: payload as Prisma.InputJsonValue },
		select: { id: true },
	});

	try {
		// After the response has been sent; on Vercel the function stays alive
		// for it (waitUntil).
		after(() => processJob(job.id));
	} catch {
		// Outside a request (a script, a test): send now, without blocking.
		void processJob(job.id);
	}
	return job.id;
}

/**
 * A drop-in for `getResendClient()` that queues instead of sending, so the
 * email modules switch over without rewriting each template. React Email
 * templates are rendered now, because a queued payload must be plain JSON.
 */
export function getQueuedMailer() {
	return {
		emails: {
			async send(
				message: EmailJob & { react?: ReactElement },
			): Promise<{ data: { id: string }; error: null }> {
				const { react, ...rest } = message;
				const rendered = react ? await renderEmail(react) : null;
				const id = await enqueue("EMAIL", {
					...rest,
					html: rendered?.html ?? rest.html,
					text: rest.text ?? rendered?.text,
				});
				return { data: { id }, error: null };
			},
		},
	};
}

async function deliver(job: OutboxJob) {
	switch (job.kind) {
		case "EMAIL": {
			const email = job.payload as unknown as EmailJob;
			const { error } = await getResendClient().emails.send(
				{
					from: email.from,
					to: email.to,
					subject: email.subject,
					replyTo: email.replyTo,
					...(email.html ? { html: email.html } : { text: email.text ?? "" }),
					...(email.html && email.text ? { text: email.text } : {}),
				},
				{ idempotencyKey: `outbox-${job.id}` },
			);
			if (error) throw new Error(`Resend: ${error.message}`);
			return;
		}
		case "MESSAGE": {
			const message = job.payload as unknown as MessageJob;
			const result = await sendTwilioMessage(message);
			if ("error" in result) throw new Error(`Twilio: ${result.error}`);
			return;
		}
		case "WEB_PUSH": {
			await sendWebPush(job.payload as unknown as WebPushJob);
			return;
		}
	}
}

/**
 * Sends one job, if it is due and nobody else holds it.
 *
 * The claim is a conditional update, so the after-response send and a cron
 * sweep can't both send the same job; a sender that crashes mid-send releases
 * it when `lockedUntil` passes.
 */
export async function processJob(
	jobId: string,
): Promise<"SENT" | "RETRY" | "DEAD" | "SKIPPED"> {
	const now = new Date();
	const claimed = await db.outboxJob.updateMany({
		where: {
			id: jobId,
			runAfter: { lte: now },
			OR: [
				{ status: { in: ["PENDING", "FAILED"] } },
				{ status: "SENDING", lockedUntil: { lt: now } },
			],
		},
		data: {
			status: "SENDING",
			lockedUntil: new Date(now.getTime() + LOCK_MS),
			attempts: { increment: 1 },
		},
	});
	if (claimed.count === 0) return "SKIPPED";

	const job = await db.outboxJob.findUniqueOrThrow({ where: { id: jobId } });

	try {
		await deliver(job);
		await db.outboxJob.update({
			where: { id: job.id },
			data: {
				status: "SENT",
				sentAt: new Date(),
				lockedUntil: null,
				lastError: null,
			},
		});
		return "SENT";
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const dead = job.attempts >= job.maxAttempts;
		await db.outboxJob.update({
			where: { id: job.id },
			data: {
				status: dead ? "DEAD" : "FAILED",
				lockedUntil: null,
				lastError: message.slice(0, 1000),
				runAfter: dead
					? job.runAfter
					: new Date(
							Date.now() +
								BACKOFF_MS[Math.min(job.attempts - 1, BACKOFF_MS.length - 1)],
						),
			},
		});
		if (dead) {
			Sentry.captureException(error, {
				tags: { component: "outbox", kind: job.kind },
				extra: { jobId: job.id, attempts: job.attempts },
			});
		}
		return dead ? "DEAD" : "RETRY";
	}
}

/**
 * Retries anything due and clears out old sent jobs. Run from the payments
 * cron, so the outbox costs no extra database wake-ups.
 */
export async function sweepOutbox(
	options: { limit?: number; budgetMs?: number } = {},
) {
	const started = Date.now();
	const now = new Date(started);

	const due = await db.outboxJob.findMany({
		where: {
			runAfter: { lte: now },
			OR: [
				// The after-response send normally handles PENDING within seconds;
				// anything still pending a minute later lost that send.
				{ status: "PENDING", createdAt: { lte: new Date(started - 60_000) } },
				{ status: "FAILED" },
				{ status: "SENDING", lockedUntil: { lt: now } },
			],
		},
		orderBy: { runAfter: "asc" },
		select: { id: true },
		take: options.limit ?? 50,
	});

	const tally = { sent: 0, retrying: 0, dead: 0 };
	for (const job of due) {
		if (Date.now() - started > (options.budgetMs ?? 20_000)) break;
		const result = await processJob(job.id);
		if (result === "SENT") tally.sent += 1;
		else if (result === "RETRY") tally.retrying += 1;
		else if (result === "DEAD") tally.dead += 1;
	}

	const { count: purged } = await db.outboxJob.deleteMany({
		where: { status: "SENT", sentAt: { lt: new Date(started - RETENTION_MS) } },
	});

	return { ...tally, purged };
}
