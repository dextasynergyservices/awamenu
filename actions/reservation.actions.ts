"use server";

import {
	NotificationAudience,
	NotificationType,
	OrderStatus,
	OrderType,
	PaymentStatus,
	ReservationStatus,
	TableBookingMode,
	TableInclusionType,
	TablePaymentTiming,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";
import { initiateReservationPayment } from "@/lib/payments";
import {
	cancelReservationExpiry,
	scheduleReservationExpiry,
} from "@/lib/qstash";
import { resolveEffectivePolicy } from "@/lib/reservation-policy";

const reservationItemSchema = z.object({
	id: z.string().cuid(),
	quantity: z.number().int().min(1).max(99),
	notes: z.string().max(300).optional(),
});

const createReservationSchema = z.object({
	slug: z.string().min(1),
	tableId: z.string().cuid(),
	customerName: z.string().trim().min(1).max(100),
	customerPhone: z.string().trim().min(3).max(40),
	customerEmail: z.preprocess(
		(value) =>
			typeof value === "string" && value.trim() === "" ? undefined : value,
		z.string().trim().email().max(120).optional(),
	),
	partySize: z.coerce.number().int().min(1).max(100),
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	time: z.string().regex(/^\d{2}:\d{2}$/),
	specialRequests: z.preprocess(
		(value) =>
			typeof value === "string" && value.trim() === "" ? undefined : value,
		z.string().trim().max(500).optional(),
	),
	items: z.array(reservationItemSchema),
});

const optionalMoneySchema = z.preprocess(
	(value) => (typeof value === "string" && value.trim() === "" ? null : value),
	z.coerce.number().min(0).nullable(),
);

const optionalBookingModeSchema = z.preprocess(
	(value) => (value === "" ? null : value),
	z.nativeEnum(TableBookingMode).nullable(),
);

const optionalPaymentTimingSchema = z.preprocess(
	(value) => (value === "" ? null : value),
	z.nativeEnum(TablePaymentTiming).nullable(),
);

const optionalInclusionTypeSchema = z.preprocess(
	(value) => (value === "" ? null : value),
	z.nativeEnum(TableInclusionType).nullable(),
);

const reservationSettingSchema = z.object({
	slug: z.string().min(1),
	tableReservationEnabled: z.boolean(),
	bookingMode: z.nativeEnum(TableBookingMode),
	paymentTiming: z.nativeEnum(TablePaymentTiming),
	inclusionType: z.nativeEnum(TableInclusionType),
	defaultTableFee: optionalMoneySchema,
	advanceBookingHours: z.coerce.number().int().min(0).max(8760),
	holdDurationMinutes: z.coerce.number().int().min(15).max(480),
	minPartySize: z.coerce.number().int().min(1).max(100),
	maxPartySize: z.coerce.number().int().min(0).max(500),
	bookingDescription: z.preprocess(
		(value) =>
			typeof value === "string" && value.trim() === "" ? null : value,
		z.string().trim().max(500).nullable(),
	),
	cancellationPolicy: z.preprocess(
		(value) =>
			typeof value === "string" && value.trim() === "" ? null : value,
		z.string().trim().max(1000).nullable(),
	),
});

const tableSeatSchema = z.object({
	slug: z.string().min(1),
	label: z.string().trim().min(1).max(80),
	description: z.preprocess(
		(value) =>
			typeof value === "string" && value.trim() === "" ? null : value,
		z.string().trim().max(240).nullable(),
	),
	capacity: z.coerce.number().int().min(1).max(100),
	sortOrder: z.coerce.number().int().min(0).max(9999),
	isActive: z.boolean(),
	bookingModeOverride: optionalBookingModeSchema,
	paymentTimingOverride: optionalPaymentTimingSchema,
	inclusionTypeOverride: optionalInclusionTypeSchema,
	tableFee: optionalMoneySchema,
	minimumSpend: optionalMoneySchema,
});

const updateTableSeatSchema = tableSeatSchema.extend({
	tableId: z.string().cuid(),
});

const tableSeatIdSchema = z.object({
	slug: z.string().min(1),
	tableId: z.string().cuid(),
});

const reservationIdSchema = z.object({
	slug: z.string().min(1),
	reservationId: z.string().cuid(),
});

async function requireOwnedRestaurantBySlug(slug: string) {
	const user = await requireUser();
	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		select: { id: true, slug: true, name: true },
	});

	if (!restaurant) {
		throw new Error("Restaurant not found.");
	}

	return restaurant;
}

