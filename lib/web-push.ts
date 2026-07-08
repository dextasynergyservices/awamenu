import * as Sentry from "@sentry/nextjs";
import webPush from "web-push";
import { db } from "@/lib/db";

type SendWebPushInput = {
	restaurantId: string;
	title: string;
	body: string;
	actionUrl?: string;
	audience: "ADMIN" | "STAFF" | "BOTH";
};

function getVapidKeys() {
	const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
	const privateKey = process.env.VAPID_PRIVATE_KEY;
	const email = process.env.VAPID_EMAIL;

	if (!publicKey || !privateKey || !email) return null;

	return { publicKey, privateKey, email };
}

/**
 * Send a Web Push notification to all VAPID subscriptions for a restaurant's
 * admin and/or staff members, depending on the audience.
 *
 * Stale subscriptions (HTTP 410 Gone) are automatically cleaned up.
 */
export async function sendWebPush(input: SendWebPushInput) {
	const vapid = getVapidKeys();
	if (!vapid) return;

	webPush.setVapidDetails(
		`mailto:${vapid.email}`,
		vapid.publicKey,
		vapid.privateKey,
	);

	// Build the where clause based on audience
	const subscriptions = await db.pushSubscription.findMany({
		where: {
			restaurantId: input.restaurantId,
			...(input.audience === "ADMIN"
				? { userId: { not: null } }
				: input.audience === "STAFF"
					? { staffMemberId: { not: null } }
					: {}), // BOTH — no filter, get all
		},
		select: {
			id: true,
			endpoint: true,
			p256dh: true,
			auth: true,
		},
	});

	if (subscriptions.length === 0) return;

	const payload = JSON.stringify({
		title: input.title,
		body: input.body,
		url: input.actionUrl,
	});

	const staleIds: string[] = [];

	await Promise.allSettled(
		subscriptions.map(async (sub) => {
			try {
				await webPush.sendNotification(
					{
						endpoint: sub.endpoint,
						keys: { p256dh: sub.p256dh, auth: sub.auth },
					},
					payload,
					{ TTL: 86_400 },
				);
			} catch (error) {
				// 410 Gone = subscription expired, clean it up
				if (error instanceof webPush.WebPushError && error.statusCode === 410) {
					staleIds.push(sub.id);
				} else {
					Sentry.captureException(error, {
						tags: { component: "web-push" },
						extra: { restaurantId: input.restaurantId, endpoint: sub.endpoint },
					});
				}
			}
		}),
	);

	// Clean up stale subscriptions
	if (staleIds.length > 0) {
		await db.pushSubscription
			.deleteMany({ where: { id: { in: staleIds } } })
			.catch((error) => Sentry.captureException(error));
	}
}
