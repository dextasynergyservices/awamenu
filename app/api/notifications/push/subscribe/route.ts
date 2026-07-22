import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const subscribeSchema = z.object({
	restaurantId: z.string().min(1),
	endpoint: z.string().url(),
	p256dh: z.string().min(1),
	auth: z.string().min(1),
	recipientType: z.enum(["admin", "staff"]),
	recipientId: z.string().min(1),
	userAgent: z.string().optional(),
});

/**
 * Save a Web Push subscription for a user or staff member.
 * Upserts by endpoint so re-subscribing doesn't create duplicates.
 */
export async function POST(request: Request) {
	try {
		const body = await request.json();
		const input = subscribeSchema.parse(body);

		await db.pushSubscription.upsert({
			where: { endpoint: input.endpoint },
			create: {
				restaurantId: input.restaurantId,
				endpoint: input.endpoint,
				p256dh: input.p256dh,
				auth: input.auth,
				userAgent: input.userAgent,
				...(input.recipientType === "admin"
					? { userId: input.recipientId }
					: { staffMemberId: input.recipientId }),
			},
			update: {
				p256dh: input.p256dh,
				auth: input.auth,
				userAgent: input.userAgent,
			},
		});

		return NextResponse.json({ ok: true });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: "Invalid subscription data", details: error.flatten() },
				{ status: 400 },
			);
		}
		return NextResponse.json(
			{ error: "Failed to save subscription" },
			{ status: 500 },
		);
	}
}
