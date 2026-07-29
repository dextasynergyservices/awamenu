"use server";

import { createHash } from "node:crypto";
import {
	DineInPaymentMethod,
	NotificationAudience,
	NotificationType,
	OrderStatus,
	OrderType,
	PaymentPolicy,
	PaymentStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";
import { enforceRateLimit, getClientIp } from "@/lib/ratelimit";
import { createStaffSession, destroyStaffSession } from "@/lib/staff-auth";
import { generateStaffId } from "@/lib/staff-id";
import { resolveStaffPermissions } from "@/lib/staff-permissions";

function hashPin(pin: string): string {
	return createHash("sha256").update(pin).digest("hex");
}

// ─── Helpers ──────────────────────────────────────────

async function verifyOwnerPassword(userId: string, password: string) {
	const { verifyPassword } = await import("better-auth/crypto");
	const account = await db.account.findFirst({
		where: { userId, provider: "credential" },
		select: { password: true },
	});

	if (!account?.password) {
		throw new Error("Password confirmation is unavailable for this account.");
	}

	const valid = await verifyPassword({
		hash: account.password,
		password,
	});

	if (!valid) {
		throw new Error("Invalid password.");
	}
}

export async function verifyStaffAction(slug: string, pin: string) {
	const restaurant = await db.restaurant.findUnique({
		where: { slug, isActive: true },
		select: {
			id: true,
			slug: true,
			staffDefaultDineIn: true,
			staffDefaultPickup: true,
			staffDefaultDelivery: true,
			staffDefaultCashPayment: true,
			staffDefaultApproveReservations: true,
		},
	});

	if (!restaurant) {
		throw new Error("Restaurant not found.");
	}

	const clientIp = await getClientIp();
	await enforceRateLimit("staffPin", `${clientIp}:${restaurant.id}`);

	const staff = await db.staffMember.findFirst({
		where: {
			restaurantId: restaurant.id,
			pinHash: hashPin(pin),
			isActive: true,
		},
	});

	if (!staff) {
		throw new Error("Invalid Staff PIN.");
	}

	const permissions = resolveStaffPermissions(restaurant, staff);
	return { staff, permissions, restaurant };
}

// ─── Admin Actions ────────────────────────────────────

const createStaffSchema = z.object({
	slug: z.string().min(1),
	name: z.string().min(1).max(100),
});

export async function createStaffAction(formData: FormData) {
	const user = await requireUser();
	const input = createStaffSchema.parse({
		slug: formData.get("slug"),
		name: formData.get("name"),
	});

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug: input.slug, ownerId: user.id },
		select: { id: true, slug: true, _count: { select: { staff: true } } },
	});

	const staffId = generateStaffId(restaurant.slug, restaurant._count.staff + 1);

	let pin = "";
	let isUnique = false;
	while (!isUnique) {
		pin = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join(
			"",
		);
		const existing = await db.staffMember.findFirst({
			where: {
				restaurantId: restaurant.id,
				pinHash: hashPin(pin),
				isActive: true,
			},
		});
		if (!existing) isUnique = true;
	}

	await db.staffMember.create({
		data: {
			restaurantId: restaurant.id,
			name: input.name,
			staffId,
			pinHash: hashPin(pin),
		},
	});

	revalidatePath(`/dashboard/${restaurant.slug}/staff`);
	return { staffId, pin };
}

const resetPinSchema = z.object({
	slug: z.string().min(1),
	staffMemberId: z.string().cuid(),
});

export async function resetPinAction(formData: FormData) {
	const user = await requireUser();
	const input = resetPinSchema.parse({
		slug: formData.get("slug"),
		staffMemberId: formData.get("staffMemberId"),
	});

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug: input.slug, ownerId: user.id },
		select: { id: true, slug: true },
	});

	let pin = "";
	let isUnique = false;
	while (!isUnique) {
		pin = Array.from({ length: 4 }, () => Math.floor(Math.random() * 10)).join(
			"",
		);
		const existing = await db.staffMember.findFirst({
			where: {
				restaurantId: restaurant.id,
				pinHash: hashPin(pin),
				isActive: true,
			},
		});
		if (!existing) isUnique = true;
	}

	await db.staffMember.update({
		where: { id: input.staffMemberId, restaurantId: restaurant.id },
		data: { pinHash: hashPin(pin) },
	});

	revalidatePath(`/dashboard/${restaurant.slug}/staff`);
	return { pin };
}

