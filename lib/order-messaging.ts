import { CustomerUpdateChannel, OrderStatus, OrderType } from "@prisma/client";
import { env } from "@/env";
import { db } from "@/lib/db";
import { canDeliverOn, toE164 } from "@/lib/otp-delivery";
import { enqueue } from "@/lib/outbox";
import { getRestaurantPlanFeatures } from "@/lib/plan-features";
import type { WhatsAppTemplateKey } from "@/lib/whatsapp-templates";

/**
 * Automatic WhatsApp/SMS updates to the customer as their order progresses.
 *
 * Deliberately separate from the `wa.me` links staff and admin click by hand —
 * those open the restaurant's own WhatsApp and are untouched. These go out on
 * AwaMenu's Twilio sender, so the restaurant's name has to be carried in the
 * message body rather than the sender: Twilio allows one WhatsApp Business
 * Account per (sub)account, and a sender per restaurant would mean a Twilio
 * subaccount plus Meta business verification for each one.
 *
 * Milestones only. A message for every status change trains customers to
 * ignore the channel, and on WhatsApp it risks the number being reported.
 */

const NOTIFIED_STATUSES = [
	OrderStatus.CONFIRMED,
	OrderStatus.READY,
	OrderStatus.DELIVERED,
	OrderStatus.COMPLETED,
] as const;

type NotifiedStatus = (typeof NOTIFIED_STATUSES)[number];

export function isCustomerNotifiableStatus(
	status: OrderStatus,
): status is NotifiedStatus {
	return (NOTIFIED_STATUSES as readonly OrderStatus[]).includes(status);
}

/**
 * The message body, in the customer's terms.
 *
 * "Ready" means something different for delivery than for pickup, and a
 * customer who reads "your order is ready" while waiting at home for a rider
 * will call the restaurant. Worth the extra branches.
 */
function composeMessage(input: {
	status: NotifiedStatus;
	type: OrderType;
	restaurantName: string;
	reference: string;
	orderUrl: string;
}): { body: string; templateKey: WhatsAppTemplateKey } {
	const { restaurantName, reference, type, orderUrl } = input;
	const prefix = `${restaurantName}: order #${reference}`;

	// Each body matches its approved WhatsApp template word for word (see
	// docs/whatsapp-templates.md), with {{1}} restaurant, {{2}} reference and
	// {{3}} link — so SMS and WhatsApp customers read the same message.
	if (input.status === OrderStatus.CONFIRMED) {
		return {
			templateKey: "order_confirmed",
			body: `${prefix} is confirmed and we've started on it. Track it here: ${orderUrl}`,
		};
	}

	if (input.status === OrderStatus.READY) {
		if (type === OrderType.DELIVERY) {
			return {
				templateKey: "order_on_the_way",
				body: `${prefix} is packed and on its way to you. Track it here: ${orderUrl}`,
			};
		}
		if (type === OrderType.PICKUP) {
			return {
				templateKey: "order_ready_pickup",
				body: `${prefix} is ready for pickup. Show this reference when you arrive: ${orderUrl}`,
			};
		}
		if (type === OrderType.TABLE_RESERVATION) {
			return {
				templateKey: "reservation_table_ready",
				body: `${prefix}: your table is ready. Details: ${orderUrl}`,
			};
		}
		return {
			templateKey: "order_ready_table",
			body: `${prefix} is ready and coming to your table. Details: ${orderUrl}`,
		};
	}

	if (input.status === OrderStatus.DELIVERED) {
		return {
			templateKey: "order_delivered",
			body: `${prefix} has been delivered. Enjoy! Rate your order: ${orderUrl}`,
		};
	}

	// COMPLETED
	if (type === OrderType.TABLE_RESERVATION) {
		return {
			templateKey: "reservation_completed",
			body: `${prefix}: your reservation is complete. Thank you for visiting. Rate it here: ${orderUrl}`,
		};
	}
	return {
		templateKey: "order_completed",
		body: `${prefix} is complete. Thank you for ordering. Rate your order: ${orderUrl}`,
	};
}

/**
 * Sends the milestone update, at most once per order per status.
 *
 * Safe to call from every path that can move an order — admin, staff and the
 * payment webhook all reach CONFIRMED, and the unique key on
 * (orderId, status) is what stops a customer getting the same message three
 * times. The row is written *before* sending for the same reason receipts are
 * claimed first: a duplicate message is worse than a missed one.
 */
export async function notifyCustomerOrderStatus(
	orderId: string,
	status: OrderStatus,
) {
	if (!isCustomerNotifiableStatus(status)) return;

	const order = await db.order.findUnique({
		where: { id: orderId },
		select: {
			id: true,
			type: true,
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

	if (!order?.customerPhone) return;

	const channel = order.restaurant.customerUpdateChannel;
	if (channel === CustomerUpdateChannel.NONE) return;

	// WhatsApp is a paid-plan feature per the pricing page. This resolver also
	// downgrades a lapsed subscription to Free, so a restaurant that stopped
	// paying stops sending.
	if (channel === CustomerUpdateChannel.WHATSAPP) {
		const features = await getRestaurantPlanFeatures(order.restaurant.id);
		if (!features.whatsappIntegration) return;
	}

	const transport =
		channel === CustomerUpdateChannel.WHATSAPP ? "whatsapp" : "sms";

	// Checked BEFORE claiming the slot. Claiming first would mark the milestone
	// as messaged while no sender number exists, so the customer would never get
	// it — not even once a number is bought. Silent by design: an unconfigured
	// platform isn't an error worth paging anyone about.
	const reference = order.id.slice(-6).toUpperCase();
	const orderUrl = `${env.NEXT_PUBLIC_APP_URL}/${order.restaurant.slug}/order/${order.id}`;
	const message = composeMessage({
		status,
		type: order.type,
		restaurantName: order.restaurant.name,
		reference,
		orderUrl,
	});

	// WhatsApp also needs this message's template approved; without it the send
	// would be rejected, so the milestone is skipped rather than claimed.
	if (!canDeliverOn(transport, message.templateKey)) return;

	// Claim next: a second caller for the same milestone hits the unique
	// constraint and stops here rather than sending again.
	try {
		await db.orderMessage.create({
			data: {
				orderId: order.id,
				status,
				channel,
			},
		});
	} catch {
		return;
	}

	// Queued: sent right after the response, retried with backoff if Twilio
	// fails. The OrderMessage row above still guarantees one message per
	// milestone, however many paths reach it.
	await enqueue("MESSAGE", {
		to: toE164(order.customerPhone),
		channel: transport,
		body: message.body,
		template: {
			key: message.templateKey,
			variables: {
				"1": order.restaurant.name,
				"2": reference,
				"3": orderUrl,
			},
		},
	});
}
