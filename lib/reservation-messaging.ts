import { CustomerUpdateChannel } from "@prisma/client";
import { env } from "@/env";
import { db } from "@/lib/db";
import { canDeliverOn, toE164 } from "@/lib/otp-delivery";
import { enqueue } from "@/lib/outbox";
import { getRestaurantPlanFeatures } from "@/lib/plan-features";

/**
 * SMS/WhatsApp to a guest when the restaurant cancels their booking, on the
 * restaurant's chosen customer-update channel (like order updates). The
 * email goes separately (lib/reservation-emails.ts). Sent at most once,
 * claimed before sending: a duplicate message is worse than a missed one.
 */
export async function notifyGuestReservationCancelled(reservationId: string) {
	const reservation = await db.reservation.findUnique({
		where: { id: reservationId },
		select: {
			id: true,
			customerPhone: true,
			restaurant: {
				select: {
					id: true,
					name: true,
					slug: true,
					customerUpdateChannel: true,
				},
			},
		},
	});
	if (!reservation?.customerPhone) return;

	const channel = reservation.restaurant.customerUpdateChannel;
	if (channel === CustomerUpdateChannel.NONE) return;
	if (channel === CustomerUpdateChannel.WHATSAPP) {
		const features = await getRestaurantPlanFeatures(reservation.restaurant.id);
		if (!features.whatsappIntegration) return;
	}
	const transport =
		channel === CustomerUpdateChannel.WHATSAPP ? "whatsapp" : "sms";
	if (!canDeliverOn(transport, "reservation_cancelled")) return;

	const { count } = await db.reservation.updateMany({
		where: { id: reservation.id, cancelledMessageSentAt: null },
		data: { cancelledMessageSentAt: new Date() },
	});
	if (count === 0) return;

	const reference = reservation.id.slice(-6).toUpperCase();
	const link = `${env.NEXT_PUBLIC_APP_URL}/${reservation.restaurant.slug}/reservation/${reservation.id}`;
	await enqueue("MESSAGE", {
		to: toE164(reservation.customerPhone),
		channel: transport,
		// Matches the approved WhatsApp template word for word
		// (docs/whatsapp-templates.md), so SMS and WhatsApp read the same.
		body: `${reservation.restaurant.name}: your table booking #${reference} has been cancelled by the restaurant. See the reason and any refund here: ${link}`,
		template: {
			key: "reservation_cancelled",
			variables: {
				"1": reservation.restaurant.name,
				"2": reference,
				"3": link,
			},
		},
	});
}
