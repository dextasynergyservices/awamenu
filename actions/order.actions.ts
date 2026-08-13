"use server";

import {
	AuditActorType,
	DineInPaymentMethod,
	DineInServiceMode,
	NotificationAudience,
	NotificationType,
	OrderStatus,
	OrderType,
	PaymentMethod,
	PaymentPolicy,
	PaymentStatus,
} from "@prisma/client";
import { verifyPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, actionResult } from "@/lib/action-error";
import { recordAuditEvent } from "@/lib/audit";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";
import {
	notifyOrderCancelled,
	notifyOrderCompleted,
	notifyOrderConfirmed,
	notifyOrderPaid,
} from "@/lib/order-emails";
import { notifyCustomerOrderStatus } from "@/lib/order-messaging";
import { notifyNewOrder } from "@/lib/order-notifications";
import { isStatusAllowedForType } from "@/lib/order-status-flow";
import { creditOrder } from "@/lib/payment-ledger";
import { initiateOrderPaymentForRestaurant } from "@/lib/payments";
import { enforceRateLimit, getClientIp } from "@/lib/ratelimit";
import { getStaffSession } from "@/lib/staff-auth";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { verifyStaffAction } from "./staff.actions";

const checkoutItemSchema = z.object({
	id: z.string().cuid(),
	quantity: z.number().int().min(1).max(99),
	notes: z.string().max(300).optional(),
});

const optionalString = (max: number) =>
	z.preprocess(
		(value) =>
			value === null || (typeof value === "string" && value.trim() === "")
				? undefined
				: value,
		z.string().trim().max(max).optional(),
	);

const orderForSchema = z.preprocess(
	(value) =>
		value === null || value === undefined || value === "" ? "SELF" : value,
	z.enum(["SELF", "SOMEONE_ELSE"]),
);

const DEFAULT_DECLINE_REASON =
	"Sorry, we cannot accept this order right now. Please contact the restaurant for more details.";

const createOrderSchema = z
	.object({
		slug: z.string().min(1),
		existingOrderId: z.string().cuid().optional(),
		type: z.nativeEnum(OrderType),
		customerName: optionalString(100),
		customerPhone: optionalString(40),
		customerEmail: optionalString(120).pipe(z.string().email().optional()),
		tableNumber: optionalString(40),
		dineInPaymentMethod: z.nativeEnum(DineInPaymentMethod).optional(),
		dineInServiceMode: z.nativeEnum(DineInServiceMode).optional(),
		waiterName: optionalString(100),
		deliveryAddress: optionalString(240),
		deliveryNotes: optionalString(240),
		orderFor: orderForSchema,
		senderPhone: optionalString(40),
		senderTableNumber: optionalString(40),
		receiverPhone: optionalString(40),
		receiverAltPhone: optionalString(40),
		receiverName: optionalString(100),
		seatNumber: optionalString(40),
		items: z.array(checkoutItemSchema).min(1),
	})
	.superRefine((input, ctx) => {
		if (input.existingOrderId) {
			return;
		}

		// A contact number is required for every order type, including dine-in.
		// Staff message customers on WhatsApp at each stage of an order, and
		// without a number that's impossible — the order silently becomes
		// unreachable. Orders appended to an existing one are exempt: they
		// inherit the original order's contact details.
		if (!input.customerPhone || input.customerPhone.length < 3) {
			ctx.addIssue({
				code: "custom",
				path: ["customerPhone"],
				message:
					"A phone number is required so we can reach you about this order.",
			});
		}

		if (input.orderFor === "SOMEONE_ELSE") {
			const isDineIn = input.type === OrderType.DINE_IN;
			if (!isDineIn && !input.receiverName) {
				ctx.addIssue({
					code: "custom",
					path: ["receiverName"],
					message: "Recipient name is required for this order.",
				});
			}

			if (
				!isDineIn &&
				(!input.receiverPhone || input.receiverPhone.length < 3)
			) {
				ctx.addIssue({
					code: "custom",
					path: ["receiverPhone"],
					message: "Recipient phone is required for this order.",
				});
			}

			if (!input.senderPhone) {
				ctx.addIssue({
					code: "custom",
					path: ["senderPhone"],
					message: "Sender phone is required for this order.",
				});
			}
		}

		if (input.type === OrderType.DINE_IN) {
			return;
		}

		if (!input.customerName) {
			ctx.addIssue({
				code: "custom",
				path: ["customerName"],
				message: "Customer name is required for this order type.",
			});
		}

		if (!input.customerPhone || input.customerPhone.length < 3) {
			ctx.addIssue({
				code: "custom",
				path: ["customerPhone"],
				message: "Customer phone is required for this order type.",
			});
		}
	});

