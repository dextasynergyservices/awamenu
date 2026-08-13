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
import { verifyPassword } from "better-auth/crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ActionError, actionResult } from "@/lib/action-error";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";
import { isWithinOpeningHours } from "@/lib/opening-hours";
import { initiateReservationPayment } from "@/lib/payments";
import { getRestaurantPlanFeatures } from "@/lib/plan-features";
import {
	cancelReservationExpiry,
	scheduleReservationExpiry,
} from "@/lib/qstash";
import { enforceRateLimit, getClientIp } from "@/lib/ratelimit";
import {
	notifyReservationCancelled,
	notifyReservationConfirmed,
	notifyReservationDeclined,
	notifyReservationRequested,
} from "@/lib/reservation-emails";
import {
	requiresFoodOrder,
	resolveEffectivePolicy,
} from "@/lib/reservation-policy";

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

const _optionalBookingModeSchema = z.preprocess(
	(value) => (value === "" ? null : value),
	z.nativeEnum(TableBookingMode).nullable(),
);

const _optionalPaymentTimingSchema = z.preprocess(
	(value) => (value === "" ? null : value),
	z.nativeEnum(TablePaymentTiming).nullable(),
);

const _optionalInclusionTypeSchema = z.preprocess(
	(value) => (value === "" ? null : value),
	z.nativeEnum(TableInclusionType).nullable(),
);

const reservationSettingSchema = z.object({
	slug: z.string().min(1),
	tableReservationEnabled: z.boolean(),
	advanceBookingHours: z.coerce.number().int().min(0).max(8760),
	slotIntervalMinutes: z.coerce.number().int().min(5).max(240),
	graceMinutes: z.coerce.number().int().min(0).max(120),
	autoConfirmFreeBookings: z.boolean(),
	refundPolicy: z.preprocess(
		(value) =>
			typeof value === "string" && value.trim() === "" ? null : value,
		z.string().trim().max(500).nullable(),
	),
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
	imageUrl: z.preprocess(
		(value) =>
			typeof value === "string" && value.trim() === "" ? null : value,
		z.string().trim().url().max(500).nullable(),
	),
	description: z.preprocess(
		(value) =>
			typeof value === "string" && value.trim() === "" ? null : value,
		z.string().trim().max(240).nullable(),
	),
	capacity: z.coerce.number().int().min(1).max(100),
	sortOrder: z.coerce.number().int().min(0).max(9999),
	isActive: z.boolean(),
	bookingMode: z.nativeEnum(TableBookingMode),
	paymentTiming: z.nativeEnum(TablePaymentTiming),
	inclusionType: z.nativeEnum(TableInclusionType),
	holdMinutes: z.coerce.number().int().min(15).max(480),
	depositPercent: z.coerce.number().int().min(0).max(100),
	minPartySize: z.coerce.number().int().min(1).max(100),
	maxPartySize: z.coerce.number().int().min(0).max(500),
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

const deleteTableSeatSchema = tableSeatIdSchema.extend({
	password: z.string().min(1),
});

const reservationIdSchema = z.object({
	slug: z.string().min(1),
	reservationId: z.string().cuid(),
});

const tableDeleteAttempts = new Map<
	string,
	{ count: number; resetAt: number }
>();
const tableDeleteLimit = {
	maxAttempts: 5,
	windowMs: 15 * 60 * 1000,
};

const declineReservationSchema = reservationIdSchema.extend({
	declineReason: z.preprocess(
		(value) =>
			typeof value === "string" && value.trim() === "" ? undefined : value,
		z
			.string()
			.trim()
			.max(500)
			.default(
				"This table is not available for the selected time. Please contact the restaurant so we can help you choose another table.",
			),
	),
});

async function requireOwnedRestaurantBySlug(slug: string) {
	const user = await requireUser();
	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		select: { id: true, slug: true, name: true },
	});

	if (!restaurant) {
		throw new ActionError("Restaurant not found.");
	}

	return restaurant;
}

function getDeleteAttemptKey(userId: string, tableId: string) {
	return `${userId}:${tableId}`;
}

function getDeleteRateLimitWaitMs(key: string) {
	const entry = tableDeleteAttempts.get(key);
	if (!entry) return 0;

	const now = Date.now();
	if (entry.resetAt <= now) {
		tableDeleteAttempts.delete(key);
		return 0;
	}

	return entry.count >= tableDeleteLimit.maxAttempts ? entry.resetAt - now : 0;
}

