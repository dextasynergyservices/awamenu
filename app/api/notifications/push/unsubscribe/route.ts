import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const unsubscribeSchema = z.object({
	endpoint: z.string().url(),
});

/**
 * Remove a Web Push subscription by its endpoint URL.
 */
export async function POST(request: Request) {
	try {
		const body = await request.json();
		const input = unsubscribeSchema.parse(body);

		await db.pushSubscription.deleteMany({
			where: { endpoint: input.endpoint },
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
			{ error: "Failed to remove subscription" },
			{ status: 500 },
		);
	}
}