const deactivateStaffSchema = z.object({
	slug: z.string().min(1),
	staffMemberId: z.string().cuid(),
	password: z.string().min(1),
});

export async function deactivateStaffAction(formData: FormData) {
	const user = await requireUser();
	const input = deactivateStaffSchema.parse({
		slug: formData.get("slug"),
		staffMemberId: formData.get("staffMemberId"),
		password: formData.get("password"),
	});

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug: input.slug, ownerId: user.id },
		select: { id: true, slug: true },
	});

	await verifyOwnerPassword(user.id, input.password);

	await db.staffMember.update({
		where: { id: input.staffMemberId, restaurantId: restaurant.id },
		data: { isActive: false },
	});

	revalidatePath(`/dashboard/${restaurant.slug}/staff`);
}

const reactivateStaffSchema = z.object({
	slug: z.string().min(1),
	staffMemberId: z.string().cuid(),
});

export async function reactivateStaffAction(formData: FormData) {
	const user = await requireUser();
	const input = reactivateStaffSchema.parse({
		slug: formData.get("slug"),
		staffMemberId: formData.get("staffMemberId"),
	});

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug: input.slug, ownerId: user.id },
		select: { id: true, slug: true },
	});

	await db.staffMember.update({
		where: { id: input.staffMemberId, restaurantId: restaurant.id },
		data: { isActive: true },
	});

	revalidatePath(`/dashboard/${restaurant.slug}/staff`);
}

const updateStaffPermissionsSchema = z.object({
	slug: z.string().min(1),
	staffMemberId: z.string().cuid(),
	canHandleDineIn: z.boolean().nullable(),
	canHandlePickup: z.boolean().nullable(),
	canHandleDelivery: z.boolean().nullable(),
	canRecordCashPayment: z.boolean().nullable(),
	canApproveReservations: z.boolean().nullable(),
});

export async function updateStaffPermissionsAction(formData: FormData) {
	const user = await requireUser();

	function parseBooleanOrNull(value: FormDataEntryValue | null) {
		if (value === null || value === "null" || value === "") return null;
		return value === "true";
	}

	const input = updateStaffPermissionsSchema.parse({
		slug: formData.get("slug"),
		staffMemberId: formData.get("staffMemberId"),
		canHandleDineIn: parseBooleanOrNull(formData.get("canHandleDineIn")),
		canHandlePickup: parseBooleanOrNull(formData.get("canHandlePickup")),
		canHandleDelivery: parseBooleanOrNull(formData.get("canHandleDelivery")),
		canRecordCashPayment: parseBooleanOrNull(
			formData.get("canRecordCashPayment"),
		),
		canApproveReservations: parseBooleanOrNull(
			formData.get("canApproveReservations"),
		),
	});

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug: input.slug, ownerId: user.id },
		select: { id: true, slug: true },
	});

	await db.staffMember.update({
		where: { id: input.staffMemberId, restaurantId: restaurant.id },
		data: {
			canHandleDineIn: input.canHandleDineIn,
			canHandlePickup: input.canHandlePickup,
			canHandleDelivery: input.canHandleDelivery,
			canRecordCashPayment: input.canRecordCashPayment,
			canApproveReservations: input.canApproveReservations,
		},
	});

	revalidatePath(`/dashboard/${restaurant.slug}/staff`);
}

const updateGlobalStaffPermissionsSchema = z.object({
	slug: z.string().min(1),
	staffDefaultDineIn: z.boolean(),
	staffDefaultPickup: z.boolean(),
	staffDefaultDelivery: z.boolean(),
	staffDefaultCashPayment: z.boolean(),
	staffDefaultApproveReservations: z.boolean(),
});

export async function updateGlobalStaffPermissionsAction(formData: FormData) {
	const user = await requireUser();
	const input = updateGlobalStaffPermissionsSchema.parse({
		slug: formData.get("slug"),
		staffDefaultDineIn: formData.get("staffDefaultDineIn") === "true",
		staffDefaultPickup: formData.get("staffDefaultPickup") === "true",
		staffDefaultDelivery: formData.get("staffDefaultDelivery") === "true",
		staffDefaultCashPayment: formData.get("staffDefaultCashPayment") === "true",
		staffDefaultApproveReservations:
			formData.get("staffDefaultApproveReservations") === "true",
	});

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug: input.slug, ownerId: user.id },
		select: { id: true, slug: true },
	});

	await db.restaurant.update({
		where: { id: restaurant.id },
		data: {
			staffDefaultDineIn: input.staffDefaultDineIn,
			staffDefaultPickup: input.staffDefaultPickup,
			staffDefaultDelivery: input.staffDefaultDelivery,
			staffDefaultCashPayment: input.staffDefaultCashPayment,
			staffDefaultApproveReservations: input.staffDefaultApproveReservations,
		},
	});

	revalidatePath(`/dashboard/${restaurant.slug}/staff`);
}