function recordFailedDeletePasswordAttempt(key: string) {
	const now = Date.now();
	const existing = tableDeleteAttempts.get(key);
	const entry =
		existing && existing.resetAt > now
			? existing
			: { count: 0, resetAt: now + tableDeleteLimit.windowMs };
	entry.count += 1;
	tableDeleteAttempts.set(key, entry);

	return Math.max(0, tableDeleteLimit.maxAttempts - entry.count);
}

function clearDeletePasswordAttempts(key: string) {
	tableDeleteAttempts.delete(key);
}

function formatRetryWait(waitMs: number) {
	const minutes = Math.max(1, Math.ceil(waitMs / 60_000));
	return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

async function isOwnerPasswordValid(userId: string, password: string) {
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

	return verifyPassword({
		hash: account.password,
		password,
	});
}

function revalidateReservationAdminPaths(slug: string) {
	revalidatePath(`/dashboard/${slug}/tables`);
	revalidatePath(`/dashboard/${slug}/reservations`);
	revalidatePath(`/${slug}`);
	revalidatePath(`/${slug}/tables`);
}

function _shouldRequireFood(
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

function calculateReservationAmountDue({
	bookingMode,
	paymentTiming,
	inclusionType,
	tableFee,
	foodTotal,
	depositPercent = 0,
}: {
	bookingMode: TableBookingMode;
	paymentTiming: TablePaymentTiming;
	inclusionType: TableInclusionType;
	tableFee: number;
	foodTotal: number;
	depositPercent?: number;
}) {
	if (paymentTiming !== TablePaymentTiming.PAY_ON_BOOKING) return 0;

	const total =
		(bookingMode === TableBookingMode.ORDER_REQUIRED &&
		inclusionType === TableInclusionType.FOOD_ONLY
			? foodTotal
			: 0) +
		(shouldChargeTableFee(bookingMode, inclusionType) ? tableFee : 0) +
		(shouldChargeTableFee(bookingMode, inclusionType) &&
		inclusionType === TableInclusionType.FOOD_AND_TABLE_FEE
			? foodTotal
			: 0);

	// A percentage deposit is taken off the whole booking — food and table fee
	// together — which is what "deposit" normally means. Zero keeps the older
	// behaviour of charging the table fee alone.
	if (bookingMode === TableBookingMode.DEPOSIT_REQUIRED && depositPercent > 0) {
		return Math.round((total * depositPercent) / 100);
	}

	return total;
}

export async function createReservationAction(formData: FormData) {
	return actionResult(async () => {
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
			throw new ActionError("Choose a valid reservation date and time.");
		}

		const clientIp = await getClientIp();
		await enforceRateLimit("reservation", `${clientIp}:${input.slug}`);

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

		// Opening hours, one-off closures and the table are all keyed off the
		// restaurant id and none reads the others, so they go together. Run in
		// sequence they cost three round trips — seconds each on a link to
		// Frankfurt — before the customer sees anything.
		const [openingHours, blackout, table] = await Promise.all([
			db.restaurantOpeningHour.findMany({
				where: { restaurantId: restaurant.id },
				select: { dayOfWeek: true, opensAt: true, closesAt: true },
			}),
			db.restaurantBlackoutDate.findUnique({
				where: {
					restaurantId_date: { restaurantId: restaurant.id, date: input.date },
				},
				select: { reason: true },
			}),
			db.tableSeat.findFirstOrThrow({
				where: {
					id: input.tableId,
					restaurantId: restaurant.id,
					isActive: true,
				},
			}),
		]);

		// A booking for a day or hour the restaurant is shut is a no-show waiting
		// to happen — someone turns up to a locked door.
		if (!isWithinOpeningHours(openingHours, input.date, input.time)) {
			throw new ActionError(
				"We're closed at that time. Please pick a time within our opening hours.",
			);
		}
		if (blackout) {
			throw new ActionError(
				blackout.reason
					? `We're closed that day — ${blackout.reason}. Please pick another date.`
					: "We're closed that day. Please pick another date.",
			);
		}
		// Restaurant level now holds only what is genuinely one-per-restaurant:
		// how far ahead people may book, and the customer-facing policies.
		const advanceBookingHours =
			restaurant.reservationSetting?.advanceBookingHours ?? 0;

		const earliestStart = new Date(
			Date.now() + advanceBookingHours * 60 * 60 * 1000,
		);
		earliestStart.setSeconds(0, 0);
		if (startsAt < earliestStart) {
			throw new ActionError("This reservation time is no longer available.");
		}

		// Every booking rule is the table's own.
		const policy = resolveEffectivePolicy(table);

		if (input.partySize < policy.minPartySize) {
			throw new ActionError(
				`${table.label} takes a minimum of ${policy.minPartySize} guests.`,
			);
		}
		if (input.partySize > policy.maxPartySize) {
			throw new ActionError(
				`${table.label} seats up to ${policy.maxPartySize} guests.`,
			);
		}

		// The table stays blocked for the booking length plus the grace window, so
		// a guest running ten minutes late doesn't find it given away — and a
		// no-show releases it rather than holding it for the whole sitting.
		const graceMinutes = restaurant.reservationSetting?.graceMinutes ?? 15;
		const endsAt = new Date(
			startsAt.getTime() + (policy.holdMinutes + graceMinutes) * 60 * 1000,
		);

		const overlappingReservation = await db.reservation.findFirst({
			where: {
				tableId: table.id,
				status: {
					in: [
						ReservationStatus.APPROVED,
						ReservationStatus.ACTIVE,
						ReservationStatus.CHECKED_IN,
					],
				},
				startsAt: { lt: endsAt },
				expiresAt: { gt: startsAt },
			},
			select: { id: true },
		});

		if (overlappingReservation) {
			throw new ActionError("This table is already reserved for that time.");
		}

		const requiresFood = requiresFoodOrder(policy);

		if (requiresFood && input.items.length === 0) {
			throw new ActionError("Please choose food items for this reservation.");
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
			throw new ActionError("Some selected food items are unavailable.");
		}

		const lines = input.items.map((item) => {
			const menuItem = menuItems.find((entry) => entry.id === item.id);
			if (!menuItem) throw new ActionError("Invalid food item.");

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
		const amountDue = calculateReservationAmountDue({
			bookingMode: policy.bookingMode,
			paymentTiming: policy.paymentTiming,
			inclusionType: policy.inclusionType,
			tableFee,
			foodTotal,
			depositPercent: policy.depositPercent,
		});

		// Auto-confirm only when nothing is owed AND the table has just been
		// verified free for the slot. Anything taking money still needs a human,
		// and an auto-confirmed double booking would be worse than a short wait —
		// this sits after the overlap check for exactly that reason.
		const autoConfirm =
			(restaurant.reservationSetting?.autoConfirmFreeBookings ?? false) &&
			policy.bookingMode === TableBookingMode.FREE_BOOKING &&
			amountDue <= 0;
		const reservationStatus = autoConfirm
			? ReservationStatus.APPROVED
			: ReservationStatus.PENDING_APPROVAL;

		const reservation = await db.$transaction(
			async (tx) => {
				const preOrder =
					lines.length > 0
						? await tx.order.create({
								data: {
									restaurantId: restaurant.id,
									customerName: input.customerName,
									customerPhone: input.customerPhone,
									customerEmail: input.customerEmail,
									type: OrderType.TABLE_RESERVATION,
									status: OrderStatus.PENDING_PAYMENT,
									paymentStatus: PaymentStatus.PENDING,
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
						effectiveDepositPercent: policy.depositPercent,
						status: reservationStatus,
						reservationPaymentStatus: PaymentStatus.PENDING,
						reservationAmountPaid: amountDue > 0 ? amountDue : null,
						preOrderId: preOrder?.id,
						specialRequests: input.specialRequests,
					},
				});
			},
			{
				// An interactive transaction holds the connection open across
				// every query inside it. The database is in Frankfurt and a
				// round trip from West Africa is seconds, so a few writes exceed
				// Prisma's 5s default and the commit is rejected after the work
				// is already done — P2028.
				timeout: 20000,
				maxWait: 10000,
			},
		);

		// Auto-confirmed free bookings are already theirs, so they get the
		// confirmation rather than a "we'll get back to you" that never follows.
		if (autoConfirm) {
			await notifyReservationConfirmed(reservation.id);
		} else {
			await notifyReservationRequested(reservation.id);
		}

		await dispatchNotification({
			restaurantId: restaurant.id,
			type: NotificationType.NEW_RESERVATION,
			audience: NotificationAudience.BOTH,
			title: "New reservation",
			body: `${input.customerName} requested ${table.label} for ${input.partySize} guest${input.partySize === 1 ? "" : "s"}`,
			actionUrl: `/dashboard/${restaurant.slug}/reservations?reservationId=${reservation.id}`,
			metadata: { reservationId: reservation.id },
		});

		revalidatePath(`/${restaurant.slug}/tables`);
		revalidatePath(`/dashboard/${restaurant.slug}/reservations`);

		redirect(`/${restaurant.slug}/reservation/${reservation.id}`);
	});
}

export async function upsertReservationSettingAction(formData: FormData) {
	return actionResult(async () => {
		const input = reservationSettingSchema.parse({
			slug: formData.get("slug"),
			tableReservationEnabled:
				formData.get("tableReservationEnabled") === "on" ||
				formData.get("tableReservationEnabled") === "true",
			advanceBookingHours: formData.get("advanceBookingHours") || 0,
			slotIntervalMinutes: formData.get("slotIntervalMinutes") || 30,
			graceMinutes: formData.get("graceMinutes") || 15,
			autoConfirmFreeBookings:
				formData.get("autoConfirmFreeBookings") === "on" ||
				formData.get("autoConfirmFreeBookings") === "true",
			bookingDescription: formData.get("bookingDescription"),
			cancellationPolicy: formData.get("cancellationPolicy"),
			refundPolicy: formData.get("refundPolicy"),
		});
		const restaurant = await requireOwnedRestaurantBySlug(input.slug);

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
					advanceBookingHours: input.advanceBookingHours,
					slotIntervalMinutes: input.slotIntervalMinutes,
					graceMinutes: input.graceMinutes,
					autoConfirmFreeBookings: input.autoConfirmFreeBookings,
					bookingDescription: input.bookingDescription,
					cancellationPolicy: input.cancellationPolicy,
					refundPolicy: input.refundPolicy,
				},
				update: {
					advanceBookingHours: input.advanceBookingHours,
					slotIntervalMinutes: input.slotIntervalMinutes,
					graceMinutes: input.graceMinutes,
					autoConfirmFreeBookings: input.autoConfirmFreeBookings,
					bookingDescription: input.bookingDescription,
					cancellationPolicy: input.cancellationPolicy,
					refundPolicy: input.refundPolicy,
				},
			}),
		]);

		revalidateReservationAdminPaths(restaurant.slug);
	});
}

