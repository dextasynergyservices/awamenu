import type {
	NotificationAudience,
	NotificationType,
	Prisma,
} from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { sendWebPush } from "@/lib/web-push";

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

	// Fire-and-forget web push. The Redis publish that used to sit here fed the
	// SSE stream; dashboards now poll this table directly, so mirroring every
	// notification into Redis was three wasted commands per notification with
	// no reader.
	const sideEffects = Promise.allSettled([
		sendWebPush({
			restaurantId: input.restaurantId,
			title: input.title,
			body: input.body,
			actionUrl: input.actionUrl,
			audience: input.audience,
		}).catch((error) => {
			Sentry.captureException(error, {
				tags: { component: "notification-web-push" },
			});
		}),
	]);

	// Don't await in production-critical paths — but do await in
	// non-critical contexts so errors are captured
	sideEffects.catch(() => {});

	return notification;
}