// ─── Staff Login & Auth Actions ───────────────────────

const staffLoginSchema = z.object({
	slug: z.string().min(1),
	password: z.string().min(1),
});

export async function staffLoginAction(formData: FormData) {
	const input = staffLoginSchema.parse({
		slug: formData.get("slug"),
		password: formData.get("password"),
	});

	const restaurant = await db.restaurant.findFirst({
		where: { slug: input.slug, isActive: true },
		select: {
			id: true,
			slug: true,
			staffDashboardPassword: true,
			staffDashboardAutoLockHours: true,
		},
	});

	if (!restaurant?.staffDashboardPassword) {
		throw new Error("Invalid login credentials.");
	}

	if (restaurant.staffDashboardPassword !== input.password) {
		throw new Error("Invalid password.");
	}

	await createStaffSession(
		"shared",
		restaurant.id,
		restaurant.slug,
		restaurant.staffDashboardAutoLockHours,
	);
	revalidatePath(`/staff/${restaurant.slug}`);
}

export async function staffLogoutAction(slug: string) {
	await destroyStaffSession();
	redirect(`/staff/${slug}/login`);
}

// ─── Staff Order Actions ──────────────────────────────

const recordDineInPaymentSchema = z.object({
	slug: z.string().min(1),
	pin: z.string().length(4),
	orderId: z.string().cuid(),
	amountPaid: z.number().positive(),
	paymentMethod: z.nativeEnum(DineInPaymentMethod),
});

export async function recordDineInPaymentAction(formData: FormData) {
	const input = recordDineInPaymentSchema.parse({
		slug: formData.get("slug"),
		pin: formData.get("pin"),
		orderId: formData.get("orderId"),
		amountPaid: Number(formData.get("amountPaid")),
		paymentMethod: formData.get("paymentMethod"),
	});

	const { staff, restaurant } = await verifyStaffAction(input.slug, input.pin);

	const order = await db.order.findFirstOrThrow({
		where: {
			id: input.orderId,
			restaurantId: restaurant.id,
			type: OrderType.DINE_IN,
			paymentStatus: PaymentStatus.PENDING,
		},
		select: {
			id: true,
			total: true,
			status: true,
			restaurant: { select: { slug: true } },
		},
	});

	await db.order.update({
		where: { id: order.id },
		data: {
			attendingStaffId: staff.id,
			dineInAmountPaid: input.amountPaid,
			dineInPaidMethod: input.paymentMethod,
			dineInPaymentRecordedAt: new Date(),
			paymentStatus: PaymentStatus.PAID,
			status:
				order.status === OrderStatus.PENDING_PAYMENT
					? OrderStatus.CONFIRMED
					: order.status,
			events: {
				create: {
					staffId: staff.id,
					description: `Recorded ${input.paymentMethod === "CASH" ? "cash" : "POS/transfer"} payment of ₦${input.amountPaid.toLocaleString()}`,
				},
			},
		},
	});

	await dispatchNotification({
		restaurantId: restaurant.id,
		type: NotificationType.PAYMENT_RECEIVED,
		audience: NotificationAudience.ADMIN,
		title: `Payment recorded — #${order.id.slice(-6).toUpperCase()}`,
		body: `${staff.name} recorded ${input.paymentMethod === "CASH" ? "cash" : "POS/transfer"} payment of ₦${input.amountPaid.toLocaleString()}`,
		actionUrl: `/dashboard/${restaurant.slug}/orders?orderId=${order.id}`,
		metadata: { orderId: order.id, staffId: staff.id },
	});

	revalidatePath(`/dashboard/${restaurant.slug}/orders`);
	revalidatePath(`/${restaurant.slug}/order/${order.id}`);
	revalidatePath(`/staff/${restaurant.slug}`);
}

const staffUpdateOrderStatusSchema = z.object({
	slug: z.string().min(1),
	pin: z.string().length(4),
	orderId: z.string().cuid(),
	status: z.nativeEnum(OrderStatus),
});