export async function createTableSeatAction(formData: FormData) {
	return actionResult(async () => {
		const input = tableSeatSchema.parse({
			slug: formData.get("slug"),
			label: formData.get("label"),
			imageUrl: formData.get("imageUrl"),
			description: formData.get("description"),
			capacity: formData.get("capacity") || 2,
			sortOrder: formData.get("sortOrder") || 0,
			isActive:
				formData.get("isActive") === "on" ||
				formData.get("isActive") === "true",
			bookingMode: formData.get("bookingMode"),
			paymentTiming: formData.get("paymentTiming"),
			inclusionType: formData.get("inclusionType"),
			holdMinutes: formData.get("holdMinutes") || 60,
			depositPercent: formData.get("depositPercent") || 0,
			minPartySize: formData.get("minPartySize") || 1,
			maxPartySize: formData.get("maxPartySize") || 0,
			tableFee: formData.get("tableFee"),
			minimumSpend: formData.get("minimumSpend"),
		});
		const restaurant = await requireOwnedRestaurantBySlug(input.slug);

		// Enforced server-side, not just hidden in the UI — the limit is what the
		// customer is paying for. -1 means unlimited, matching the category and
		// item limits so all three read the same way.
		const features = await getRestaurantPlanFeatures(restaurant.id);
		if (features.maxTables !== -1) {
			const existing = await db.tableSeat.count({
				where: { restaurantId: restaurant.id, isActive: true },
			});
			if (existing >= features.maxTables) {
				throw new ActionError(
					features.maxTables === 1
						? "Your plan includes 1 table. Upgrade to add more."
						: `Your plan includes ${features.maxTables} tables. Upgrade to add more.`,
				);
			}
		}

		await db.tableSeat.create({
			data: {
				restaurantId: restaurant.id,
				label: input.label,
				imageUrl: input.imageUrl,
				description: input.description,
				capacity: input.capacity,
				sortOrder: input.sortOrder,
				isActive: input.isActive,
				bookingMode: input.bookingMode,
				paymentTiming: input.paymentTiming,
				inclusionType: input.inclusionType,
				holdMinutes: input.holdMinutes,
				depositPercent: input.depositPercent,
				minPartySize: input.minPartySize,
				maxPartySize: input.maxPartySize,
				tableFee: input.tableFee,
				minimumSpend: input.minimumSpend,
			},
		});

		revalidateReservationAdminPaths(restaurant.slug);
	});
}