function revalidateReservationAdminPaths(slug: string) {
	revalidatePath(`/dashboard/${slug}/tables`);
	revalidatePath(`/dashboard/${slug}/reservations`);
	revalidatePath(`/${slug}`);
	revalidatePath(`/${slug}/tables`);
}

function shouldRequireFood(
	bookingMode: TableBookingMode,
	inclusionType: TableInclusionType,
) {
	return (
		bookingMode === TableBookingMode.ORDER_REQUIRED ||
		inclusionType === TableInclusionType.FOOD_ONLY ||
		inclusionType === TableInclusionType.FOOD_AND_TABLE_FEE
	);
}

function shouldChargeTableFee(
	bookingMode: TableBookingMode,
	inclusionType: TableInclusionType,
) {
	return (
		(bookingMode === TableBookingMode.DEPOSIT_REQUIRED ||
			bookingMode === TableBookingMode.FULL_PAYMENT) &&
		(inclusionType === TableInclusionType.TABLE_FEE_ONLY ||
			inclusionType === TableInclusionType.FOOD_AND_TABLE_FEE)
	);
}

export async function createReservationAction(formData: FormData) {
	const input = createReservationSchema.parse({
		slug: formData.get("slug"),
		tableId: formData.get("tableId"),
		customerName: formData.get("customerName"),
		customerPhone: formData.get("customerPhone"),
		customerEmail: formData.get("customerEmail"),
		partySize: formData.get("partySize"),
		date: formData.get("date"),
		time: formData.get("time"),
		specialRequests: formData.get("specialRequests"),
		items: JSON.parse(String(formData.get("items") ?? "[]")),
	});
	const startsAt = new Date(`${input.date}T${input.time}:00`);

	if (Number.isNaN(startsAt.getTime())) {
		throw new Error("Choose a valid reservation date and time.");
	}

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: {
			slug: input.slug,
			isActive: true,
			tableReservationEnabled: true,
		},
		select: {
			id: true,
			slug: true,
			name: true,
			currency: true,
			reservationSetting: true,
		},
	});
	const setting =
		restaurant.reservationSetting ??
		({
			bookingMode: TableBookingMode.FREE_BOOKING,
			paymentTiming: TablePaymentTiming.PAY_ON_ARRIVAL,
			inclusionType: TableInclusionType.TABLE_FEE_ONLY,
			defaultTableFee: null,
			advanceBookingHours: 0,
			holdDurationMinutes: 60,
			minPartySize: 1,
			maxPartySize: 0,
			cancellationPolicy: null,
			bookingDescription: null,
		} as const);

	if (input.partySize < setting.minPartySize) {
		throw new Error(`Minimum party size is ${setting.minPartySize}.`);
	}

	if (setting.maxPartySize > 0 && input.partySize > setting.maxPartySize) {
		throw new Error(`Maximum party size is ${setting.maxPartySize}.`);
	}

	const earliestStart = new Date(
		Date.now() + setting.advanceBookingHours * 60 * 60 * 1000,
	);
	earliestStart.setSeconds(0, 0);
	if (startsAt < earliestStart) {
		throw new Error("This reservation time is no longer available.");
	}

	const endsAt = new Date(
		startsAt.getTime() + setting.holdDurationMinutes * 60 * 1000,
	);
	const table = await db.tableSeat.findFirstOrThrow({
		where: {
			id: input.tableId,
			restaurantId: restaurant.id,
			isActive: true,
		},
	});

	if (input.partySize > table.capacity) {
		throw new Error(`${table.label} seats up to ${table.capacity} guests.`);
	}

	const overlappingReservation = await db.reservation.findFirst({
		where: {
			tableId: table.id,
			status: "ACTIVE",
			startsAt: { lt: endsAt },
			expiresAt: { gt: startsAt },
		},
		select: { id: true },
	});

	if (overlappingReservation) {
		throw new Error("This table is already reserved for that time.");
	}

	const policy = resolveEffectivePolicy(setting, table);
	const requiresFood = shouldRequireFood(
		policy.bookingMode,
		policy.inclusionType,
	);

	if (requiresFood && input.items.length === 0) {
		throw new Error("Please choose food items for this reservation.");
	}

	const menuItems =
		input.items.length > 0
			? await db.menuItem.findMany({
					where: {
						id: { in: input.items.map((item) => item.id) },
						isAvailable: true,
						category: { restaurantId: restaurant.id, isActive: true },
					},
					select: { id: true, name: true, price: true },
				})
			: [];

	if (menuItems.length !== input.items.length) {
		throw new Error("Some selected food items are unavailable.");
	}

	const lines = input.items.map((item) => {
		const menuItem = menuItems.find((entry) => entry.id === item.id);
		if (!menuItem) throw new Error("Invalid food item.");

		return {
			menuItemId: menuItem.id,
			name: menuItem.name,
			unitPrice: Number(menuItem.price),
			qty: item.quantity,
			notes: item.notes,
		};
	});
	const foodTotal = lines.reduce(
		(total, line) => total + line.unitPrice * line.qty,
		0,
	);
	const tableFee = Number(policy.tableFee ?? 0);
	const amountDueNow =
		policy.paymentTiming === TablePaymentTiming.PAY_ON_BOOKING
			? (policy.bookingMode === TableBookingMode.ORDER_REQUIRED &&
				policy.inclusionType === TableInclusionType.FOOD_ONLY
					? foodTotal
					: 0) +
				(shouldChargeTableFee(policy.bookingMode, policy.inclusionType)
					? tableFee
					: 0) +
				(shouldChargeTableFee(policy.bookingMode, policy.inclusionType) &&
				policy.inclusionType === TableInclusionType.FOOD_AND_TABLE_FEE
					? foodTotal
					: 0)
			: 0;

	const reservation = await db.$transaction(async (tx) => {
		const preOrder =
			lines.length > 0
				? await tx.order.create({
						data: {
							restaurantId: restaurant.id,
							customerName: input.customerName,
							customerPhone: input.customerPhone,
							customerEmail: input.customerEmail,
							type: OrderType.TABLE_RESERVATION,
							status:
								amountDueNow > 0
									? OrderStatus.PENDING_PAYMENT
									: OrderStatus.CONFIRMED,
							paymentStatus:
								amountDueNow > 0 ? PaymentStatus.PENDING : PaymentStatus.PAID,
							tableId: table.id,
							tableLabel: table.label,
							tableNumber: table.label,
							deliveryNotes: input.specialRequests,
							subtotal: foodTotal,
							total: foodTotal,
							items: { create: lines },
						},
					})
				: null;

		return tx.reservation.create({
			data: {
				restaurantId: restaurant.id,
				tableId: table.id,
				customerName: input.customerName,
				customerPhone: input.customerPhone,
				customerEmail: input.customerEmail,
				partySize: input.partySize,
				startsAt,
				endsAt,
				expiresAt: endsAt,
				effectiveBookingMode: policy.bookingMode,
				effectivePaymentTiming: policy.paymentTiming,
				effectiveInclusionType: policy.inclusionType,
				effectiveTableFee: policy.tableFee,
				reservationPaymentStatus:
					amountDueNow > 0 ? PaymentStatus.PENDING : PaymentStatus.PAID,
				reservationAmountPaid: amountDueNow > 0 ? amountDueNow : null,
				preOrderId: preOrder?.id,
				specialRequests: input.specialRequests,
			},
		});
	});
	const qstashMessageId = await scheduleReservationExpiry({
		reservationId: reservation.id,
		expiresAt: endsAt,
	});

	if (qstashMessageId) {
		await db.reservation.update({
			where: { id: reservation.id },
			data: { qstashMessageId },
		});
	}

	await dispatchNotification({
		restaurantId: restaurant.id,
		type: NotificationType.NEW_RESERVATION,
		audience: NotificationAudience.BOTH,
		title: "New reservation",
		body: `${input.customerName} reserved ${table.label} for ${input.partySize} guest${input.partySize === 1 ? "" : "s"}`,
		actionUrl: `/dashboard/${restaurant.slug}/reservations?reservationId=${reservation.id}`,
		metadata: { reservationId: reservation.id },
	});

	revalidatePath(`/${restaurant.slug}/tables`);
	revalidatePath(`/dashboard/${restaurant.slug}/reservations`);

	if (amountDueNow > 0) {
		const authorizationUrl = await initiateReservationPayment({
			reservationId: reservation.id,
			restaurantSlug: restaurant.slug,
			customerName: input.customerName,
			customerEmail: input.customerEmail,
			amountKobo: Math.round(amountDueNow * 100),
		});
		redirect(authorizationUrl);
	}

	redirect(`/${restaurant.slug}/reservation/${reservation.id}`);
}

