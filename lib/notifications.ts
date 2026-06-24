import type {
	NotificationAudience,
	NotificationType,
	Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";

type DispatchNotificationInput = {
	restaurantId: string;
	type: NotificationType;
	audience: NotificationAudience;
	title: string;
	body: string;
	actionUrl?: string;
	metadata?: Prisma.InputJsonObject;
};

export async function dispatchNotification(input: DispatchNotificationInput) {
	await db.notification.create({
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
}
