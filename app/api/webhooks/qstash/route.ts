import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyQstashSignature } from "@/lib/qstash";
import { expireNoShow } from "@/lib/reservation-booking";

const qstashPayloadSchema = z.object({
	type: z.literal("EXPIRE_RESERVATION"),
	reservationId: z.string().cuid(),
});

/**
 * The precise no-show trigger, scheduled for each confirmed booking's end.
 *
 * Optional: the reservations cron sweeps the same thing, so a missed or
 * unconfigured QStash only delays the release by one cron interval.
 */
export async function POST(request: Request) {
	const body = await request.text();
	const isVerified = await verifyQstashSignature({
		signature: request.headers.get("upstash-signature"),
		body,
		url: request.url,
	});

	if (!isVerified) {
		return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
	}

	const parsed = qstashPayloadSchema.safeParse(JSON.parse(body));
	if (!parsed.success) {
		// 200 so QStash stops retrying a message that can never succeed.
		return NextResponse.json({ ok: true, ignored: true });
	}

	await expireNoShow(parsed.data.reservationId);
	return NextResponse.json({ ok: true });
}
