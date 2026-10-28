import type {
	NotificationAudience,
	NotificationType,
	Prisma,
} from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { enqueue } from "@/lib/outbox";

type DispatchNotificationInput = {
	restaurantId: string;
	type: NotificationType;
	audience: NotificationAudience;
	title: string;
	body: string;
	actionUrl?: string;
	metadata?: Prisma.InputJsonObject;
};

/**
 * Central notification dispatcher.
 *
 * 1. Persists the notification to the database
 * 2. Publishes to Redis for SSE real-time delivery
 * 3. Sends Web Push to all VAPID subscriptions
 *
 * Steps 2 and 3 are fire-and-forget — failures are logged to Sentry
 * but don't block the caller.
 *
 * Audience: tell the people who didn't act. The owner doing something goes to
 * STAFF; a staff member doing something goes to ADMIN; a guest or the system
 * goes to whoever needs to act (often BOTH). Telling someone about the thing
 * they just did is noise, and trains them to ignore the bell.
 */
export async function dispatchNotification(input: DispatchNotificationInput) {
	const notification = await db.notification.create({
		data: {
			restaurantId: input.restaurantId,
			type: input.type,
			audience: input.audience,
			title: input.title,
			body: input.body,
			actionUrl: input.actionUrl,
			metadata: input.metadata,
		},
	});

	// Web Push goes through the outbox. It used to be an un-awaited promise,
	// which a serverless function is free to freeze the moment the response is
	// sent — pushes could vanish without an error. Queued, it is sent right
	// after the response and retried if it fails.
	try {
		await enqueue("WEB_PUSH", {
			restaurantId: input.restaurantId,
			title: input.title,
			body: input.body,
			actionUrl: input.actionUrl,
			audience: input.audience,
		});
	} catch (error) {
		// The in-app notification is already saved; a failed queue insert must
		// not fail the action that raised it.
		Sentry.captureException(error, {
			tags: { component: "notification-web-push" },
		});
	}

	return notification;
}

const RETENTION_DAYS = 90;

/**
 * Deletes notifications older than 90 days (their read receipts cascade).
 * Unread counts are computed over the whole table, so without this every
 * bell check slows down as a restaurant ages.
 */
export async function purgeOldNotifications() {
	const { count } = await db.notification.deleteMany({
		where: {
			createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 86_400_000) },
		},
	});
	return count;
}