export async function createOrderAction(formData: FormData) {
	return actionResult(async () => {
		const input = createOrderSchema.parse({
			slug: formData.get("slug"),
			existingOrderId: formData.get("existingOrderId") || undefined,
			type: formData.get("type"),
			customerName: formData.get("customerName"),
			customerPhone: formData.get("customerPhone"),
			customerEmail: formData.get("customerEmail") || undefined,
			tableNumber: formData.get("tableNumber") || undefined,
			dineInPaymentMethod: formData.get("dineInPaymentMethod") || undefined,
			dineInServiceMode: formData.get("dineInServiceMode") || undefined,
			waiterName: formData.get("waiterName") || undefined,
			deliveryAddress: formData.get("deliveryAddress") || undefined,
			deliveryNotes: formData.get("deliveryNotes") || undefined,
			orderFor: formData.get("orderFor") || undefined,
			senderPhone: formData.get("senderPhone") || undefined,
			senderTableNumber: formData.get("senderTableNumber") || undefined,
			receiverPhone: formData.get("receiverPhone") || undefined,
			receiverAltPhone: formData.get("receiverAltPhone") || undefined,
			receiverName: formData.get("receiverName") || undefined,
			seatNumber: formData.get("seatNumber") || undefined,
			items: JSON.parse(String(formData.get("items") ?? "[]")),
		});
		const clientIp = await getClientIp();
		await enforceRateLimit("order", `${clientIp}:${input.slug}`);

		const turnstileOk = await verifyTurnstileToken(
			formData.get("cf-turnstile-response")?.toString(),
			clientIp,
		);
		if (!turnstileOk) {
			throw new ActionError("Verification failed. Please try again.");
		}

		const restaurant = await db.restaurant.findFirstOrThrow({
			where: { slug: input.slug, isActive: true },
			select: {
				id: true,
				slug: true,
				dineInPaymentPolicy: true,
				currency: true,
				dineInEnabled: true,
				pickupEnabled: true,
				deliveryEnabled: true,
				tableReservationEnabled: true,
			},
		});

		const orderTypeEnabled = {
			[OrderType.DINE_IN]: restaurant.dineInEnabled,
			[OrderType.PICKUP]: restaurant.pickupEnabled,
			[OrderType.DELIVERY]: restaurant.deliveryEnabled,
			[OrderType.TABLE_RESERVATION]: restaurant.tableReservationEnabled,
		}[input.type];

		if (!orderTypeEnabled) {
			throw new ActionError(
				"This order type is not available for this restaurant.",
			);
		}

		if (input.type === OrderType.TABLE_RESERVATION) {
			throw new ActionError(
				"Please use the table reservation flow for reservations.",
			);
		}

		if (input.type === OrderType.DINE_IN && !input.tableNumber) {
			throw new ActionError("Table number is required for dine-in orders.");
		}

		if (
			input.type === OrderType.DINE_IN &&
			input.dineInServiceMode === DineInServiceMode.SERVED_BY_WAITER &&
			!input.waiterName
		) {
			throw new ActionError(
				"Waiter name is required when the order is served by staff.",
			);
		}

		if (input.type === OrderType.DELIVERY && !input.deliveryAddress) {
			throw new ActionError(
				"Delivery address is required for delivery orders.",
			);
		}

		const menuItems = await db.menuItem.findMany({
			where: {
				id: { in: input.items.map((item) => item.id) },
				isAvailable: true,
				category: { restaurantId: restaurant.id, isActive: true },
			},
			select: { id: true, name: true, price: true },
		});

		if (menuItems.length !== input.items.length) {
			throw new ActionError("Some cart items are unavailable.");
		}

		const lines = input.items.map((item) => {
			const menuItem = menuItems.find((entry) => entry.id === item.id);
			if (!menuItem) throw new ActionError("Invalid cart item.");

			return {
				menuItemId: menuItem.id,
				name: menuItem.name,
				unitPrice: Number(menuItem.price),
				qty: item.quantity,
				notes: item.notes,
			};
		});
		const subtotal = lines.reduce(
			(total, line) => total + line.unitPrice * line.qty,
			0,
		);
		const deliveryFee = input.type === OrderType.DELIVERY ? 0 : 0;
		const total = subtotal + deliveryFee;
		const customerName =
			input.type === OrderType.DINE_IN
				? (input.customerName ?? "Walk-in guest")
				: input.customerName;
		const customerPhone =
			input.type === OrderType.DINE_IN
				? (input.customerPhone ?? "Not provided")
				: input.customerPhone;

		if (!customerName || !customerPhone) {
			throw new ActionError(
				"Customer name and phone are required for this order type.",
			);
		}

		if (input.existingOrderId) {
			const existingOrder = await db.order.findFirstOrThrow({
				where: {
					id: input.existingOrderId,
					restaurantId: restaurant.id,
					type: OrderType.DINE_IN,
					status: OrderStatus.CONFIRMED,
					paymentStatus: PaymentStatus.PENDING,
					dineInPaymentPolicy: PaymentPolicy.PAY_AFTER_SERVICE,
				},
				select: { id: true, subtotal: true, total: true },
			});

			await db.order.update({
				where: { id: existingOrder.id },
				data: {
					subtotal: Number(existingOrder.subtotal) + subtotal,
					total: Number(existingOrder.total) + total,
					items: {
						create: lines,
					},
				},
			});
			revalidatePath(`/${restaurant.slug}/order/${existingOrder.id}`);
			redirect(`/${restaurant.slug}/order/${existingOrder.id}`);
		}

		const recipientDetails =
			input.orderFor === "SOMEONE_ELSE"
				? {
						orderFor: input.orderFor,
						senderPhone: input.senderPhone,
						senderTableNumber: input.senderTableNumber,
						receiverPhone: input.receiverPhone,
						receiverAltPhone: input.receiverAltPhone,
						receiverName: input.receiverName,
						seatNumber:
							input.type === OrderType.DINE_IN ? input.seatNumber : undefined,
					}
				: { orderFor: input.orderFor };
		const order = await db.order.create({
			data: {
				restaurantId: restaurant.id,
				customerName,
				customerPhone,
				customerEmail: input.customerEmail,
				type: input.type,
				status: OrderStatus.PENDING_APPROVAL,
				paymentStatus: PaymentStatus.PENDING,
				tableNumber: input.tableNumber,
				dineInPaymentPolicy:
					input.type === OrderType.DINE_IN
						? input.orderFor === "SOMEONE_ELSE"
							? PaymentPolicy.PAY_BEFORE_SERVICE
							: restaurant.dineInPaymentPolicy
						: undefined,
				dineInPaymentMethod:
					input.type === OrderType.DINE_IN
						? input.dineInPaymentMethod
						: undefined,
				dineInServiceMode:
					input.type === OrderType.DINE_IN
						? (input.dineInServiceMode ?? DineInServiceMode.SELF_SERVED)
						: undefined,
				waiterName:
					input.type === OrderType.DINE_IN &&
					input.dineInServiceMode === DineInServiceMode.SERVED_BY_WAITER
						? input.waiterName
						: undefined,
				deliveryAddress:
					input.type === OrderType.DELIVERY ? input.deliveryAddress : undefined,
				deliveryNotes: input.deliveryNotes,
				...recipientDetails,
				deliveryFee,
				subtotal,
				total,
				items: {
					create: lines,
				},
			},
		});

		await notifyNewOrder(order.id);
		redirect(`/${restaurant.slug}/order/${order.id}`);
	});
}