export async function updateTableSeatAction(formData: FormData) {
	return actionResult(async () => {
		const input = updateTableSeatSchema.parse({
			slug: formData.get("slug"),
			tableId: formData.get("tableId"),
			label: formData.get("label"),
			imageUrl: formData.get("imageUrl"),
			description: formData.get("description"),
			capacity: formData.get("capacity") || 2,
			sortOrder: formData.get("sortOrder") || 0,
			isActive:
				formData.get("isActive") === "on" ||
				formData.get("isActive") === "true",
			bookingMode: formData.get("bookingMode"),
			paymentTiming: formData.get("paymentTiming"),
			inclusionType: formData.get("inclusionType"),
			holdMinutes: formData.get("holdMinutes") || 60,
			depositPercent: formData.get("depositPercent") || 0,
			minPartySize: formData.get("minPartySize") || 1,
			maxPartySize: formData.get("maxPartySize") || 0,
			tableFee: formData.get("tableFee"),
			minimumSpend: formData.get("minimumSpend"),
		});
		const restaurant = await requireOwnedRestaurantBySlug(input.slug);

		await db.tableSeat.updateMany({
			where: { id: input.tableId, restaurantId: restaurant.id },
			data: {
				label: input.label,
				imageUrl: input.imageUrl,
				description: input.description,
				capacity: input.capacity,
				sortOrder: input.sortOrder,
				isActive: input.isActive,
				bookingMode: input.bookingMode,
				paymentTiming: input.paymentTiming,
				inclusionType: input.inclusionType,
				holdMinutes: input.holdMinutes,
				depositPercent: input.depositPercent,
				minPartySize: input.minPartySize,
				maxPartySize: input.maxPartySize,
				tableFee: input.tableFee,
				minimumSpend: input.minimumSpend,
			},
		});

		revalidateReservationAdminPaths(restaurant.slug);
	});
}

