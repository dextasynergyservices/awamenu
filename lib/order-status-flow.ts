import { OrderStatus, OrderType } from "@prisma/client";

/**
 * The statuses an order of a given type can move through.
 *
 * One definition, used by the admin controls, the staff feed, the customer
 * tracker and the server-side guard. It was previously copied into three
 * components, which is why they could disagree about whether a dine-in order
 * has a "Preparing" step.
 *
 * Dine-in and table reservations are deliberately shorter. A diner sitting at
 * a table gains nothing from "Preparing" — they can see the kitchen is
 * working — and "Delivered" is meaningless when nobody is delivering
 * anything. Every extra status is also an extra WhatsApp message, which is
 * how a useful channel turns into one people mute.
 */
const DINE_IN_FLOW: OrderStatus[] = [
	OrderStatus.CONFIRMED,
	OrderStatus.READY,
	OrderStatus.COMPLETED,
];

const FULFILMENT_FLOW: OrderStatus[] = [
	OrderStatus.CONFIRMED,
	OrderStatus.PREPARING,
	OrderStatus.READY,
	OrderStatus.DELIVERED,
	OrderStatus.COMPLETED,
];

export function getStatusFlow(type: OrderType | string): OrderStatus[] {
	if (type === OrderType.DINE_IN || type === OrderType.TABLE_RESERVATION) {
		return DINE_IN_FLOW;
	}
	return FULFILMENT_FLOW;
}

/** Whether a status is reachable for this order type at all. */
export function isStatusAllowedForType(
	type: OrderType | string,
	status: OrderStatus,
) {
	// Cancellation is reachable from every flow and has its own route.
	if (status === OrderStatus.CANCELLED) return true;
	if (status === OrderStatus.PENDING_APPROVAL) return true;
	if (status === OrderStatus.PENDING_PAYMENT) return true;
	return getStatusFlow(type).includes(status);
}

/** Human label for a status, in the customer's terms. */
export function getStatusLabel(type: OrderType | string, status: OrderStatus) {
	if (status === OrderStatus.READY) {
		if (type === OrderType.DELIVERY) return "Out for delivery";
		if (type === OrderType.PICKUP) return "Ready for pickup";
		if (type === OrderType.TABLE_RESERVATION) return "Table ready";
		return "Ready";
	}
	if (status === OrderStatus.CONFIRMED) return "Confirmed";
	if (status === OrderStatus.PREPARING) return "Preparing";
	if (status === OrderStatus.DELIVERED) return "Delivered";
	if (status === OrderStatus.COMPLETED) return "Completed";
	if (status === OrderStatus.CANCELLED) return "Cancelled";
	if (status === OrderStatus.PENDING_PAYMENT) return "Awaiting payment";
	return "Pending approval";
}