export async function initiateOrderPaymentAction(formData: FormData) {
	const orderId = z.string().cuid().parse(formData.get("orderId"));
	const slug = z.string().min(1).parse(formData.get("slug"));
	// Optional: only present when the restaurant offers more than one provider.
	// `resolveCheckoutGateway` ignores anything the restaurant hasn't enabled, so
	// a tampered value can't route the money somewhere else.
	const preferredGateway = z
		.enum(["PAYSTACK", "FLUTTERWAVE", "MONNIFY"])
		.nullish()
		.catch(null)
		.parse(formData.get("gateway") || null);
	const order = await db.order.findFirstOrThrow({
		where: {
			id: orderId,
			restaurant: { slug, isActive: true },
			status: { in: [OrderStatus.CONFIRMED, OrderStatus.PENDING_PAYMENT] },
			paymentStatus: PaymentStatus.PENDING,
		},
		select: {
			id: true,
			customerName: true,
			customerEmail: true,
			total: true,
			restaurant: { select: { id: true, slug: true } },
		},
	});
	const authorizationUrl = await initiateOrderPaymentForRestaurant({
		restaurantId: order.restaurant.id,
		orderId: order.id,
		restaurantSlug: order.restaurant.slug,
		customerName: order.customerName,
		customerEmail: order.customerEmail,
		amountKobo: Math.round(Number(order.total) * 100),
		preferredGateway,
	});
	redirect(authorizationUrl);
}

