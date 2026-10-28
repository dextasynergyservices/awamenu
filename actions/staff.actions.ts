"use server";

import {
	AuditActorType,
	DineInPaymentMethod,
	NotificationAudience,
	NotificationType,
	OrderStatus,
	OrderType,
	PaymentMethod,
	PaymentPolicy,
	PaymentStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, actionResult } from "@/lib/action-error";
import { recordAuditEvent } from "@/lib/audit";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";
import { notifyOrderConfirmed, notifyOrderPaid } from "@/lib/order-emails";
import { notifyCustomerOrderStatus } from "@/lib/order-messaging";
import {
	getStatusLabel,
	isStatusAllowedForType,
} from "@/lib/order-status-flow";
import { creditOrder } from "@/lib/payment-ledger";
import { revalidatePublicMenu } from "@/lib/public-menu";
import { cancelReservationExpiry } from "@/lib/qstash";
import { enforceRateLimit, getClientIp } from "@/lib/ratelimit";
import { approveReservation } from "@/lib/reservation-booking";
import {
	assertOwnerCanChange,
	assertStaffCanChange,
} from "@/lib/restaurant-access";
import { startOfNextDayIn } from "@/lib/restaurant-day";
import {
	decryptSecret,
	isEncryptedSecret,
	secretsMatch,
} from "@/lib/secret-box";
import { createStaffSession, destroyStaffSession } from "@/lib/staff-auth";
import { verifyStaffAction } from "@/lib/staff-guard";
import { generateStaffId } from "@/lib/staff-id";
import { issueStaffPin } from "@/lib/staff-pin";

// ─── Helpers ──────────────────────────────────────────

async function verifyOwnerPassword(userId: string, password: string) {
	const { verifyPassword } = await import("better-auth/crypto");
	const account = await db.account.findFirst({
		where: { userId, provider: "credential" },
		select: { password: true },
	});

	if (!account?.password) {
		throw new ActionError(
			"Password confirmation is unavailable for this account.",
		);
	}

	const valid = await verifyPassword({
		hash: account.password,
		password,
	});

	if (!valid) {
		throw new ActionError("Invalid password.");
	}
}

/**
 * Staff actions name who is acting with a Staff ID plus that member's PIN
 * (lib/staff-pin.ts). The shared staff password only unlocks the dashboard;
 * the PIN is what stops one staff member acting under a colleague's ID.
 */

// ─── Admin Actions ────────────────────────────────────

const createStaffSchema = z.object({
	slug: z.string().min(1),
	name: z.string().min(1).max(100),
});

export async function createStaffAction(formData: FormData) {
	const user = await requireUser();
	await assertOwnerCanChange(user.id, formData);
	const input = createStaffSchema.parse({
		slug: formData.get("slug"),
		name: formData.get("name"),
	});

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug: input.slug, ownerId: user.id },
		select: { id: true, slug: true, _count: { select: { staff: true } } },
	});

	const staffId = await generateUniqueStaffId();

	const member = await db.staffMember.create({
		data: {
			restaurantId: restaurant.id,
			name: input.name,
			staffId,
		},
		select: { id: true },
	});
	const pin = await issueStaffPin(member.id);

	revalidatePath(`/dashboard/${restaurant.slug}/staff`);
	// The PIN is returned once, for the owner to hand over; only its hash is kept.
	return { staffId, pin };
}

/**
 * `StaffMember.staffId` is globally unique, so a generated value has to be
 * checked against every restaurant's, not just this one's. Bounded rather than
 * looping forever — with a 33-character alphabet over 6 places a collision is
 * vanishingly unlikely, and failing loudly beats spinning.
 */
async function generateUniqueStaffId(): Promise<string> {
	for (let attempt = 0; attempt < 10; attempt++) {
		const candidate = generateStaffId();
		const taken = await db.staffMember.findUnique({
			where: { staffId: candidate },
			select: { id: true },
		});
		if (!taken) return candidate;
	}
	throw new ActionError(
		"Could not generate a unique Staff ID. Please try again.",
	);
}

const resetStaffPinSchema = z.object({
	slug: z.string().min(1),
	staffMemberId: z.string().cuid(),
});

/**
 * Issues a new PIN for one member: when they forget it, it has been seen, or
 * it is locked after wrong guesses. The old PIN stops working immediately.
 * The Staff ID is unchanged, and past orders keep their attribution.
 */