export async function deactivateTableSeatAction(formData: FormData) {
	return actionResult(async () => {
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
	});
}

export async function deleteTableSeatAction(formData: FormData) {
	return actionResult(async () => {
		const user = await requireUser();
		const input = deleteTableSeatSchema.parse({
			slug: formData.get("slug"),
			tableId: formData.get("tableId"),
			password: formData.get("password"),
		});
		const restaurant = await db.restaurant.findFirst({
			where: { slug: input.slug, ownerId: user.id },
			select: { id: true, slug: true },
		});

		if (!restaurant) {
			throw new ActionError("Restaurant not found.");
		}

		const rateLimitKey = getDeleteAttemptKey(user.id, input.tableId);
		const waitMs = getDeleteRateLimitWaitMs(rateLimitKey);
		if (waitMs > 0) {
			throw new ActionError(
				`Too many failed password attempts. Please wait ${formatRetryWait(waitMs)} and try again.`,
			);
		}

		const validPassword = await isOwnerPasswordValid(user.id, input.password);
		if (!validPassword) {
			const attemptsLeft = recordFailedDeletePasswordAttempt(rateLimitKey);
			if (attemptsLeft <= 0) {
				throw new ActionError(
					`Incorrect password. For your security, table deletion is locked for ${formatRetryWait(tableDeleteLimit.windowMs)}.`,
				);
			}
			throw new ActionError(
				`Incorrect password. Please check it and try again. ${attemptsLeft} attempt${attemptsLeft === 1 ? "" : "s"} left.`,
			);
		}
		clearDeletePasswordAttempts(rateLimitKey);

		const table = await db.tableSeat.findFirst({
			where: { id: input.tableId, restaurantId: restaurant.id },
			select: {
				id: true,
				label: true,
				_count: {
					select: {
						orders: true,
						reservations: true,
					},
				},
			},
		});

		if (!table) {
			throw new ActionError("Table not found.");
		}

		if (table._count.reservations > 0 || table._count.orders > 0) {
			throw new ActionError(
				`${table.label} has reservation or order history, so it cannot be deleted. Disable online booking instead if you no longer want customers to use it.`,
			);
		}

		await db.tableSeat.deleteMany({
			where: { id: table.id, restaurantId: restaurant.id },
		});

		revalidateReservationAdminPaths(restaurant.slug);
	});
}