export async function selectInHousePaymentAction(formData: FormData) {
	const orderId = z.string().cuid().parse(formData.get("orderId"));
	const slug = z.string().min(1).parse(formData.get("slug"));
	const method = z
		.nativeEnum(DineInPaymentMethod)
		.parse(formData.get("method"));

	const order = await db.order.findFirstOrThrow({
		where: {
			id: orderId,
			restaurant: { slug, isActive: true },
			status: { in: [OrderStatus.CONFIRMED, OrderStatus.PENDING_PAYMENT] },
			paymentStatus: PaymentStatus.PENDING,
		},
		select: { id: true, restaurant: { select: { slug: true } } },
	});

	await db.order.update({
		where: { id: order.id },
		data: { dineInPaymentMethod: method },
	});

	revalidatePath(`/${order.restaurant.slug}/order/${order.id}`);
}

const updateOrderStatusSchema = z.object({
	orderId: z.string().cuid(),
	slug: z.string().min(1),
	status: z.nativeEnum(OrderStatus),
	statusNote: optionalString(500),
});

async function verifyOwnerPassword(userId: string, password: string) {
	const account = await db.account.findFirst({
		where: {
			userId,
			provider: "credential",
		},
		select: { password: true },
	});

	if (!account?.password) {
		throw new ActionError(
			"Password confirmation is unavailable for this account.",
		);
	}

	const validPassword = await verifyPassword({
		hash: account.password,
		password,
	});

	if (!validPassword) {
		throw new ActionError("Invalid password.");
	}
}

