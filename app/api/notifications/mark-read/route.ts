import { NextResponse } from "next/server";
import { z } from "zod";
import { markNotificationReadAction } from "@/actions/notification.actions";

const schema = z.object({
	notificationId: z.string().cuid(),
	recipientType: z.enum(["admin", "staff"]),
	recipientId: z.string().min(1),
});

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const input = schema.parse(body);
		await markNotificationReadAction(input);
		return NextResponse.json({ ok: true });
	} catch (error) {
		if (error instanceof z.ZodError) {
			return NextResponse.json(
				{ error: "Invalid request", details: error.flatten() },
				{ status: 400 },
			);
		}
		return NextResponse.json(
			{ error: "Failed to mark notification as read" },
			{ status: 500 },
		);
	}
}
