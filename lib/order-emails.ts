import { OrderType } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/env";
import { db } from "@/lib/db";
import {
	sendAdminNewOrderEmail,
	sendAdminOrderCompletedEmail,
	sendAdminPaymentReceivedEmail,
	sendOrderCancelledEmail,
	sendOrderCompletedEmail,
	sendOrderConfirmedEmail,
	sendOrderReceiptEmail,
} from "@/lib/order-email-templates";

/**
 * Every lifecycle email for an order, in one place.
 *
 * Previously the only customer email fired the moment an order was *created* —
 * so a customer was told "order confirmed" before the restaurant had even seen
 * it, and could then be declined. Each event now has its own trigger, and the
 * word "confirmed" is reserved for an order a restaurant has actually accepted.
 *
 * Every function here is safe to call more than once. That matters because a
 * payment can be reported by the Paystack webhook and by the customer's return
 * to the order page at nearly the same instant; both call `notifyOrderPaid`.
 */

/** Columns that record which lifecycle emails an order has already had. */
type EmailSlot =
	| "newOrderEmailSentAt"
	| "confirmationEmailSentAt"
	| "receiptEmailSentAt"
	| "completionEmailSentAt"
	| "cancellationEmailSentAt";

/**
 * Claims an email slot, returning true only for the caller that won it.
 *
 * The conditional UPDATE is the whole point: Postgres decides the winner, so
 * two concurrent processes cannot both send. Claiming *before* sending means a
 * crash mid-send loses an email rather than sending it twice — the safer
 * failure for a receipt.
 */
async function claim(orderId: string, slot: EmailSlot): Promise<boolean> {
	const { count } = await db.order.updateMany({
		where: { id: orderId, [slot]: null },
		data: { [slot]: new Date() },
	});
	return count === 1;
}

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

/** "Dine-in", "Delivery"… so the customer reads about the thing they booked. */
function describeType(type: OrderType) {
	if (type === OrderType.DINE_IN) return "Dine-in";
	if (type === OrderType.DELIVERY) return "Delivery";
	if (type === OrderType.PICKUP) return "Pickup";
	return "Table reservation";
}

/** What "your order is done" means differs per type — say the right thing. */
function describeCompletion(type: OrderType) {
	if (type === OrderType.DELIVERY) return "Your order has been delivered.";
	if (type === OrderType.PICKUP) return "Your order has been picked up.";
	if (type === OrderType.TABLE_RESERVATION) {
		return "Your table reservation is complete.";
	}
	return "Your order is complete. Thanks for dining with us.";
}

async function loadOrder(orderId: string) {
	return db.order.findUnique({
		where: { id: orderId },
		select: {
			id: true,
			type: true,
			total: true,
			customerName: true,
			customerEmail: true,
			tableNumber: true,
			deliveryAddress: true,
			items: {
				select: { name: true, qty: true, unitPrice: true },
			},
			restaurant: {
				select: {
					id: true,
					name: true,
					slug: true,
					currency: true,
					owner: { select: { email: true } },
				},
			},
		},
	});
}

type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadOrder>>>;

function orderUrl(order: LoadedOrder) {
	return `${env.NEXT_PUBLIC_APP_URL}/${order.restaurant.slug}/order/${order.id}`;
}

function adminUrl(order: LoadedOrder) {
	return `${env.NEXT_PUBLIC_APP_URL}/dashboard/${order.restaurant.slug}/orders?orderId=${order.id}`;
}

function lineItems(order: LoadedOrder) {
	return order.items.map((item) => ({
		name: item.name,
		quantity: item.qty,
		amount: formatMoney(
			Number(item.unitPrice) * item.qty,
			order.restaurant.currency,
		),
	}));
}

/**
 * Email delivery must never fail the action that triggered it.
 *
 * An order that is paid for and confirmed in the database, but whose receipt
 * bounced off a Resend outage, is a support ticket. An exception thrown back
 * into `acceptOrderAction` would be a failed acceptance — much worse.
 */
async function attempt(label: string, run: () => Promise<void>) {
	try {
		await run();
	} catch (error) {
		Sentry.captureException(error, { tags: { email: label } });
	}
}

// ─── Order placed ─────────────────────────────────────
// Customer gets nothing here on purpose: the restaurant hasn't accepted yet,
// and an order can still be declined. The admin needs to know immediately.

