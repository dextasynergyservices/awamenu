import { CustomerUpdateChannel, OrderStatus, OrderType } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/env";
import { db } from "@/lib/db";
import { canDeliverOn, sendTwilioMessage, toE164 } from "@/lib/otp-delivery";
import { getRestaurantPlanFeatures } from "@/lib/plan-features";

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
}) {
	const { restaurantName, reference, type, orderUrl } = input;
	const prefix = `${restaurantName}: order #${reference}`;

	if (input.status === OrderStatus.CONFIRMED) {
		return `${prefix} is confirmed and we've started on it. Track it here: ${orderUrl}`;
	}

	if (input.status === OrderStatus.READY) {
		if (type === OrderType.DELIVERY) {
			return `${prefix} is packed and on its way to you. Track it here: ${orderUrl}`;
		}
		if (type === OrderType.PICKUP) {
			return `${prefix} is ready for pickup. Show this reference when you arrive: ${orderUrl}`;
		}
		if (type === OrderType.TABLE_RESERVATION) {
			return `${prefix} — your table is ready. Details: ${orderUrl}`;
		}
		return `${prefix} is ready and coming to your table.`;
	}

	if (input.status === OrderStatus.DELIVERED) {
		return `${prefix} has been delivered. Enjoy! Rate your order: ${orderUrl}`;
	}

	// COMPLETED
	if (type === OrderType.TABLE_RESERVATION) {
		return `${prefix} — your reservation is complete. Thanks for visiting ${restaurantName}. Rate it here: ${orderUrl}`;
	}
	return `${prefix} is complete. Thanks for choosing ${restaurantName}. Rate your order: ${orderUrl}`;
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
	if (!canDeliverOn(transport)) return;

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

	const reference = order.id.slice(-6).toUpperCase();
	const body = composeMessage({
		status,
		type: order.type,
		restaurantName: order.restaurant.name,
		reference,
		orderUrl: `${env.NEXT_PUBLIC_APP_URL}/${order.restaurant.slug}/order/${order.id}`,
	});

	const result = await sendTwilioMessage({
		to: toE164(order.customerPhone),
		channel: transport,
		body,
	});

	if ("error" in result) {
		// Left as a captured error rather than thrown: a failed courtesy message
		// must never roll back the status change that triggered it. The row stays
		// so a retry storm can't spam the customer.
		Sentry.captureException(
			new Error(`Order message failed: ${result.error}`),
			{
				tags: { orderId: order.id, status, channel },
			},
		);
	}
}
