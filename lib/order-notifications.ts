import { NotificationAudience, NotificationType } from "@prisma/client";
import { captureServerEvent } from "@/lib/analytics";
import { db } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";
import { notifyOrderPlaced } from "@/lib/order-emails";

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
		// Only what the in-app notification and the analytics event need — the
		// customer/admin emails moved to `notifyOrderPlaced`, which loads its
		// own data. Leaving the old select in place meant fetching items, the
		// owner's email and six fulfilment columns on every single order for
		// nothing.
		select: {
			id: true,
			customerPhone: true,
			type: true,
			total: true,
			restaurant: {
				select: { id: true, slug: true, currency: true },
			},
		},
	});
	const total = Number(order.total);

	// The customer is deliberately NOT emailed here. This fires the instant an
	// order is created, before the restaurant has seen it — telling someone
	// "order confirmed" and then declining them is worse than saying nothing.
	// Their confirmation goes out from `notifyOrderConfirmed` on acceptance.
	// The restaurant, on the other hand, needs to know right now.
	await notifyOrderPlaced(order.id);

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
