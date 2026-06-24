import * as Sentry from "@sentry/nextjs";
import twilio from "twilio";
import { requireEnv } from "@/env";

export type OrderNotificationPayload = {
	id: string;
	customerName: string;
	customerPhone: string;
	type: string;
	tableLabel?: string | null;
	tableNumber?: string | null;
	deliveryAddress?: string | null;
	dineInPaymentMethod?: string | null;
	dineInServiceMode?: string | null;
	waiterName?: string | null;
	currency: string;
	total: number;
	items: Array<{
		name: string;
		qty: number;
		unitPrice: number;
	}>;
};

export async function sendOrderNotification(
	toNumber: string,
	order: OrderNotificationPayload,
) {
	const client = twilio(
		requireEnv("TWILIO_ACCOUNT_SID"),
		requireEnv("TWILIO_AUTH_TOKEN"),
	);
	const itemLines = order.items
		.map(
			(item) =>
				`  • ${item.name} x${item.qty} — ${order.currency} ${(item.unitPrice * item.qty).toLocaleString()}`,
		)
		.join("\n");
	const locationLine =
		order.type === "DINE_IN"
			? `Table: ${order.tableLabel ?? order.tableNumber ?? "N/A"}`
			: order.type === "DELIVERY"
				? `Delivery to: ${order.deliveryAddress}`
				: "Pickup";
	const paymentLine =
		order.type === "DINE_IN"
			? `Payment: ${order.dineInPaymentMethod === "CASH" ? "Cash (to collect)" : "Transfer/Card (to collect)"}`
			: "Payment: Paid online";
	const serviceLine =
		order.type === "DINE_IN"
			? order.dineInServiceMode === "SERVED_BY_WAITER"
				? `Service: Served by ${order.waiterName ?? "staff"}`
				: "Service: Self-served"
			: null;

	await client.messages.create({
		from: `whatsapp:${requireEnv("TWILIO_WHATSAPP_FROM")}`,
		to: `whatsapp:${toNumber}`,
		body: [
			`New Order - #${order.id.slice(-6).toUpperCase()}`,
			"",
			`Customer: ${order.customerName}`,
			`Phone: ${order.customerPhone}`,
			`Type: ${order.type.replace("_", " ")}`,
			locationLine,
			...(serviceLine ? [serviceLine] : []),
			paymentLine,
			"",
			"Items:",
			itemLines,
			"",
			`Total: ${order.currency} ${order.total.toLocaleString()}`,
		].join("\n"),
	});
}

export async function sendOrderNotificationSafe(
	toNumber: string | null | undefined,
	order: OrderNotificationPayload,
) {
	if (!toNumber) return false;

	try {
		await sendOrderNotification(toNumber, order);
		return true;
	} catch (error) {
		Sentry.captureException(error);
		return false;
	}
}