export async function upsertReservationSettingAction(formData: FormData) {
	const input = reservationSettingSchema.parse({
		slug: formData.get("slug"),
		tableReservationEnabled:
			formData.get("tableReservationEnabled") === "on" ||
			formData.get("tableReservationEnabled") === "true",
		bookingMode: formData.get("bookingMode"),
		paymentTiming: formData.get("paymentTiming"),
		inclusionType: formData.get("inclusionType"),
		defaultTableFee: formData.get("defaultTableFee"),
		advanceBookingHours: formData.get("advanceBookingHours") || 0,
		holdDurationMinutes: formData.get("holdDurationMinutes") || 60,
		minPartySize: formData.get("minPartySize") || 1,
		maxPartySize: formData.get("maxPartySize") || 0,
		bookingDescription: formData.get("bookingDescription"),
		cancellationPolicy: formData.get("cancellationPolicy"),
	});
	const restaurant = await requireOwnedRestaurantBySlug(input.slug);

	if (input.maxPartySize > 0 && input.maxPartySize < input.minPartySize) {
		throw new Error("Max party size cannot be lower than min party size.");
	}

	await db.$transaction([
		db.restaurant.update({
			where: { id: restaurant.id },
			data: {
				tableReservationEnabled: input.tableReservationEnabled,
				tablesEnabled: input.tableReservationEnabled,
			},
		}),
		db.reservationSetting.upsert({
			where: { restaurantId: restaurant.id },
			create: {
				restaurantId: restaurant.id,
				bookingMode: input.bookingMode,
				paymentTiming: input.paymentTiming,
				inclusionType: input.inclusionType,
				defaultTableFee: input.defaultTableFee,
				advanceBookingHours: input.advanceBookingHours,
				holdDurationMinutes: input.holdDurationMinutes,
				minPartySize: input.minPartySize,
				maxPartySize: input.maxPartySize,
				bookingDescription: input.bookingDescription,
				cancellationPolicy: input.cancellationPolicy,
			},
			update: {
				bookingMode: input.bookingMode,
				paymentTiming: input.paymentTiming,
				inclusionType: input.inclusionType,
				defaultTableFee: input.defaultTableFee,
				advanceBookingHours: input.advanceBookingHours,
				holdDurationMinutes: input.holdDurationMinutes,
				minPartySize: input.minPartySize,
				maxPartySize: input.maxPartySize,
				bookingDescription: input.bookingDescription,
				cancellationPolicy: input.cancellationPolicy,
			},
		}),
	]);

	revalidateReservationAdminPaths(restaurant.slug);
}

