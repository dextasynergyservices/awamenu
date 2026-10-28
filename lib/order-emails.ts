import { OrderType, PaymentStatus } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import type { ReactElement } from "react";
import type { EmailBrand } from "@/emails/brand";
import {
	OrderCancelledEmail,
	OrderCompletedEmail,
	OrderConfirmedEmail,
	OrderReceiptEmail,
} from "@/emails/customer";
import { NewOrderEmail, OwnerPaymentReceivedEmail } from "@/emails/owner";
import { env } from "@/env";
import { db } from "@/lib/db";
import { getAccountsFromEmail } from "@/lib/email";
import {
	getPlatformBrand,
	getRestaurantEmailIdentity,
} from "@/lib/email-brand";
import { getQueuedMailer } from "@/lib/outbox";

/**
 * Every lifecycle email for an order, in one place.
 *
 * Guests hear from the restaurant (its name, logo and colour); the owner hears
 * from AwaMenu. The owner is emailed about things they didn't do themselves
 * (a new order, a customer's payment), never about their own actions.
 *
 * The word "confirmed" is reserved for an order a restaurant has actually
 * accepted: nothing goes to the guest when an order is merely placed, because
 * it can still be declined.
 *
 * Every function here is safe to call more than once. A payment can be
 * reported by the Paystack webhook and by the customer's return to the order
 * page at nearly the same instant; both call `notifyOrderPaid`.
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
	return "Your order is complete.";
}

async function loadOrder(orderId: string) {
	return db.order.findUnique({
		where: { id: orderId },
		select: {
			id: true,
			type: true,
			total: true,
			paymentStatus: true,
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

const reference = (order: LoadedOrder) => order.id.slice(-6).toUpperCase();

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

const total = (order: LoadedOrder) =>
	formatMoney(Number(order.total), order.restaurant.currency);

/**
 * Email delivery must never fail the action that triggered it.
 *
 * An order that is paid for and confirmed in the database, but whose receipt
 * bounced off a Resend outage, is a support ticket. An exception thrown back
 * into `acceptOrderAction` would be a failed acceptance — much worse.
 */
async function attempt(label: string, run: () => Promise<unknown>) {
	try {
		await run();
	} catch (error) {
		Sentry.captureException(error, { tags: { email: label } });
	}
}

/** Sends a guest email in the restaurant's name, replies going to the owner. */
async function sendToGuest(
	order: LoadedOrder,
	subject: string,
	build: (brand: EmailBrand) => ReactElement,
) {
	if (!order.customerEmail) return;
	const identity = await getRestaurantEmailIdentity(order.restaurant.id);
	await getQueuedMailer().emails.send({
		from: identity.from,
		replyTo: identity.replyTo,
		to: order.customerEmail,
		subject,
		react: build(identity.brand),
	});
}

// ─── Order placed ─────────────────────────────────────
// Customer gets nothing here on purpose: the restaurant hasn't accepted yet,
// and an order can still be declined. The owner needs to know immediately.

export async function notifyOrderPlaced(orderId: string) {
	const order = await loadOrder(orderId);
	if (!order) return;
	if (!(await claim(orderId, "newOrderEmailSentAt"))) return;

	await attempt("admin-new-order", async () =>
		getQueuedMailer().emails.send({
			from: getAccountsFromEmail(),
			to: order.restaurant.owner.email,
			subject: `New ${describeType(order.type).toLowerCase()} order #${reference(order)} · ${total(order)}`,
			react: NewOrderEmail({
				brand: await getPlatformBrand(),
				restaurantName: order.restaurant.name,
				reference: reference(order),
				orderType: describeType(order.type),
				customerName: order.customerName,
				items: lineItems(order),
				total: total(order),
				dashboardUrl: adminUrl(order),
			}),
		}),
	);
}

// ─── Accepted / confirmed ─────────────────────────────

export async function notifyOrderConfirmed(orderId: string) {
	const order = await loadOrder(orderId);
	if (!order?.customerEmail) return;
	if (!(await claim(orderId, "confirmationEmailSentAt"))) return;

	await attempt("customer-confirmed", () =>
		sendToGuest(order, `Order #${reference(order)} confirmed`, (brand) =>
			OrderConfirmedEmail({
				brand,
				customerName: order.customerName,
				reference: reference(order),
				orderUrl: orderUrl(order),
				orderType: describeType(order.type),
				items: lineItems(order),
				total: total(order),
			}),
		),
	);
}

// ─── Paid ─────────────────────────────────────────────
// One receipt to the customer and one alert to the owner, whichever payment
// path got there first.

export async function notifyOrderPaid(
	orderId: string,
	options?: { method?: string },
) {
	const order = await loadOrder(orderId);
	if (!order) return;
	if (!(await claim(orderId, "receiptEmailSentAt"))) return;

	const method = options?.method ?? "Online payment";

	await attempt("customer-receipt", () =>
		sendToGuest(order, `Your receipt for order #${reference(order)}`, (brand) =>
			OrderReceiptEmail({
				brand,
				customerName: order.customerName,
				reference: reference(order),
				orderUrl: orderUrl(order),
				orderType: describeType(order.type),
				items: lineItems(order),
				total: total(order),
				paymentMethod: method,
				fulfilmentDetail:
					order.type === OrderType.DELIVERY
						? (order.deliveryAddress ?? undefined)
						: order.tableNumber
							? `Table ${order.tableNumber}`
							: undefined,
			}),
		),
	);

	await attempt("admin-payment", async () =>
		getQueuedMailer().emails.send({
			from: getAccountsFromEmail(),
			to: order.restaurant.owner.email,
			subject: `${total(order)} received for order #${reference(order)}`,
			react: OwnerPaymentReceivedEmail({
				brand: await getPlatformBrand(),
				restaurantName: order.restaurant.name,
				reference: reference(order),
				orderType: describeType(order.type),
				customerName: order.customerName,
				total: total(order),
				paymentMethod: method,
				dashboardUrl: adminUrl(order),
			}),
		}),
	);
}

// ─── Completed ────────────────────────────────────────
// The guest only: the owner or their staff just completed it themselves.

export async function notifyOrderCompleted(orderId: string) {
	const order = await loadOrder(orderId);
	if (!order?.customerEmail) return;
	if (!(await claim(orderId, "completionEmailSentAt"))) return;

	await attempt("customer-completed", () =>
		sendToGuest(order, `Thanks for your order #${reference(order)}`, (brand) =>
			OrderCompletedEmail({
				brand,
				customerName: order.customerName,
				reference: reference(order),
				orderUrl: orderUrl(order),
				summary: describeCompletion(order.type),
				total: total(order),
			}),
		),
	);
}

// ─── Declined / cancelled ─────────────────────────────
// The one case where silence is worst: a customer waiting for food that isn't
// coming deserves to hear it won't.

export async function notifyOrderCancelled(
	orderId: string,
	options?: { reason?: string | null },
) {
	const order = await loadOrder(orderId);
	if (!order?.customerEmail) return;
	if (!(await claim(orderId, "cancellationEmailSentAt"))) return;

	await attempt("customer-cancelled", () =>
		sendToGuest(order, `Order #${reference(order)} was cancelled`, (brand) =>
			OrderCancelledEmail({
				brand,
				customerName: order.customerName,
				reference: reference(order),
				orderUrl: orderUrl(order),
				reason: options?.reason ?? null,
				paid: order.paymentStatus === PaymentStatus.PAID,
			}),
		),
	);
}