export async function updateOrderStatusAction(formData: FormData) {
	return actionResult(async () => {
		const user = await requireUser();
		const input = updateOrderStatusSchema.parse({
			orderId: formData.get("orderId"),
			slug: formData.get("slug"),
			status: formData.get("status"),
			statusNote: formData.get("statusNote"),
		});
		const restaurant = await db.restaurant.findFirstOrThrow({
			where: { slug: input.slug, ownerId: user.id },
			select: { id: true, slug: true },
		});

		if (input.status === OrderStatus.CANCELLED) {
			throw new ActionError(
				"Use the cancel confirmation flow to cancel orders.",
			);
		}

		const order = await db.order.findFirstOrThrow({
			where: { id: input.orderId, restaurantId: restaurant.id },
			select: {
				status: true,
				paymentStatus: true,
				type: true,
				dineInPaymentPolicy: true,
				dineInPaymentMethod: true,
			},
		});

		if (order.status === OrderStatus.CANCELLED) {
			throw new ActionError("Cancelled orders cannot be updated.");
		}

		// The UI only offers statuses in this order type's flow, but the action is
		// a public POST endpoint — a dine-in order must not be moved to
		// "Delivered" by anything that skips the UI.
		if (!isStatusAllowedForType(order.type, input.status)) {
			throw new ActionError("That status doesn't apply to this kind of order.");
		}

		const paymentRequiredBeforePreparation =
			order.type !== OrderType.DINE_IN ||
			(Boolean(order.dineInPaymentMethod) &&
				order.dineInPaymentPolicy !== PaymentPolicy.FLEXIBLE) ||
			order.dineInPaymentPolicy === PaymentPolicy.PAY_BEFORE_SERVICE;
		if (
			paymentRequiredBeforePreparation &&
			order.paymentStatus !== PaymentStatus.PAID &&
			input.status !== OrderStatus.CONFIRMED
		) {
			throw new ActionError(
				"Customer payment is required before preparing this order.",
			);
		}

		await db.order.update({
			where: { id: input.orderId, restaurantId: restaurant.id },
			data: {
				status: input.status,
				statusNote: input.statusNote ?? null,
			},
		});
		await dispatchNotification({
			restaurantId: restaurant.id,
			type: NotificationType.ORDER_STATUS_CHANGED,
			audience: NotificationAudience.BOTH,
			title: "Order status updated",
			body: `Order #${input.orderId.slice(-6).toUpperCase()} is now ${input.status.replace("_", " ")}`,
			actionUrl: `/dashboard/${restaurant.slug}/orders?orderId=${input.orderId}`,
			metadata: { orderId: input.orderId, status: input.status },
		});
		if (
			input.status === OrderStatus.COMPLETED ||
			input.status === OrderStatus.DELIVERED
		) {
			await notifyOrderCompleted(input.orderId);
		}
		// READY / DELIVERED / COMPLETED all reach the customer; anything else
		// is filtered out inside the notifier.
		await notifyCustomerOrderStatus(input.orderId, input.status);

		revalidatePath(`/dashboard/${restaurant.slug}/orders`);
		revalidatePath(`/${restaurant.slug}/order/${input.orderId}`);
	});
}

export async function acceptOrderAction(formData: FormData) {
	return actionResult(async () => {
		const staffSession = await getStaffSession();
		const user = staffSession ? null : await requireUser();
		const orderId = z.string().cuid().parse(formData.get("orderId"));
		const slug = z.string().min(1).parse(formData.get("slug"));

		const restaurant = await db.restaurant.findFirstOrThrow({
			where: staffSession
				? { slug, id: staffSession.restaurantId }
				: { slug, ownerId: user?.id },
			select: { id: true, slug: true },
		});

		const order = await db.order.findUniqueOrThrow({
			where: { id: orderId, restaurantId: restaurant.id },
			select: {
				id: true,
				status: true,
				type: true,
				paymentStatus: true,
				dineInPaymentPolicy: true,
				dineInPaymentMethod: true,
			},
		});

		if (order.status !== OrderStatus.PENDING_APPROVAL) {
			throw new ActionError("Only pending orders can be accepted.");
		}

		// A restaurant that chose "pay before service" has said the kitchen does
		// not start until the money is in. Accepting an unpaid order would put it
		// straight into the queue and quietly break that policy. Customers can
		// already pay while an order is pending approval, so this doesn't
		// deadlock — it waits for them.
		if (
			order.type === OrderType.DINE_IN &&
			order.dineInPaymentPolicy === PaymentPolicy.PAY_BEFORE_SERVICE &&
			order.paymentStatus !== PaymentStatus.PAID
		) {
			throw new ActionError(
				"This order is set to pay before service. Confirm the customer's payment first, then accept it.",
			);
		}

		const requiresOnlinePayment = order.type !== OrderType.DINE_IN;
		const requiresInHousePaymentConfirmation =
			order.type === OrderType.DINE_IN && !!order.dineInPaymentMethod;

		const nextStatus =
			requiresOnlinePayment || requiresInHousePaymentConfirmation
				? OrderStatus.PENDING_PAYMENT
				: OrderStatus.CONFIRMED;

		await db.order.update({
			where: { id: order.id },
			data: { status: nextStatus },
		});

		await dispatchNotification({
			restaurantId: restaurant.id,
			type: NotificationType.ORDER_STATUS_CHANGED,
			audience: NotificationAudience.BOTH,
			title: "Order accepted",
			body: `Order #${order.id.slice(-6).toUpperCase()} was accepted`,
			actionUrl: `/dashboard/${restaurant.slug}/orders?orderId=${order.id}`,
			metadata: { orderId: order.id, status: nextStatus },
		});

		// Only now is the customer told their order is confirmed.
		if (nextStatus === OrderStatus.CONFIRMED) {
			await notifyOrderConfirmed(order.id);
			await notifyCustomerOrderStatus(order.id, OrderStatus.CONFIRMED);
		}

		revalidatePath(`/dashboard/${restaurant.slug}/orders`);
		revalidatePath(`/${restaurant.slug}/order/${order.id}`);
	});
}