export async function resetStaffPinAction(formData: FormData) {
	const user = await requireUser();
	const input = resetStaffPinSchema.parse({
		slug: formData.get("slug"),
		staffMemberId: formData.get("staffMemberId"),
	});

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug: input.slug, ownerId: user.id },
		select: { id: true, slug: true },
	});

	// Scoped to the owner's restaurant before issuing anything.
	const member = await db.staffMember.findFirstOrThrow({
		where: { id: input.staffMemberId, restaurantId: restaurant.id },
		select: { id: true, name: true },
	});
	const pin = await issueStaffPin(member.id);

	await recordAuditEvent({
		restaurantId: restaurant.id,
		actorType: AuditActorType.OWNER,
		actorId: user.id,
		actorName: user.name,
		action: "staff.pin_reset",
		target: member.name,
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
	await assertOwnerCanChange(user.id, formData);
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
	await assertOwnerCanChange(user.id, formData);

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
	await assertOwnerCanChange(user.id, formData);
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
	return actionResult(async () => {
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

		// Keyed on the restaurant, not the client IP alone — a shared staff
		// password is guessable in relatively few attempts, so this needs to
		// cap attempts per-restaurant regardless of how many IPs an attacker
		// spreads guesses across (staff devices on the same network would
		// otherwise all share one IP-only bucket anyway).
		const clientIp = await getClientIp();
		await enforceRateLimit("staffLogin", `${clientIp}:${input.slug}`);
		// And per restaurant whatever the IP, which is what the comment above
		// promised: spreading guesses across addresses no longer helps.
		await enforceRateLimit("staffLoginRestaurant", input.slug);

		if (!restaurant?.staffDashboardPassword) {
			throw new ActionError("Invalid login credentials.");
		}

		// Passwords set from the settings form are encrypted (so the owner can read
		// them back). Anything stored before that change is a scrypt hash, which
		// still has to authenticate until the owner saves a new password.
		const stored = restaurant.staffDashboardPassword;
		const valid = isEncryptedSecret(stored)
			? (() => {
					const plain = decryptSecret(stored);
					return plain !== null && secretsMatch(plain, input.password);
				})()
			: await (await import("better-auth/crypto")).verifyPassword({
					hash: stored,
					password: input.password,
				});

		if (!valid) {
			throw new ActionError("Invalid password.");
		}

		await createStaffSession(
			"shared",
			restaurant.id,
			restaurant.slug,
			restaurant.staffDashboardAutoLockHours,
		);
		revalidatePath(`/${restaurant.slug}/staff`);
	});
}

export async function staffLogoutAction(slug: string) {
	await destroyStaffSession();
	redirect(`/${slug}/staff/login`);
}

// ─── Staff Order Actions ──────────────────────────────

const recordDineInPaymentSchema = z.object({
	slug: z.string().min(1),
	staffId: z.string().min(4).max(12),
	orderId: z.string().cuid(),
	amountPaid: z.number().positive(),
	paymentMethod: z.nativeEnum(DineInPaymentMethod),
});

export async function recordDineInPaymentAction(formData: FormData) {
	return actionResult(async () => {
		const input = recordDineInPaymentSchema.parse({
			slug: formData.get("slug"),
			staffId: formData.get("staffId"),
			orderId: formData.get("orderId"),
			amountPaid: Number(formData.get("amountPaid")),
			paymentMethod: formData.get("paymentMethod"),
		});

		const { staff, permissions, restaurant } = await verifyStaffAction(
			input.slug,
			input.staffId,
			String(formData.get("pin") ?? ""),
		);

		// Hiding the button in the UI isn't enforcement — this is a server action,
		// so it's reachable directly. Without this check a staff member whose
		// "Record Cash Payments" permission is off could still record one.
		if (!permissions.cashPayment) {
			throw new ActionError(
				"You do not have permission to record payments for this restaurant.",
			);
		}

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

		// The amount is typed by a person at a till, so it is not evidence of
		// anything on its own. The ledger settles the order only once the entries
		// actually cover the total — a short payment now leaves a balance owing
		// instead of reading as settled.
		const credit = await creditOrder(order.id, {
			kind: "MANUAL",
			method:
				input.paymentMethod === "CASH" ? PaymentMethod.CASH : PaymentMethod.POS,
			amount: input.amountPaid,
			recordedById: staff.id,
		});

		if (!credit.ok) {
			throw new ActionError(credit.message);
		}

		await db.order.update({
			where: { id: order.id },
			data: {
				attendingStaffId: staff.id,
				dineInAmountPaid: credit.amountPaid,
				dineInPaidMethod: input.paymentMethod,
				dineInPaymentRecordedAt: new Date(),
				events: {
					create: {
						staffId: staff.id,
						description: `Recorded ${input.paymentMethod === "CASH" ? "cash" : "POS/transfer"} payment of ₦${input.amountPaid.toLocaleString()}${
							credit.outstanding > 0
								? ` — ₦${credit.outstanding.toLocaleString()} still outstanding`
								: ""
						}`,
					},
				},
			},
		});

		await recordAuditEvent({
			restaurantId: restaurant.id,
			actorType: AuditActorType.STAFF,
			actorId: staff.id,
			actorName: staff.name,
			action: "payment.recorded",
			target: `Order #${order.id.slice(-6).toUpperCase()}`,
			newValue: `${input.paymentMethod} ₦${input.amountPaid.toLocaleString()}`,
		});

		if (credit.newlyPaid) {
			await notifyOrderPaid(input.orderId, {
				method: input.paymentMethod === "CASH" ? "Cash" : "POS or transfer",
			});
			if (order.status === OrderStatus.PENDING_PAYMENT) {
				await notifyOrderConfirmed(input.orderId);
				await notifyCustomerOrderStatus(input.orderId, OrderStatus.CONFIRMED);
			}
		}

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
		revalidatePath(`/${restaurant.slug}/staff`);
	});
}

const staffUpdateOrderStatusSchema = z.object({
	slug: z.string().min(1),
	staffId: z.string().min(4).max(12),
	orderId: z.string().cuid(),
	status: z.nativeEnum(OrderStatus),
});

export async function staffUpdateOrderStatusAction(formData: FormData) {
	return actionResult(async () => {
		const input = staffUpdateOrderStatusSchema.parse({
			slug: formData.get("slug"),
			staffId: formData.get("staffId"),
			orderId: formData.get("orderId"),
			status: formData.get("status"),
		});

		const { staff, permissions, restaurant } = await verifyStaffAction(
			input.slug,
			input.staffId,
			String(formData.get("pin") ?? ""),
		);

		// Cannot cancel or complete via this action
		if (
			input.status === OrderStatus.CANCELLED ||
			input.status === OrderStatus.COMPLETED
		) {
			throw new ActionError("Staff cannot cancel or directly complete orders.");
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
			throw new ActionError("Cancelled orders cannot be updated.");
		}

		if (!isStatusAllowedForType(order.type, input.status)) {
			throw new ActionError("That status doesn't apply to this kind of order.");
		}

		// Check type-based permission
		const typePermission: Record<OrderType, boolean> = {
			[OrderType.DINE_IN]: permissions.dineIn,
			[OrderType.PICKUP]: permissions.pickup,
			[OrderType.DELIVERY]: permissions.delivery,
			[OrderType.TABLE_RESERVATION]: permissions.dineIn,
		};

		if (!typePermission[order.type]) {
			throw new ActionError(
				"You do not have permission to manage this type of order.",
			);
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
			throw new ActionError(
				"Customer payment is required before preparing this order.",
			);
		}

		// Block completion if unpaid
		if (
			input.status === OrderStatus.DELIVERED &&
			order.paymentStatus !== PaymentStatus.PAID
		) {
			throw new ActionError(
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
			audience: NotificationAudience.ADMIN,
			title: `Order #${input.orderId.slice(-6).toUpperCase()}: ${getStatusLabel(order.type, input.status)}`,
			body: `Updated by ${staff.name}`,
			actionUrl: `/dashboard/${restaurant.slug}/orders?orderId=${input.orderId}`,
			metadata: {
				orderId: input.orderId,
				status: input.status,
				staffId: staff.id,
			},
		});

		revalidatePath(`/dashboard/${restaurant.slug}/orders`);
		revalidatePath(`/${restaurant.slug}/order/${input.orderId}`);
		revalidatePath(`/${restaurant.slug}/staff`);
	});
}

const staffApproveReservationSchema = z.object({
	slug: z.string().min(1),
	staffId: z.string().min(4).max(12),
	reservationId: z.string().cuid(),
});

export async function staffApproveReservationAction(formData: FormData) {
	return actionResult(async () => {
		const input = staffApproveReservationSchema.parse({
			slug: formData.get("slug"),
			staffId: formData.get("staffId"),
			reservationId: formData.get("reservationId"),
		});

		const { staff, permissions, restaurant } = await verifyStaffAction(
			input.slug,
			input.staffId,
			String(formData.get("pin") ?? ""),
		);

		await assertStaffCanChange(restaurant.id);
		if (!permissions.approveReservations) {
			throw new ActionError(
				"You do not have permission to approve reservations.",
			);
		}

		// The same approval the owner uses. This used to flip the status on its
		// own — no overlap check (so staff could double-book a table), no amount
		// due or payment deadline, and free bookings were left on APPROVED where
		// they never became active.
		const approved = await approveReservation({
			restaurantId: restaurant.id,
			reservationId: input.reservationId,
		});

		await dispatchNotification({
			restaurantId: restaurant.id,
			type: NotificationType.NEW_RESERVATION,
			audience: NotificationAudience.ADMIN,
			title: `Reservation approved — ${approved.tableLabel}`,
			body: `${staff.name} approved ${approved.customerName}'s reservation`,
			actionUrl: `/dashboard/${restaurant.slug}/reservations`,
			metadata: { reservationId: input.reservationId, staffId: staff.id },
		});

		revalidatePath(`/dashboard/${restaurant.slug}/reservations`);
		revalidatePath(`/${restaurant.slug}/tables`);
		revalidatePath(`/${restaurant.slug}/reservation/${input.reservationId}`);
		revalidatePath(`/${restaurant.slug}/staff`);
	});
}

const staffCheckInSchema = z.object({
	slug: z.string().min(1),
	staffId: z.string().min(4).max(12),
	reservationId: z.string().cuid(),
});

/**
 * Staff at the door check a guest in when they arrive.
 *
 * Only the owner could before, which left the people actually seating guests
 * unable to record it — and an unchecked-in booking is released as a no-show
 * once its grace window passes. Conditional, like the owner's check-in, so it
 * can't revive a booking the no-show sweep released a moment ago.
 */
export async function staffCheckInReservationAction(formData: FormData) {
	return actionResult(async () => {
		const input = staffCheckInSchema.parse({
			slug: formData.get("slug"),
			staffId: formData.get("staffId"),
			reservationId: formData.get("reservationId"),
		});

		const { staff, permissions, restaurant } = await verifyStaffAction(
			input.slug,
			input.staffId,
			String(formData.get("pin") ?? ""),
		);
		if (!permissions.dineIn) {
			throw new ActionError("You do not have permission to seat guests.");
		}

		const reservation = await db.reservation.findFirst({
			where: { id: input.reservationId, restaurantId: restaurant.id },
			select: {
				id: true,
				qstashMessageId: true,
				customerName: true,
				table: { select: { label: true } },
			},
		});
		if (!reservation) throw new ActionError("Reservation not found.");

		const { count } = await db.reservation.updateMany({
			where: { id: reservation.id, status: "ACTIVE" },
			data: { status: "CHECKED_IN", qstashMessageId: null },
		});
		if (count === 0) {
			throw new ActionError(
				"This booking can't be checked in — it may have expired or already been seated.",
			);
		}
		await cancelReservationExpiry(reservation.qstashMessageId);

		await recordAuditEvent({
			restaurantId: restaurant.id,
			actorType: AuditActorType.STAFF,
			actorId: staff.id,
			actorName: staff.name,
			action: "reservation.checked_in",
			target: `${reservation.customerName} — ${reservation.table.label}`,
		});

		revalidatePath(`/${restaurant.slug}/staff`);
		revalidatePath(`/dashboard/${restaurant.slug}/reservations`);
		revalidatePath(`/${restaurant.slug}/reservation/${reservation.id}`);
	});
}

const staffSoldOutSchema = z.object({
	slug: z.string().min(1),
	staffId: z.string().min(4).max(12),
	itemId: z.string().cuid(),
	soldOut: z.enum(["today", "off"]),
});

/**
 * The kitchen runs out mid-service: any staff member (Staff ID + PIN) can
 * mark a published dish sold out until tomorrow, or back in stock. Low risk,
 * so no extra permission, but recorded in the restaurant's audit trail.
 */
export async function staffSetSoldOutAction(formData: FormData) {
	return actionResult(async () => {
		const input = staffSoldOutSchema.parse({
			slug: formData.get("slug"),
			staffId: formData.get("staffId"),
			itemId: formData.get("itemId"),
			soldOut: formData.get("soldOut"),
		});

		const { staff, restaurant } = await verifyStaffAction(
			input.slug,
			input.staffId,
			String(formData.get("pin") ?? ""),
		);
		await assertStaffCanChange(restaurant.id);

		const item = await db.menuItem.findFirst({
			where: {
				id: input.itemId,
				isAvailable: true,
				category: { restaurantId: restaurant.id },
			},
			select: {
				id: true,
				name: true,
				category: { select: { restaurant: { select: { timezone: true } } } },
			},
		});
		if (!item) throw new ActionError("Dish not found.");

		await db.menuItem.update({
			where: { id: item.id },
			data: {
				soldOutUntil:
					input.soldOut === "today"
						? startOfNextDayIn(item.category.restaurant.timezone)
						: null,
			},
		});

		await recordAuditEvent({
			restaurantId: restaurant.id,
			actorType: AuditActorType.STAFF,
			actorId: staff.id,
			actorName: staff.name,
			action:
				input.soldOut === "today" ? "menu.sold_out" : "menu.back_in_stock",
			target: item.name,
		});

		revalidatePublicMenu(restaurant.slug);
		revalidatePath(`/${restaurant.slug}/staff`);
		revalidatePath(`/dashboard/${restaurant.slug}/menu`);
	});
}