export async function staffUpdateOrderStatusAction(formData: FormData) {
	const input = staffUpdateOrderStatusSchema.parse({
		slug: formData.get("slug"),
		pin: formData.get("pin"),
		orderId: formData.get("orderId"),
		status: formData.get("status"),
	});

	const { staff, permissions, restaurant } = await verifyStaffAction(
		input.slug,
		input.pin,
	);

	// Cannot cancel or complete via this action
	if (
		input.status === OrderStatus.CANCELLED ||
		input.status === OrderStatus.COMPLETED
	) {
		throw new Error("Staff cannot cancel or directly complete orders.");
	}

	const order = await db.order.findFirstOrThrow({
		where: { id: input.orderId, restaurantId: restaurant.id },
		select: {
			id: true,
			status: true,
			type: true,
			paymentStatus: true,
			dineInPaymentPolicy: true,
			dineInPaymentMethod: true,
		},
	});

	if (order.status === OrderStatus.CANCELLED) {
		throw new Error("Cancelled orders cannot be updated.");
	}

	// Check type-based permission
	const typePermission: Record<OrderType, boolean> = {
		[OrderType.DINE_IN]: permissions.dineIn,
		[OrderType.PICKUP]: permissions.pickup,
		[OrderType.DELIVERY]: permissions.delivery,
		[OrderType.TABLE_RESERVATION]: permissions.dineIn,
	};

	if (!typePermission[order.type]) {
		throw new Error("You do not have permission to manage this type of order.");
	}

	// Check payment before preparing (non pay-after-service)
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

	// Block completion if unpaid
	if (
		input.status === OrderStatus.DELIVERED &&
		order.paymentStatus !== PaymentStatus.PAID
	) {
		throw new Error(
			"Order cannot be marked as complete until payment is received.",
		);
	}

	await db.order.update({
		where: { id: input.orderId },
		data: {
			status: input.status,
			attendingStaffId: staff.id,
			events: {
				create: {
					staffId: staff.id,
					description: `Status changed to ${input.status.replace(/_/g, " ")}`,
				},
			},
		},
	});

	await dispatchNotification({
		restaurantId: restaurant.id,
		type: NotificationType.ORDER_STATUS_CHANGED,
		audience: NotificationAudience.BOTH,
		title: "Order status updated",
		body: `${staff.name} updated order #${input.orderId.slice(-6).toUpperCase()} to ${input.status.replace(/_/g, " ")}`,
		actionUrl: `/dashboard/${restaurant.slug}/orders?orderId=${input.orderId}`,
		metadata: {
			orderId: input.orderId,
			status: input.status,
			staffId: staff.id,
		},
	});

	revalidatePath(`/dashboard/${restaurant.slug}/orders`);
	revalidatePath(`/${restaurant.slug}/order/${input.orderId}`);
	revalidatePath(`/staff/${restaurant.slug}`);
}

const staffApproveReservationSchema = z.object({
	slug: z.string().min(1),
	pin: z.string().length(4),
	reservationId: z.string().cuid(),
});

export async function staffApproveReservationAction(formData: FormData) {
	const input = staffApproveReservationSchema.parse({
		slug: formData.get("slug"),
		pin: formData.get("pin"),
		reservationId: formData.get("reservationId"),
	});

	const { staff, permissions, restaurant } = await verifyStaffAction(
		input.slug,
		input.pin,
	);

	if (!permissions.approveReservations) {
		throw new Error("You do not have permission to approve reservations.");
	}

	const reservation = await db.reservation.findFirstOrThrow({
		where: {
			id: input.reservationId,
			restaurantId: restaurant.id,
			status: "PENDING_APPROVAL",
		},
		select: {
			id: true,
			customerName: true,
			table: { select: { label: true } },
		},
	});

	await db.reservation.update({
		where: { id: reservation.id },
		data: {
			status: "APPROVED",
			approvedAt: new Date(),
		},
	});

	await dispatchNotification({
		restaurantId: restaurant.id,
		type: NotificationType.NEW_RESERVATION,
		audience: NotificationAudience.ADMIN,
		title: `Reservation approved — ${reservation.table.label}`,
		body: `${staff.name} approved ${reservation.customerName}'s reservation`,
		actionUrl: `/dashboard/${restaurant.slug}/reservations`,
		metadata: { reservationId: reservation.id, staffId: staff.id },
	});

	revalidatePath(`/dashboard/${restaurant.slug}/reservations`);
	revalidatePath(`/staff/${restaurant.slug}`);
}