export async function cancelOrderAction(formData: FormData) {
	return actionResult(async () => {
		const user = await requireUser();
		const orderId = z.string().cuid().parse(formData.get("orderId"));
		const slug = z.string().min(1).parse(formData.get("slug"));
		const password = z.string().min(1).parse(formData.get("password"));
		const cancellationNote =
			optionalString(500).parse(formData.get("cancellationNote")) ??
			DEFAULT_DECLINE_REASON;
		const restaurant = await db.restaurant.findFirstOrThrow({
			where: { slug, ownerId: user.id },
			select: { id: true, slug: true },
		});

		const order = await db.order.findFirstOrThrow({
			where: { id: orderId, restaurantId: restaurant.id },
			select: { status: true },
		});

		if (order.status === OrderStatus.CANCELLED) {
			throw new ActionError("Order is already cancelled.");
		}

		if (order.status === OrderStatus.COMPLETED) {
			throw new ActionError("Completed orders cannot be cancelled.");
		}

		await verifyOwnerPassword(user.id, password);

		await db.order.update({
			where: { id: orderId, restaurantId: restaurant.id },
			data: {
				status: OrderStatus.CANCELLED,
				statusNote: null,
				cancelledById: user.id,
				cancelledAt: new Date(),
				cancellationNote,
			},
		});

		// A customer waiting on food they will never get is the worst silence
		// in the flow, so this one is sent even though it wasn't on the list.
		await notifyOrderCancelled(orderId, { reason: cancellationNote });
		await dispatchNotification({
			restaurantId: restaurant.id,
			type: NotificationType.ORDER_CANCELLED,
			audience: NotificationAudience.BOTH,
			title:
				order.status === OrderStatus.PENDING_PAYMENT
					? "Order declined"
					: "Order cancelled",
			body: `Order #${orderId.slice(-6).toUpperCase()} was ${
				order.status === OrderStatus.PENDING_PAYMENT ? "declined" : "cancelled"
			}`,
			actionUrl: `/dashboard/${restaurant.slug}/orders?orderId=${orderId}`,
			metadata: { orderId },
		});
		revalidatePath(`/dashboard/${restaurant.slug}/orders`);
		revalidatePath(`/${restaurant.slug}/order/${orderId}`);
	});
}

