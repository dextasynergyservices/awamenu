"use server";

import {
	DineInPaymentMethod,
	DineInServiceMode,
	NotificationAudience,
	NotificationType,
	OrderStatus,
	OrderType,
	PaymentPolicy,
	PaymentStatus,
} from "@prisma/client";
import { verifyPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";
import { notifyNewOrder } from "@/lib/order-notifications";
import { initiateOrderPayment } from "@/lib/payments";
import { getStaffSession } from "@/lib/staff-auth";
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
		throw new Error("This order type is not available for this restaurant.");
	}

	if (input.type === OrderType.TABLE_RESERVATION) {
		throw new Error("Please use the table reservation flow for reservations.");
	}

	if (input.type === OrderType.DINE_IN && !input.tableNumber) {
		throw new Error("Table number is required for dine-in orders.");
	}

	if (
		input.type === OrderType.DINE_IN &&
		input.dineInServiceMode === DineInServiceMode.SERVED_BY_WAITER &&
		!input.waiterName
	) {
		throw new Error(
			"Waiter name is required when the order is served by staff.",
		);
	}

	if (input.type === OrderType.DELIVERY && !input.deliveryAddress) {
		throw new Error("Delivery address is required for delivery orders.");
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
		throw new Error("Some cart items are unavailable.");
	}

	const lines = input.items.map((item) => {
		const menuItem = menuItems.find((entry) => entry.id === item.id);
		if (!menuItem) throw new Error("Invalid cart item.");

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
		throw new Error(
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
}

export async function initiateOrderPaymentAction(formData: FormData) {
	const orderId = z.string().cuid().parse(formData.get("orderId"));
	const slug = z.string().min(1).parse(formData.get("slug"));
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
			restaurant: { select: { slug: true } },
		},
	});
	const authorizationUrl = await initiateOrderPayment({
		orderId: order.id,
		restaurantSlug: order.restaurant.slug,
		customerName: order.customerName,
		customerEmail: order.customerEmail,
		amountKobo: Math.round(Number(order.total) * 100),
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
		throw new Error("Password confirmation is unavailable for this account.");
	}

	const validPassword = await verifyPassword({
		hash: account.password,
		password,
	});

	if (!validPassword) {
		throw new Error("Invalid password.");
	}
}

export async function updateOrderStatusAction(formData: FormData) {
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
		throw new Error("Use the cancel confirmation flow to cancel orders.");
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
		throw new Error("Cancelled orders cannot be updated.");
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
		throw new Error(
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
	revalidatePath(`/dashboard/${restaurant.slug}/orders`);
	revalidatePath(`/${restaurant.slug}/order/${input.orderId}`);
}

export async function acceptOrderAction(formData: FormData) {
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
			dineInPaymentPolicy: true,
			dineInPaymentMethod: true,
		},
	});

	if (order.status !== OrderStatus.PENDING_APPROVAL) {
		throw new Error("Only pending orders can be accepted.");
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

	revalidatePath(`/dashboard/${restaurant.slug}/orders`);
	revalidatePath(`/${restaurant.slug}/order/${order.id}`);
}

export async function cancelOrderAction(formData: FormData) {
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
		throw new Error("Order is already cancelled.");
	}

	if (order.status === OrderStatus.COMPLETED) {
		throw new Error("Completed orders cannot be cancelled.");
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
}

export async function markOrderPaidAction(formData: FormData) {
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
		throw new Error("Cancelled orders cannot have payment confirmed.");
	}

	if (order.type !== OrderType.DINE_IN) {
		throw new Error("Only dine-in orders can have in-house payment confirmed.");
	}

	await db.order.update({
		where: { id: order.id },
		data: {
			status:
				order.status === OrderStatus.PENDING_PAYMENT
					? OrderStatus.CONFIRMED
					: order.status,
			paymentStatus: PaymentStatus.PAID,
			dineInAmountPaid: order.total,
			dineInPaidMethod: order.dineInPaymentMethod ?? DineInPaymentMethod.CASH,
			dineInPaymentRecordedAt: new Date(),
		},
	});

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
	revalidatePath(`/staff/${restaurant.slug}`);
}

const splitPaymentSchema = z.object({
	orderId: z.string().min(1),
	slug: z.string().min(1),
	cashAmount: z.coerce.number().min(0).default(0),
	posAmount: z.coerce.number().min(0).default(0),
	transferAmount: z.coerce.number().min(0).default(0),
});

export async function recordSplitPaymentAction(formData: FormData) {
	const input = splitPaymentSchema.parse({
		orderId: formData.get("orderId"),
		slug: formData.get("slug"),
		cashAmount: formData.get("cashAmount"),
		posAmount: formData.get("posAmount"),
		transferAmount: formData.get("transferAmount"),
	});

	const pinStr = formData.get("pin")?.toString();

	let recordedById: string | undefined;
	let restaurant: { id: string; slug: string };

	if (pinStr) {
		const { staff, restaurant: res } = await verifyStaffAction(
			input.slug,
			pinStr,
		);
		recordedById = staff.id;
		restaurant = res;
	} else {
		const user = await requireUser();
		restaurant = await db.restaurant.findFirstOrThrow({
			where: { slug: input.slug, ownerId: user.id },
			select: { id: true, slug: true },
		});
		recordedById = user.id;
	}

	const order = await db.order.findUniqueOrThrow({
		where: { id: input.orderId, restaurantId: restaurant.id },
		select: { id: true, total: true, status: true, type: true },
	});

	if (order.status === OrderStatus.CANCELLED) {
		throw new Error("Cancelled orders cannot have payment confirmed.");
	}

	const totalInput = input.cashAmount + input.posAmount + input.transferAmount;

	if (totalInput < Number(order.total)) {
		throw new Error(
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

	await db.$transaction(async (tx) => {
		for (const payment of payments) {
			await tx.orderPayment.create({
				data: {
					orderId: order.id,
					method: payment.method,
					amount: payment.amount,
					recordedById: payment.recordedById,
				},
			});
		}

		await tx.order.update({
			where: { id: order.id },
			data: {
				status:
					order.status === OrderStatus.PENDING_PAYMENT
						? OrderStatus.CONFIRMED
						: order.status,
				paymentStatus: PaymentStatus.PAID,
				dineInAmountPaid: totalInput,
				dineInPaymentRecordedAt: new Date(),
				events: {
					create: {
						staffId: pinStr ? recordedById : undefined,
						description: pinStr
							? `Recorded split payment of ₦${totalInput.toLocaleString()}`
							: `Admin recorded split payment of ₦${totalInput.toLocaleString()}`,
					},
				},
			},
		});
	});

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
	revalidatePath(`/staff/${restaurant.slug}`);
}