export async function approveReservationAction(formData: FormData) {
	return actionResult(async () => {
		const input = reservationIdSchema.parse({
			slug: formData.get("slug"),
			reservationId: formData.get("reservationId"),
		});
		const restaurant = await requireOwnedRestaurantBySlug(input.slug);
		const reservation = await db.reservation.findFirst({
			where: { id: input.reservationId, restaurantId: restaurant.id },
			select: {
				id: true,
				tableId: true,
				startsAt: true,
				expiresAt: true,
				status: true,
				customerName: true,
				effectiveBookingMode: true,
				effectivePaymentTiming: true,
				effectiveInclusionType: true,
				effectiveTableFee: true,
				effectiveDepositPercent: true,
				preOrderId: true,
				preOrder: { select: { total: true } },
				table: { select: { label: true } },
			},
		});

		if (!reservation) {
			throw new ActionError("Reservation not found.");
		}

		if (reservation.status !== ReservationStatus.PENDING_APPROVAL) {
			throw new ActionError("Only pending table requests can be approved.");
		}

		const overlappingReservation = await db.reservation.findFirst({
			where: {
				id: { not: reservation.id },
				tableId: reservation.tableId,
				status: {
					in: [
						ReservationStatus.APPROVED,
						ReservationStatus.ACTIVE,
						ReservationStatus.CHECKED_IN,
					],
				},
				startsAt: { lt: reservation.expiresAt },
				expiresAt: { gt: reservation.startsAt },
			},
			select: { id: true },
		});

		if (overlappingReservation) {
			throw new ActionError(
				"This table is already reserved for that time. Decline this request and suggest another table.",
			);
		}

		const amountDue = calculateReservationAmountDue({
			bookingMode: reservation.effectiveBookingMode,
			paymentTiming: reservation.effectivePaymentTiming,
			inclusionType: reservation.effectiveInclusionType,
			tableFee: Number(reservation.effectiveTableFee ?? 0),
			foodTotal: Number(reservation.preOrder?.total ?? 0),
			depositPercent: reservation.effectiveDepositPercent,
		});
		const isPaymentRequired = amountDue > 0;
		const nextStatus = isPaymentRequired
			? ReservationStatus.APPROVED
			: ReservationStatus.ACTIVE;
		const qstashMessageId = isPaymentRequired
			? null
			: await scheduleReservationExpiry({
					reservationId: reservation.id,
					expiresAt: reservation.expiresAt,
				});

		// A batch transaction, not an interactive one: these writes don't read
		// each other, so they travel as a single round trip instead of holding a
		// connection open across two. Over a link where each hop costs seconds
		// that is the difference between "instant" and the 11s timeout this
		// action used to hit.
		await db.$transaction([
			db.reservation.update({
				where: { id: reservation.id },
				data: {
					status: nextStatus,
					approvedAt: new Date(),
					declinedAt: null,
					declineReason: null,
					qstashMessageId,
					reservationPaymentStatus: isPaymentRequired
						? PaymentStatus.PENDING
						: PaymentStatus.PAID,
					reservationAmountPaid: isPaymentRequired ? amountDue : null,
				},
			}),
			...(reservation.preOrderId
				? [
						db.order.update({
							where: { id: reservation.preOrderId },
							data: {
								status: isPaymentRequired
									? OrderStatus.PENDING_PAYMENT
									: OrderStatus.CONFIRMED,
								paymentStatus: isPaymentRequired
									? PaymentStatus.PENDING
									: PaymentStatus.PAID,
							},
						}),
					]
				: []),
		]);

		// Only when the table is actually theirs. An APPROVED booking still owing
		// a deposit is not confirmed yet — telling a guest "table confirmed" and
		// then expiring it for non-payment is worse than saying nothing.
		if (!isPaymentRequired) {
			await notifyReservationConfirmed(reservation.id);
		}

		await dispatchNotification({
			restaurantId: restaurant.id,
			type: NotificationType.NEW_RESERVATION,
			audience: NotificationAudience.ADMIN,
			title: "Reservation approved",
			body: `${reservation.customerName}'s request for ${reservation.table.label} was approved`,
			actionUrl: `/dashboard/${restaurant.slug}/reservations?reservationId=${reservation.id}`,
			metadata: { reservationId: reservation.id, status: nextStatus },
		});

		revalidateReservationAdminPaths(restaurant.slug);
		revalidatePath(`/${restaurant.slug}/reservation/${reservation.id}`);
	});
}

