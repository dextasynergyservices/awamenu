import { NotificationAudience, NotificationType } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/env";
import { captureServerEvent } from "@/lib/analytics";
import { db } from "@/lib/db";
import { sendOrderConfirmationEmail } from "@/lib/email";
import { dispatchNotification } from "@/lib/notifications";

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

export async function notifyNewOrder(orderId: string) {
	const order = await db.order.findUniqueOrThrow({
		where: { id: orderId },
		select: {
			id: true,
			customerName: true,
			customerPhone: true,
			customerEmail: true,
			type: true,
			tableNumber: true,
			tableLabel: true,
			deliveryAddress: true,
			dineInPaymentMethod: true,
			dineInServiceMode: true,
			waiterName: true,
			total: true,
			restaurant: {
				select: {
					id: true,
					name: true,
					slug: true,
					currency: true,
				},
			},
			items: {
				select: {
					name: true,
					qty: true,
					unitPrice: true,
				},
			},
		},
	});
	const orderUrl = `${env.NEXT_PUBLIC_APP_URL}/${order.restaurant.slug}/order/${order.id}`;
	const total = Number(order.total);

	if (order.customerEmail) {
		try {
			await sendOrderConfirmationEmail({
				to: order.customerEmail,
				restaurantName: order.restaurant.name,
				orderId: order.id,
				orderUrl,
				total: formatMoney(total, order.restaurant.currency),
			});
		} catch (error) {
			Sentry.captureException(error);
		}
	}

	await dispatchNotification({
		restaurantId: order.restaurant.id,
		type: NotificationType.NEW_ORDER,
		audience: NotificationAudience.BOTH,
		title: `New order #${order.id.slice(-6).toUpperCase()}`,
		body: `${order.type.replace("_", " ")} · ${formatMoney(total, order.restaurant.currency)}`,
		actionUrl: `/dashboard/${order.restaurant.slug}/orders?orderId=${order.id}`,
		metadata: { orderId: order.id },
	});

	captureServerEvent("order_placed", order.customerPhone, {
		orderId: order.id,
		restaurantId: order.restaurant.id,
		type: order.type,
		total,
	});
}
