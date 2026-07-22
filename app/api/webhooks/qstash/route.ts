import {
	NotificationAudience,
	NotificationType,
	ReservationStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";
import { verifyQstashSignature } from "@/lib/qstash";

const qstashPayloadSchema = z.object({
	type: z.literal("EXPIRE_RESERVATION"),
	reservationId: z.string().cuid(),
});

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

	const payload = qstashPayloadSchema.parse(JSON.parse(body));
	const reservation = await db.reservation.findUnique({
		where: { id: payload.reservationId },
		select: {
			id: true,
			status: true,
			expiresAt: true,
			restaurantId: true,
			customerName: true,
			table: { select: { label: true } },
			restaurant: { select: { slug: true } },
		},
	});

	if (!reservation) {
		return NextResponse.json({ ok: true });
	}

	if (
		reservation.status !== ReservationStatus.ACTIVE ||
		reservation.expiresAt > new Date()
	) {
		return NextResponse.json({ ok: true });
	}

	await db.reservation.update({
		where: { id: reservation.id },
		data: {
			status: ReservationStatus.EXPIRED,
			qstashMessageId: null,
		},
	});

	await dispatchNotification({
		restaurantId: reservation.restaurantId,
		type: NotificationType.RESERVATION_EXPIRED,
		audience: NotificationAudience.ADMIN,
		title: "Reservation expired",
		body: `${reservation.customerName}'s reservation for ${reservation.table.label} expired`,
		actionUrl: `/dashboard/${reservation.restaurant.slug}/reservations?reservationId=${reservation.id}`,
		metadata: { reservationId: reservation.id },
	});

	return NextResponse.json({ ok: true });
}