export async function createTableSeatAction(formData: FormData) {
	const input = tableSeatSchema.parse({
		slug: formData.get("slug"),
		label: formData.get("label"),
		description: formData.get("description"),
		capacity: formData.get("capacity") || 2,
		sortOrder: formData.get("sortOrder") || 0,
		isActive: true,
		bookingModeOverride: formData.get("bookingModeOverride"),
		paymentTimingOverride: formData.get("paymentTimingOverride"),
		inclusionTypeOverride: formData.get("inclusionTypeOverride"),
		tableFee: formData.get("tableFee"),
		minimumSpend: formData.get("minimumSpend"),
	});
	const restaurant = await requireOwnedRestaurantBySlug(input.slug);

	await db.tableSeat.create({
		data: {
			restaurantId: restaurant.id,
			label: input.label,
			description: input.description,
			capacity: input.capacity,
			sortOrder: input.sortOrder,
			isActive: true,
			bookingModeOverride: input.bookingModeOverride,
			paymentTimingOverride: input.paymentTimingOverride,
			inclusionTypeOverride: input.inclusionTypeOverride,
			tableFee: input.tableFee,
			minimumSpend: input.minimumSpend,
		},
	});

	revalidateReservationAdminPaths(restaurant.slug);
}

export async function updateTableSeatAction(formData: FormData) {
	const input = updateTableSeatSchema.parse({
		slug: formData.get("slug"),
		tableId: formData.get("tableId"),
		label: formData.get("label"),
		description: formData.get("description"),
		capacity: formData.get("capacity") || 2,
		sortOrder: formData.get("sortOrder") || 0,
		isActive:
			formData.get("isActive") === "on" || formData.get("isActive") === "true",
		bookingModeOverride: formData.get("bookingModeOverride"),
		paymentTimingOverride: formData.get("paymentTimingOverride"),
		inclusionTypeOverride: formData.get("inclusionTypeOverride"),
		tableFee: formData.get("tableFee"),
		minimumSpend: formData.get("minimumSpend"),
	});
	const restaurant = await requireOwnedRestaurantBySlug(input.slug);

	await db.tableSeat.updateMany({
		where: { id: input.tableId, restaurantId: restaurant.id },
		data: {
			label: input.label,
			description: input.description,
			capacity: input.capacity,
			sortOrder: input.sortOrder,
			isActive: input.isActive,
			bookingModeOverride: input.bookingModeOverride,
			paymentTimingOverride: input.paymentTimingOverride,
			inclusionTypeOverride: input.inclusionTypeOverride,
			tableFee: input.tableFee,
			minimumSpend: input.minimumSpend,
		},
	});

	revalidateReservationAdminPaths(restaurant.slug);
}