export async function markOrderPaidAction(formData: FormData) {
	return actionResult(async () => {
		const user = await requireUser();
		const orderId = z.string().cuid().parse(formData.get("orderId"));
		const slug = z.string().min(1).parse(formData.get("slug"));
		const restaurant = await db.restaurant.findFirstOrThrow({
			where: { slug, ownerId: user.id },
			select: { id: true, slug: true },
		});
		const order = await db.order.findFirstOrThrow({
			where: {
				id: orderId,
				restaurantId: restaurant.id,
				paymentStatus: PaymentStatus.PENDING,
			},
			select: {
				id: true,
				total: true,
				dineInPaymentMethod: true,
				dineInPaymentPolicy: true,
				status: true,
				type: true,
			},
		});

		if (order.status === OrderStatus.CANCELLED) {
			throw new ActionError("Cancelled orders cannot have payment confirmed.");
		}

		if (order.type !== OrderType.DINE_IN) {
			throw new ActionError(
				"Only dine-in orders can have in-house payment confirmed.",
			);
		}

		// The owner is confirming the full amount was taken in person, so the
		// order total is the credit — but it still goes through the ledger so
		// that cash and card payments appear in the same financial report.
		const credit = await creditOrder(order.id, {
			kind: "MANUAL",
			method:
				order.dineInPaymentMethod === DineInPaymentMethod.CASH
					? PaymentMethod.CASH
					: PaymentMethod.POS,
			amount: Number(order.total),
			recordedById: user.id,
		});

		if (!credit.ok) {
			throw new ActionError(credit.message);
		}

		await db.order.update({
			where: { id: order.id },
			data: {
				dineInAmountPaid: credit.amountPaid,
				dineInPaidMethod: order.dineInPaymentMethod ?? DineInPaymentMethod.CASH,
				dineInPaymentRecordedAt: new Date(),
			},
		});

		await recordAuditEvent({
			restaurantId: restaurant.id,
			actorType: AuditActorType.OWNER,
			actorId: user.id,
			actorName: user.name ?? user.email ?? "Owner",
			action: "payment.recorded",
			target: `Order #${order.id.slice(-6).toUpperCase()}`,
			newValue: `₦${Number(order.total).toLocaleString()}`,
		});

		if (credit.newlyPaid) {
			await notifyOrderPaid(order.id, {
				method:
					order.dineInPaymentMethod === "CASH" ? "Cash" : "Card or transfer",
			});
			if (order.status === OrderStatus.PENDING_PAYMENT) {
				await notifyOrderConfirmed(order.id);
			}
		}

		await dispatchNotification({
			restaurantId: restaurant.id,
			type: NotificationType.PAYMENT_RECEIVED,
			audience: NotificationAudience.ADMIN,
			title: "Payment recorded",
			body: `Order #${order.id.slice(-6).toUpperCase()} payment was confirmed`,
			actionUrl: `/dashboard/${restaurant.slug}/orders?orderId=${order.id}`,
			metadata: { orderId: order.id },
		});

		revalidatePath(`/dashboard/${restaurant.slug}/orders`);
		revalidatePath(`/${restaurant.slug}/order/${order.id}`);
		revalidatePath(`/${restaurant.slug}/staff`);
	});
}

const splitPaymentSchema = z.object({
	orderId: z.string().min(1),
	slug: z.string().min(1),
	cashAmount: z.coerce.number().min(0).default(0),
	posAmount: z.coerce.number().min(0).default(0),
	transferAmount: z.coerce.number().min(0).default(0),
});