export async function notifyOrderPlaced(orderId: string) {
	const order = await loadOrder(orderId);
	if (!order) return;
	if (!(await claim(orderId, "newOrderEmailSentAt"))) return;

	await attempt("admin-new-order", () =>
		sendAdminNewOrderEmail({
			to: order.restaurant.owner.email,
			restaurantName: order.restaurant.name,
			orderId: order.id,
			orderType: describeType(order.type),
			customerName: order.customerName,
			total: formatMoney(Number(order.total), order.restaurant.currency),
			items: lineItems(order),
			dashboardUrl: adminUrl(order),
		}),
	);
}

// ─── Accepted / confirmed ─────────────────────────────

export async function notifyOrderConfirmed(orderId: string) {
	const order = await loadOrder(orderId);
	if (!order?.customerEmail) return;
	if (!(await claim(orderId, "confirmationEmailSentAt"))) return;

	await attempt("customer-confirmed", () =>
		sendOrderConfirmedEmail({
			to: order.customerEmail as string,
			restaurantName: order.restaurant.name,
			restaurantReplyToEmail: order.restaurant.owner.email,
			orderId: order.id,
			orderType: describeType(order.type),
			customerName: order.customerName,
			total: formatMoney(Number(order.total), order.restaurant.currency),
			items: lineItems(order),
			orderUrl: orderUrl(order),
		}),
	);
}

// ─── Paid ─────────────────────────────────────────────
// One receipt to the customer, one alert to the restaurant, whichever of the
// seven payment paths got there first.

export async function notifyOrderPaid(
	orderId: string,
	options?: { method?: string },
) {
	const order = await loadOrder(orderId);
	if (!order) return;
	if (!(await claim(orderId, "receiptEmailSentAt"))) return;

	const total = formatMoney(Number(order.total), order.restaurant.currency);

	if (order.customerEmail) {
		await attempt("customer-receipt", () =>
			sendOrderReceiptEmail({
				to: order.customerEmail as string,
				restaurantName: order.restaurant.name,
				restaurantReplyToEmail: order.restaurant.owner.email,
				orderId: order.id,
				orderType: describeType(order.type),
				customerName: order.customerName,
				items: lineItems(order),
				total,
				paymentMethod: options?.method ?? "Online payment",
				orderUrl: orderUrl(order),
				fulfilmentDetail:
					order.type === OrderType.DELIVERY
						? (order.deliveryAddress ?? undefined)
						: order.tableNumber
							? `Table ${order.tableNumber}`
							: undefined,
			}),
		);
	}

	await attempt("admin-payment", () =>
		sendAdminPaymentReceivedEmail({
			to: order.restaurant.owner.email,
			restaurantName: order.restaurant.name,
			orderId: order.id,
			orderType: describeType(order.type),
			customerName: order.customerName,
			total,
			paymentMethod: options?.method ?? "Online payment",
			dashboardUrl: adminUrl(order),
		}),
	);
}

// ─── Completed ────────────────────────────────────────

export async function notifyOrderCompleted(orderId: string) {
	const order = await loadOrder(orderId);
	if (!order) return;
	if (!(await claim(orderId, "completionEmailSentAt"))) return;

	const total = formatMoney(Number(order.total), order.restaurant.currency);

	if (order.customerEmail) {
		await attempt("customer-completed", () =>
			sendOrderCompletedEmail({
				to: order.customerEmail as string,
				restaurantName: order.restaurant.name,
				restaurantReplyToEmail: order.restaurant.owner.email,
				orderId: order.id,
				customerName: order.customerName,
				summary: describeCompletion(order.type),
				total,
				orderUrl: orderUrl(order),
			}),
		);
	}

	await attempt("admin-completed", () =>
		sendAdminOrderCompletedEmail({
			to: order.restaurant.owner.email,
			restaurantName: order.restaurant.name,
			orderId: order.id,
			orderType: describeType(order.type),
			customerName: order.customerName,
			total,
			dashboardUrl: adminUrl(order),
		}),
	);
}

// ─── Declined / cancelled ─────────────────────────────
// Not on the original list, but the one case where silence is worst: a
// customer who ordered and paid attention deserves to hear that it won't
// happen, rather than waiting for food that isn't coming.

export async function notifyOrderCancelled(
	orderId: string,
	options?: { reason?: string | null },
) {
	const order = await loadOrder(orderId);
	if (!order?.customerEmail) return;
	if (!(await claim(orderId, "cancellationEmailSentAt"))) return;

	await attempt("customer-cancelled", () =>
		sendOrderCancelledEmail({
			to: order.customerEmail as string,
			restaurantName: order.restaurant.name,
			restaurantReplyToEmail: order.restaurant.owner.email,
			orderId: order.id,
			customerName: order.customerName,
			reason: options?.reason ?? null,
			orderUrl: orderUrl(order),
		}),
	);
}