export async function deactivateTableSeatAction(formData: FormData) {
	const input = tableSeatIdSchema.parse({
		slug: formData.get("slug"),
		tableId: formData.get("tableId"),
	});
	const restaurant = await requireOwnedRestaurantBySlug(input.slug);

	await db.tableSeat.updateMany({
		where: { id: input.tableId, restaurantId: restaurant.id },
		data: { isActive: false },
	});

	revalidateReservationAdminPaths(restaurant.slug);
}

export async function checkInReservationAction(formData: FormData) {
	const input = reservationIdSchema.parse({
		slug: formData.get("slug"),
		reservationId: formData.get("reservationId"),
	});
	const restaurant = await requireOwnedRestaurantBySlug(input.slug);
	const reservation = await db.reservation.findFirst({
		where: { id: input.reservationId, restaurantId: restaurant.id },
		select: { id: true, status: true, qstashMessageId: true },
	});

	if (!reservation) {
		throw new Error("Reservation not found.");
	}

	if (reservation.status !== ReservationStatus.ACTIVE) {
		throw new Error("Only active reservations can be checked in.");
	}

	await cancelReservationExpiry(reservation.qstashMessageId);
	await db.reservation.update({
		where: { id: reservation.id },
		data: {
			status: ReservationStatus.CHECKED_IN,
			qstashMessageId: null,
		},
	});

	revalidateReservationAdminPaths(restaurant.slug);
	revalidatePath(`/${restaurant.slug}/reservation/${reservation.id}`);
}

export async function cancelReservationAction(formData: FormData) {
	const input = reservationIdSchema.parse({
		slug: formData.get("slug"),
		reservationId: formData.get("reservationId"),
	});
	const restaurant = await requireOwnedRestaurantBySlug(input.slug);
	const reservation = await db.reservation.findFirst({
		where: { id: input.reservationId, restaurantId: restaurant.id },
		select: {
			id: true,
			status: true,
			qstashMessageId: true,
			customerName: true,
			table: { select: { label: true } },
		},
	});

	if (!reservation) {
		throw new Error("Reservation not found.");
	}

	if (reservation.status !== ReservationStatus.ACTIVE) {
		throw new Error("Only active reservations can be cancelled.");
	}

	await cancelReservationExpiry(reservation.qstashMessageId);
	await db.reservation.update({
		where: { id: reservation.id },
		data: {
			status: ReservationStatus.CANCELLED,
			qstashMessageId: null,
		},
	});

	await dispatchNotification({
		restaurantId: restaurant.id,
		type: NotificationType.RESERVATION_CANCELLED,
		audience: NotificationAudience.ADMIN,
		title: "Reservation cancelled",
		body: `${reservation.customerName}'s reservation for ${reservation.table.label} was cancelled`,
		actionUrl: `/dashboard/${restaurant.slug}/reservations?reservationId=${reservation.id}`,
		metadata: { reservationId: reservation.id },
	});

	revalidateReservationAdminPaths(restaurant.slug);
	revalidatePath(`/${restaurant.slug}/reservation/${reservation.id}`);
}