export async function recordSplitPaymentAction(formData: FormData) {
	return actionResult(async () => {
		const input = splitPaymentSchema.parse({
			orderId: formData.get("orderId"),
			slug: formData.get("slug"),
			cashAmount: formData.get("cashAmount"),
			posAmount: formData.get("posAmount"),
			transferAmount: formData.get("transferAmount"),
		});

		const staffIdStr = formData.get("staffId")?.toString();

		let recordedById: string | undefined;
		// Captured for the audit trail, which has to survive the staff row being
		// deleted later.
		let recordedByName: string;
		let restaurant: { id: string; slug: string };

		if (staffIdStr) {
			const { staff, restaurant: res } = await verifyStaffAction(
				input.slug,
				staffIdStr,
			);
			recordedById = staff.id;
			recordedByName = staff.name;
			restaurant = res;
		} else {
			const user = await requireUser();
			restaurant = await db.restaurant.findFirstOrThrow({
				where: { slug: input.slug, ownerId: user.id },
				select: { id: true, slug: true },
			});
			recordedById = user.id;
			recordedByName = user.name ?? user.email ?? "Owner";
		}

		const order = await db.order.findUniqueOrThrow({
			where: { id: input.orderId, restaurantId: restaurant.id },
			select: { id: true, total: true, status: true, type: true },
		});

		if (order.status === OrderStatus.CANCELLED) {
			throw new ActionError("Cancelled orders cannot have payment confirmed.");
		}

		const totalInput =
			input.cashAmount + input.posAmount + input.transferAmount;

		if (totalInput < Number(order.total)) {
			throw new ActionError(
				`Total payment (${totalInput}) is less than order total (${order.total}).`,
			);
		}
		const payments: Array<{
			method: "CASH" | "POS" | "TRANSFER";
			amount: number;
			recordedById: string | undefined;
		}> = [];

		if (input.cashAmount > 0) {
			payments.push({
				method: "CASH" as const,
				amount: input.cashAmount,
				recordedById,
			});
		}
		if (input.posAmount > 0) {
			payments.push({
				method: "POS" as const,
				amount: input.posAmount,
				recordedById,
			});
		}
		if (input.transferAmount > 0) {
			payments.push({
				method: "TRANSFER" as const,
				amount: input.transferAmount,
				recordedById,
			});
		}

		// Each tender is its own ledger entry — that is what makes "₦2,000 cash
		// and ₦3,000 on the card" reportable afterwards rather than a single
		// undifferentiated ₦5,000. The order settles once they cover the total.
		let credit: Awaited<ReturnType<typeof creditOrder>> | null = null;
		for (const payment of payments) {
			credit = await creditOrder(order.id, {
				kind: "MANUAL",
				method: payment.method,
				amount: payment.amount,
				recordedById: payment.recordedById,
			});
			if (!credit.ok) {
				throw new ActionError(credit.message);
			}
		}

		await db.order.update({
			where: { id: order.id },
			data: {
				dineInAmountPaid: credit?.ok ? credit.amountPaid : totalInput,
				dineInPaymentRecordedAt: new Date(),
				events: {
					create: {
						staffId: staffIdStr ? recordedById : undefined,
						description: staffIdStr
							? `Recorded split payment of ₦${totalInput.toLocaleString()}`
							: `Admin recorded split payment of ₦${totalInput.toLocaleString()}`,
					},
				},
			},
		});

		await recordAuditEvent({
			restaurantId: restaurant.id,
			actorType: staffIdStr ? AuditActorType.STAFF : AuditActorType.OWNER,
			actorId: recordedById,
			actorName: recordedByName,
			action: "payment.recorded",
			target: `Order #${order.id.slice(-6).toUpperCase()}`,
			newValue: `Split ₦${totalInput.toLocaleString()}`,
		});

		// Deliberately not inside a transaction. These send email over the network,
		// and holding a Postgres transaction open across a third-party API call
		// blew the 5s interactive limit — P2028, "transaction already closed" —
		// which failed the whole payment after the rows had been written.
		if (credit?.ok && credit.newlyPaid) {
			await notifyOrderPaid(order.id, { method: "Split payment" });
			if (order.status === OrderStatus.PENDING_PAYMENT) {
				await notifyOrderConfirmed(order.id);
			}
		}

		await dispatchNotification({
			restaurantId: restaurant.id,
			type: NotificationType.PAYMENT_RECEIVED,
			audience: NotificationAudience.ADMIN,
			title: "Payment recorded",
			body: `Order #${order.id.slice(-6).toUpperCase()} payment was confirmed via split payment`,
			actionUrl: `/dashboard/${restaurant.slug}/orders?orderId=${order.id}`,
			metadata: { orderId: order.id },
		});

		revalidatePath(`/dashboard/${restaurant.slug}/orders`);
		revalidatePath(`/${restaurant.slug}/order/${order.id}`);
		revalidatePath(`/${restaurant.slug}/staff`);
	});
}
