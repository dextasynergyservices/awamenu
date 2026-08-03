import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStaffSession } from "@/lib/staff-auth";

export type NotificationRecipient = {
	restaurantId: string;
	recipientType: "admin" | "staff";
	recipientId: string;
};

/**
 * Authorises access to a restaurant's notification feed.
 *
 * Server Actions are publicly reachable POST endpoints, so the notification
 * actions cannot trust the `restaurantId`/`recipientId` they're handed — without
 * this, anyone who knows a restaurant id could read that restaurant's
 * notifications (which carry customer names and order details) or mark them
 * read.
 *
 * `recipientId` is deliberately re-derived from the session rather than taken
 * from the caller: an authenticated owner must not be able to read or mutate
 * another recipient's read-state by passing someone else's id.
 */
export async function requireNotificationAccess(
	input: NotificationRecipient,
): Promise<NotificationRecipient> {
	const [session, staffSession] = await Promise.all([
		getSession(),
		getStaffSession(),
	]);

	if (
		input.recipientType === "staff" &&
		staffSession?.restaurantId === input.restaurantId
	) {
		// Staff terminals share one identity per restaurant.
		return { ...input, recipientId: "shared" };
	}

	if (input.recipientType === "admin" && session?.user) {
		const restaurant = await db.restaurant.findFirst({
			where: { id: input.restaurantId, ownerId: session.user.id },
			select: { id: true },
		});

		if (restaurant) {
			return { ...input, recipientId: session.user.id };
		}
	}

	throw new Error("Not authorised for this restaurant's notifications.");
}
