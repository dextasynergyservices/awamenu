import { NextResponse } from "next/server";
import { z } from "zod";
import { markAllNotificationsReadAction } from "@/actions/notification.actions";
import { db } from "@/lib/db";

const schema = z.object({
	slug: z.string().min(1),
	recipientType: z.enum(["admin", "staff"]),
	recipientId: z.string().min(1),
});

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const input = schema.parse(body);

		// Look up restaurantId from slug
		const restaurant = await db.restaurant.findFirst({
			where: { slug: input.slug },
			select: { id: true },
		});

		if (!restaurant) {
			return NextResponse.json(
				{ error: "Restaurant not found" },
				{ status: 404 },
			);
		}

		await markAllNotificationsReadAction({
			restaurantId: restaurant.id,
			recipientType: input.recipientType,
			recipientId: input.recipientId,
		});

		return NextResponse.json({ ok: true });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: "Invalid request", details: error.flatten() },
				{ status: 400 },
			);
		}
		return NextResponse.json(
			{ error: "Failed to mark notifications as read" },
			{ status: 500 },
		);
	}
}
