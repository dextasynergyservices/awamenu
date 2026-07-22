"use server";

import { NotificationAudience } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";

const fetchNotificationsSchema = z.object({
	restaurantId: z.string().min(1),
	recipientType: z.enum(["admin", "staff"]),
	recipientId: z.string().min(1),
	cursor: z.string().cuid().optional(),
	limit: z.coerce.number().int().min(1).max(50).default(30),
});

/**
 * Fetch paginated notifications for a restaurant.
 * Returns notifications with read status for the given recipient.
 */
export async function fetchNotificationsAction(
	input: z.infer<typeof fetchNotificationsSchema>,
) {
	const parsed = fetchNotificationsSchema.parse(input);

	const notifications = await db.notification.findMany({
		where: {
			restaurantId: parsed.restaurantId,
			audience: {
				in:
					parsed.recipientType === "admin"
						? [NotificationAudience.ADMIN, NotificationAudience.BOTH]
						: [NotificationAudience.STAFF, NotificationAudience.BOTH],
			},
		},
		orderBy: { createdAt: "desc" },
		take: parsed.limit + 1,
		...(parsed.cursor ? { cursor: { id: parsed.cursor }, skip: 1 } : {}),
		select: {
			id: true,
			type: true,
			audience: true,
			title: true,
			body: true,
			actionUrl: true,
			metadata: true,
			createdAt: true,
			reads: {
				where: {
					recipientType: parsed.recipientType,
					recipientId: parsed.recipientId,
				},
				select: { id: true },
			},
		},
	});

	const hasMore = notifications.length > parsed.limit;
	const items = hasMore ? notifications.slice(0, -1) : notifications;
	const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

	return {
		items: items.map((n) => ({
			id: n.id,
			type: n.type,
			audience: n.audience,
			title: n.title,
			body: n.body,
			actionUrl: n.actionUrl,
			metadata: n.metadata as Record<string, unknown> | null,
			createdAt: n.createdAt.toISOString(),
			isRead: n.reads.length > 0,
		})),
		nextCursor,
	};
}

/**
 * Get the unread notification count for a recipient.
 */
export async function getUnreadCountAction(input: {
	restaurantId: string;
	recipientType: "admin" | "staff";
	recipientId: string;
}) {
	const audienceFilter =
		input.recipientType === "admin"
			? [NotificationAudience.ADMIN, NotificationAudience.BOTH]
			: [NotificationAudience.STAFF, NotificationAudience.BOTH];

	const totalCount = await db.notification.count({
		where: {
			restaurantId: input.restaurantId,
			audience: { in: audienceFilter },
		},
	});

	const readCount = await db.notificationRead.count({
		where: {
			recipientType: input.recipientType,
			recipientId: input.recipientId,
			notification: {
				restaurantId: input.restaurantId,
				audience: { in: audienceFilter },
			},
		},
	});

	return totalCount - readCount;
}

const markReadSchema = z.object({
	notificationId: z.string().cuid(),
	recipientType: z.enum(["admin", "staff"]),
	recipientId: z.string().min(1),
});

/**
 * Mark a single notification as read for a recipient.
 */
export async function markNotificationReadAction(
	input: z.infer<typeof markReadSchema>,
) {
	const parsed = markReadSchema.parse(input);

	await db.notificationRead.upsert({
		where: {
			notificationId_recipientType_recipientId: {
				notificationId: parsed.notificationId,
				recipientType: parsed.recipientType,
				recipientId: parsed.recipientId,
			},
		},
		create: {
			notificationId: parsed.notificationId,
			recipientType: parsed.recipientType,
			recipientId: parsed.recipientId,
		},
		update: {},
	});
}

const markAllReadSchema = z.object({
	restaurantId: z.string().min(1),
	recipientType: z.enum(["admin", "staff"]),
	recipientId: z.string().min(1),
});

/**
 * Mark all notifications as read for a recipient.
 * Creates NotificationRead rows for all unread notifications.
 */
export async function markAllNotificationsReadAction(
	input: z.infer<typeof markAllReadSchema>,
) {
	const parsed = markAllReadSchema.parse(input);
	const audienceFilter =
		parsed.recipientType === "admin"
			? [NotificationAudience.ADMIN, NotificationAudience.BOTH]
			: [NotificationAudience.STAFF, NotificationAudience.BOTH];

	// Find all unread notifications
	const unreadNotifications = await db.notification.findMany({
		where: {
			restaurantId: parsed.restaurantId,
			audience: { in: audienceFilter },
			reads: {
				none: {
					recipientType: parsed.recipientType,
					recipientId: parsed.recipientId,
				},
			},
		},
		select: { id: true },
	});

	if (unreadNotifications.length === 0) return;

	// Batch create read records
	await db.notificationRead.createMany({
		data: unreadNotifications.map((n) => ({
			notificationId: n.id,
			recipientType: parsed.recipientType,
			recipientId: parsed.recipientId,
		})),
		skipDuplicates: true,
	});
}