export async function declineReservationAction(formData: FormData) {
	return actionResult(async () => {
		const input = declineReservationSchema.parse({
			slug: formData.get("slug"),
			reservationId: formData.get("reservationId"),
			declineReason: formData.get("declineReason"),
		});
		const restaurant = await requireOwnedRestaurantBySlug(input.slug);
		const reservation = await db.reservation.findFirst({
			where: { id: input.reservationId, restaurantId: restaurant.id },
			select: {
				id: true,
				status: true,
				qstashMessageId: true,
				customerName: true,
				preOrderId: true,
				table: { select: { label: true } },
			},
		});

		if (!reservation) {
			throw new ActionError("Reservation not found.");
		}

		if (
			reservation.status !== ReservationStatus.PENDING_APPROVAL &&
			reservation.status !== ReservationStatus.APPROVED
		) {
			throw new ActionError(
				"Only pending or approved requests can be declined.",
			);
		}

		await cancelReservationExpiry(reservation.qstashMessageId);
		// Batched for the same reason as approval: independent writes, one round
		// trip.
		await db.$transaction([
			db.reservation.update({
				where: { id: reservation.id },
				data: {
					status: ReservationStatus.DECLINED,
					declinedAt: new Date(),
					declineReason: input.declineReason,
					qstashMessageId: null,
				},
			}),
			...(reservation.preOrderId
				? [
						db.order.update({
							where: { id: reservation.preOrderId },
							data: {
								status: OrderStatus.CANCELLED,
								paymentStatus: PaymentStatus.PENDING,
								cancellationNote: input.declineReason,
							},
						}),
					]
				: []),
		]);

		await notifyReservationDeclined(reservation.id);

		await dispatchNotification({
			restaurantId: restaurant.id,
			type: NotificationType.RESERVATION_CANCELLED,
			audience: NotificationAudience.ADMIN,
			title: "Reservation declined",
			body: `${reservation.customerName}'s request for ${reservation.table.label} was declined`,
			actionUrl: `/dashboard/${restaurant.slug}/reservations?reservationId=${reservation.id}`,
			metadata: {
				reservationId: reservation.id,
				status: ReservationStatus.DECLINED,
			},
		});

		revalidateReservationAdminPaths(restaurant.slug);
		revalidatePath(`/${restaurant.slug}/reservation/${reservation.id}`);
	});
}

export async function payReservationAction(formData: FormData) {
	return actionResult(async () => {
		const input = reservationIdSchema.parse({
			slug: formData.get("slug"),
			reservationId: formData.get("reservationId"),
		});
		const reservation = await db.reservation.findFirst({
			where: {
				id: input.reservationId,
				restaurant: { slug: input.slug, isActive: true },
			},
			select: {
				id: true,
				status: true,
				customerName: true,
				customerEmail: true,
				reservationPaymentStatus: true,
				reservationAmountPaid: true,
				restaurant: { select: { slug: true } },
			},
		});

		if (!reservation) {
			throw new ActionError("Reservation not found.");
		}

		if (reservation.status !== ReservationStatus.APPROVED) {
			throw new ActionError(
				"Please wait for admin to approve this table before payment.",
			);
		}

		if (reservation.reservationPaymentStatus === PaymentStatus.PAID) {
			redirect(`/${reservation.restaurant.slug}/reservation/${reservation.id}`);
		}

		const amountDue = Number(reservation.reservationAmountPaid ?? 0);
		if (amountDue <= 0) {
			redirect(`/${reservation.restaurant.slug}/reservation/${reservation.id}`);
		}

		const authorizationUrl = await initiateReservationPayment({
			reservationId: reservation.id,
			restaurantSlug: reservation.restaurant.slug,
			customerName: reservation.customerName,
			customerEmail: reservation.customerEmail,
			amountKobo: Math.round(amountDue * 100),
		});
		redirect(authorizationUrl);
	});
}

export async function checkInReservationAction(formData: FormData) {
	return actionResult(async () => {
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
			throw new ActionError("Reservation not found.");
		}

		if (reservation.status !== ReservationStatus.ACTIVE) {
			throw new ActionError("Only active reservations can be checked in.");
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
	});
}

export async function cancelReservationAction(formData: FormData) {
	return actionResult(async () => {
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
			throw new ActionError("Reservation not found.");
		}

		if (reservation.status !== ReservationStatus.ACTIVE) {
			throw new ActionError("Only active reservations can be cancelled.");
		}

		await cancelReservationExpiry(reservation.qstashMessageId);
		await db.reservation.update({
			where: { id: reservation.id },
			data: {
				status: ReservationStatus.CANCELLED,
				qstashMessageId: null,
			},
		});

		await notifyReservationCancelled(reservation.id);

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
	});
}

export async function checkOutReservationAction(formData: FormData) {
	return actionResult(async () => {
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
				customerName: true,
				table: { select: { label: true } },
			},
		});

		if (!reservation) {
			throw new ActionError("Reservation not found.");
		}

		if (reservation.status !== ReservationStatus.CHECKED_IN) {
			throw new ActionError("Only checked-in reservations can be checked out.");
		}

		await db.reservation.update({
			where: { id: reservation.id },
			data: {
				status: ReservationStatus.COMPLETED,
				expiresAt: new Date(),
			},
		});

		revalidateReservationAdminPaths(restaurant.slug);
		revalidatePath(`/${restaurant.slug}/reservation/${reservation.id}`);
	});
}

/**
 * One-click switch for whether customers can book at all.
 *
 * Separate from the full settings form because the master switch was a small
 * checkbox inside a collapsed panel — restaurants configured tables and never
 * found the control that publishes them.
 */
export async function toggleTableReservationsAction(input: {
	slug: string;
	enabled: boolean;
}): Promise<{ ok: true } | { error: string }> {
	const parsed = z
		.object({ slug: z.string().min(1), enabled: z.boolean() })
		.safeParse(input);
	if (!parsed.success) return { error: "Invalid request." };

	const restaurant = await requireOwnedRestaurantBySlug(parsed.data.slug);

	if (parsed.data.enabled) {
		const tables = await db.tableSeat.count({
			where: { restaurantId: restaurant.id, isActive: true },
		});
		if (tables === 0) {
			return { error: "Add at least one table before taking reservations." };
		}
	}

	await db.restaurant.update({
		where: { id: restaurant.id },
		data: { tableReservationEnabled: parsed.data.enabled },
	});

	revalidatePath(`/dashboard/${restaurant.slug}/reservations`);
	revalidatePath(`/dashboard/${restaurant.slug}/reservations/tables`);
	revalidatePath(`/${restaurant.slug}`);
	revalidatePath(`/${restaurant.slug}/tables`);
	return { ok: true };
}

const blackoutSchema = z.object({
	slug: z.string().min(1),
	date: z.string().regex(/^d{4}-d{2}-d{2}$/, "Pick a valid date."),
	reason: z.preprocess(
		(value) =>
			typeof value === "string" && value.trim() === "" ? null : value,
		z.string().trim().max(120).nullable(),
	),
});

/** Closes a single date to bookings — a holiday, a private event. */
export async function addBlackoutDateAction(input: {
	slug: string;
	date: string;
	reason?: string | null;
}): Promise<{ ok: true } | { error: string }> {
	const parsed = blackoutSchema.safeParse(input);
	if (!parsed.success) {
		return { error: parsed.error.issues[0]?.message ?? "Invalid date." };
	}

	const restaurant = await requireOwnedRestaurantBySlug(parsed.data.slug);

	// Upsert rather than create: adding the same date twice is a slip, not an
	// error worth showing anyone.
	await db.restaurantBlackoutDate.upsert({
		where: {
			restaurantId_date: {
				restaurantId: restaurant.id,
				date: parsed.data.date,
			},
		},
		create: {
			restaurantId: restaurant.id,
			date: parsed.data.date,
			reason: parsed.data.reason,
		},
		update: { reason: parsed.data.reason },
	});

	revalidateReservationAdminPaths(restaurant.slug);
	revalidatePath(`/${restaurant.slug}/tables`);
	return { ok: true };
}

export async function removeBlackoutDateAction(input: {
	slug: string;
	date: string;
}): Promise<{ ok: true } | { error: string }> {
	const parsed = z
		.object({ slug: z.string().min(1), date: z.string().min(1) })
		.safeParse(input);
	if (!parsed.success) return { error: "Invalid request." };

	const restaurant = await requireOwnedRestaurantBySlug(parsed.data.slug);
	await db.restaurantBlackoutDate.deleteMany({
		where: { restaurantId: restaurant.id, date: parsed.data.date },
	});

	revalidateReservationAdminPaths(restaurant.slug);
	revalidatePath(`/${restaurant.slug}/tables`);
	return { ok: true };
}
