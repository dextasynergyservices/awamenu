"use server";

import {
	AuditActorType,
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
import { captureServerEvent } from "@/lib/analytics";
import { recordAuditEvent } from "@/lib/audit";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";
import { isWithinOpeningHours } from "@/lib/opening-hours";
import { initiateReservationPayment } from "@/lib/payments";
import { getRestaurantPlanFeatures } from "@/lib/plan-features";
import { revalidatePublicMenu } from "@/lib/public-menu";
import { cancelReservationExpiry } from "@/lib/qstash";
import { enforceRateLimit, getClientIp } from "@/lib/ratelimit";
import {
	approveReservation,
	assertTableRulesCollectable,
	beginReservationCheckout,
	calculateReservationAmountDue,
	holdingReservationWhere,
	isReservationOverlapError,
	releaseLapsedPaymentHolds,
	scheduleNoShowExpiry,
} from "@/lib/reservation-booking";
import {
	notifyOwnerBookingRequested,
	notifyOwnerGuestCancelled,
	notifyReservationCancelled,
	notifyReservationConfirmed,
	notifyReservationDeclined,
	notifyReservationRequested,
} from "@/lib/reservation-emails";
import { notifyGuestReservationCancelled } from "@/lib/reservation-messaging";
import {
	requiresFoodOrder,
	resolveEffectivePolicy,
} from "@/lib/reservation-policy";
import {
	assertCustomerCanOrder,
	assertOwnerCanChange,
	assertRestaurantCanChange,
} from "@/lib/restaurant-access";
import { zonedWallClockToUtc } from "@/lib/zoned-time";

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
	paymentWindowMinutes: z.coerce.number().int().min(15).max(10080),
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
	revalidatePublicMenu(slug);
	revalidatePath(`/${slug}/tables`);
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

		const clientIp = await getClientIp();
		await enforceRateLimit("reservationIp", `${clientIp}:${input.slug}`);
		await enforceRateLimit(
			"reservation",
			`${input.customerPhone.replace(/\s+/g, "")}:${input.slug}`,
		);

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
				timezone: true,
				reservationSetting: true,
			},
		});
		await assertCustomerCanOrder(restaurant.id);

		// The guest picked a wall-clock time at the restaurant. Read in the
		// server's timezone (UTC on Vercel) it was stored an hour late for Lagos.
		const startsAt = zonedWallClockToUtc(
			input.date,
			input.time,
			restaurant.timezone,
		);

		if (Number.isNaN(startsAt.getTime())) {
			throw new ActionError("Choose a valid reservation date and time.");
		}

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

		// An unpaid hold whose window has closed must not block this guest — nor
		// make the database constraint refuse them — just because the cron
		// hasn't swept it yet.
		await releaseLapsedPaymentHolds({ tableId: table.id });

		// A courtesy check for a clear message. It cannot stop two guests booking
		// the same slot at the same instant — both would pass it — which is why
		// the write below is guarded by the database exclusion constraint.
		const overlappingReservation = await db.reservation.findFirst({
			where: {
				tableId: table.id,
				startsAt: { lt: endsAt },
				expiresAt: { gt: startsAt },
				AND: [holdingReservationWhere()],
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
		// Auto-confirmed free bookings go straight to ACTIVE, exactly as an owner
		// approving one would. They used to land on APPROVED, which for a booking
		// that owes nothing never progressed and never expired.
		const reservationStatus = autoConfirm
			? ReservationStatus.ACTIVE
			: ReservationStatus.PENDING_APPROVAL;

		const takenMessage =
			"Sorry — someone just booked this table for that time. Please choose another table or time.";

		const reservation = await db
			.$transaction(
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
							approvedAt: autoConfirm ? new Date() : null,
							// Matches an owner approving a booking that owes nothing.
							reservationPaymentStatus: autoConfirm
								? PaymentStatus.PAID
								: PaymentStatus.PENDING,
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
			)
			.catch((error: unknown) => {
				// The race the courtesy check above can't see: another guest's
				// booking for this slot committed first. The transaction rolled back,
				// so the pre-order went with it.
				if (isReservationOverlapError(error)) {
					throw new ActionError(takenMessage);
				}
				throw error;
			});

		// Auto-confirmed free bookings are already theirs, so they get the
		// confirmation rather than a "we'll get back to you" that never follows.
		if (autoConfirm) {
			await scheduleNoShowExpiry(reservation);
			await notifyReservationConfirmed(reservation.id);
		} else {
			await notifyReservationRequested(reservation.id);
			// It waits on the owner, so they hear about it outside the dashboard too.
			await notifyOwnerBookingRequested(reservation.id);
		}

		captureServerEvent("reservation_created", input.customerPhone, {
			restaurantId: restaurant.id,
			reservationId: reservation.id,
			partySize: input.partySize,
			autoConfirmed: autoConfirm,
		});

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
			paymentWindowMinutes: formData.get("paymentWindowMinutes") || 120,
			autoConfirmFreeBookings:
				formData.get("autoConfirmFreeBookings") === "on" ||
				formData.get("autoConfirmFreeBookings") === "true",
			bookingDescription: formData.get("bookingDescription"),
			cancellationPolicy: formData.get("cancellationPolicy"),
			refundPolicy: formData.get("refundPolicy"),
		});
		const restaurant = await requireOwnedRestaurantBySlug(input.slug);
		await assertRestaurantCanChange(restaurant.id);

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
					paymentWindowMinutes: input.paymentWindowMinutes,
					autoConfirmFreeBookings: input.autoConfirmFreeBookings,
					bookingDescription: input.bookingDescription,
					cancellationPolicy: input.cancellationPolicy,
					refundPolicy: input.refundPolicy,
				},
				update: {
					advanceBookingHours: input.advanceBookingHours,
					slotIntervalMinutes: input.slotIntervalMinutes,
					graceMinutes: input.graceMinutes,
					paymentWindowMinutes: input.paymentWindowMinutes,
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
		await assertRestaurantCanChange(restaurant.id);
		await assertTableRulesCollectable(restaurant.id, input);

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
		await assertRestaurantCanChange(restaurant.id);
		await assertTableRulesCollectable(restaurant.id, input);

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
		await assertRestaurantCanChange(restaurant.id);

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
		await assertOwnerCanChange(user.id, formData);
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
		await assertRestaurantCanChange(restaurant.id);
		// Shared with staff approval, which used to skip the overlap check, the
		// amount calculation and expiry scheduling entirely.
		const approved = await approveReservation({
			restaurantId: restaurant.id,
			reservationId: input.reservationId,
		});

		await dispatchNotification({
			restaurantId: restaurant.id,
			type: NotificationType.NEW_RESERVATION,
			audience: NotificationAudience.STAFF,
			title: "Reservation approved",
			body: `${approved.customerName}'s request for ${approved.tableLabel} was approved`,
			actionUrl: `/dashboard/${restaurant.slug}/reservations?reservationId=${input.reservationId}`,
			metadata: { reservationId: input.reservationId, status: approved.status },
		});

		revalidateReservationAdminPaths(restaurant.slug);
		revalidatePath(`/${restaurant.slug}/reservation/${input.reservationId}`);
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

		// Conditional on the booking still being unpaid and undecided. A payment
		// landing at the same moment would otherwise be overwritten — the guest
		// charged and told "declined" for a table the system had just confirmed.
		// Batched: one round trip, and the pre-order follows only if the decline
		// itself took effect.
		const [declined] = await db.$transaction([
			db.reservation.updateMany({
				where: {
					id: reservation.id,
					status: {
						in: [
							ReservationStatus.PENDING_APPROVAL,
							ReservationStatus.APPROVED,
						],
					},
					reservationPaymentStatus: { not: PaymentStatus.PAID },
				},
				data: {
					status: ReservationStatus.DECLINED,
					declinedAt: new Date(),
					declineReason: input.declineReason,
					paymentDueAt: null,
					qstashMessageId: null,
				},
			}),
			...(reservation.preOrderId
				? [
						db.order.updateMany({
							where: {
								id: reservation.preOrderId,
								paymentStatus: { not: PaymentStatus.PAID },
								linkedReservation: {
									is: { status: ReservationStatus.DECLINED },
								},
							},
							data: {
								status: OrderStatus.CANCELLED,
								cancellationNote: input.declineReason,
							},
						}),
					]
				: []),
		]);

		if (declined.count === 0) {
			throw new ActionError(
				"This booking has just been paid or updated, so it can't be declined. Refresh to see its current status.",
			);
		}
		await cancelReservationExpiry(reservation.qstashMessageId);

		await notifyReservationDeclined(reservation.id);

		await dispatchNotification({
			restaurantId: restaurant.id,
			type: NotificationType.RESERVATION_CANCELLED,
			audience: NotificationAudience.STAFF,
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
				tableId: true,
				status: true,
				expiresAt: true,
				paymentDueAt: true,
				customerName: true,
				customerEmail: true,
				reservationPaymentStatus: true,
				reservationAmountPaid: true,
				restaurant: { select: { id: true, slug: true } },
			},
		});

		if (!reservation) {
			throw new ActionError("Reservation not found.");
		}

		if (reservation.reservationPaymentStatus === PaymentStatus.PAID) {
			redirect(`/${reservation.restaurant.slug}/reservation/${reservation.id}`);
		}

		if (reservation.status === ReservationStatus.EXPIRED) {
			throw new ActionError(
				"The time to pay for this booking has run out and the table has been released. Please make a new booking.",
			);
		}

		if (reservation.status !== ReservationStatus.APPROVED) {
			throw new ActionError(
				"Please wait for admin to approve this table before payment.",
			);
		}

		const amountDue = Number(reservation.reservationAmountPaid ?? 0);
		if (amountDue <= 0) {
			redirect(`/${reservation.restaurant.slug}/reservation/${reservation.id}`);
		}

		// Refuses a closed window, and otherwise guarantees the guest a few
		// minutes at checkout so the table can't be released mid-payment.
		await beginReservationCheckout(reservation);

		let authorizationUrl: string;
		try {
			authorizationUrl = await initiateReservationPayment({
				restaurantId: reservation.restaurant.id,
				reservationId: reservation.id,
				restaurantSlug: reservation.restaurant.slug,
				customerName: reservation.customerName,
				customerEmail: reservation.customerEmail,
				amountKobo: Math.round(amountDue * 100),
			});
		} catch (error) {
			// The guest needs to read why; a raw throw would reach them as a digest.
			throw new ActionError(
				error instanceof Error && error.message.includes("online payments")
					? "This restaurant can't take online payments right now. Please contact them to secure your table."
					: "We couldn't start the payment. Please try again in a moment.",
			);
		}
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

		// Conditional: the no-show sweep may have released this table a moment
		// ago, and checking in must not revive a booking over whoever took it.
		const { count } = await db.reservation.updateMany({
			where: { id: reservation.id, status: ReservationStatus.ACTIVE },
			data: {
				status: ReservationStatus.CHECKED_IN,
				qstashMessageId: null,
			},
		});
		if (count === 0) {
			throw new ActionError(
				"This reservation has just expired or changed. Refresh to see its current status.",
			);
		}
		await cancelReservationExpiry(reservation.qstashMessageId);

		revalidateReservationAdminPaths(restaurant.slug);
		revalidatePath(`/${restaurant.slug}/reservation/${reservation.id}`);
	});
}

const cancelByRestaurantSchema = reservationIdSchema.extend({
	reason: z
		.string()
		.trim()
		.min(3, "Tell the guest why the booking is cancelled.")
		.max(300),
});

/**
 * The restaurant cancels a booking **before its time**.
 *
 * - A reason is required; the guest sees it (page, email, SMS/WhatsApp).
 * - If the guest paid, it's the restaurant's decision, so the full amount is
 *   owed back (Refund Policy) and flagged "Refund needed" until marked done.
 * - Once the time has passed there's nothing to cancel: check the guest in,
 *   mark a no-show, or refund at the restaurant's discretion.
 */
export async function cancelReservationAction(formData: FormData) {
	return actionResult(async () => {
		const input = cancelByRestaurantSchema.parse({
			slug: formData.get("slug"),
			reservationId: formData.get("reservationId"),
			reason: formData.get("reason"),
		});
		const user = await requireUser();
		const restaurant = await requireOwnedRestaurantBySlug(input.slug);
		const reservation = await db.reservation.findFirst({
			where: { id: input.reservationId, restaurantId: restaurant.id },
			select: {
				id: true,
				status: true,
				startsAt: true,
				qstashMessageId: true,
				customerName: true,
				reservationAmountPaid: true,
				reservationPaymentStatus: true,
				preOrderId: true,
				table: { select: { label: true } },
			},
		});

		if (!reservation) {
			throw new ActionError("Reservation not found.");
		}
		if (
			reservation.status !== ReservationStatus.ACTIVE &&
			reservation.status !== ReservationStatus.APPROVED
		) {
			throw new ActionError("Only upcoming bookings can be cancelled.");
		}
		if (reservation.startsAt <= new Date()) {
			throw new ActionError(
				"This booking's time has passed, so it can't be cancelled. Check the guest in, mark them as a no-show, or refund them if your policy allows.",
			);
		}

		const amount = Number(reservation.reservationAmountPaid ?? 0);
		const paid =
			reservation.reservationPaymentStatus === PaymentStatus.PAID && amount > 0;
		const money = `₦${amount.toLocaleString("en-NG")}`;

		const { count } = await db.reservation.updateMany({
			where: {
				id: reservation.id,
				status: { in: [ReservationStatus.ACTIVE, ReservationStatus.APPROVED] },
			},
			data: {
				status: ReservationStatus.CANCELLED,
				qstashMessageId: null,
				paymentDueAt: null,
				cancelledBy: "RESTAURANT",
				cancelledAt: new Date(),
				cancellationReason: input.reason,
				// The restaurant cancelled: the guest is owed everything they paid.
				...(paid
					? {
							refundRequiredReason: `Cancelled by the restaurant — refund ${money} in full. Reason given: ${input.reason}`,
						}
					: {}),
			},
		});
		if (count === 0) {
			throw new ActionError(
				"This reservation has just changed. Refresh to see its current status.",
			);
		}
		await cancelReservationExpiry(reservation.qstashMessageId);

		// Food pre-ordered with the booking is cancelled with it; if it was paid
		// for, that money is owed back too.
		if (reservation.preOrderId) {
			await db.order.updateMany({
				where: {
					id: reservation.preOrderId,
					status: { not: OrderStatus.CANCELLED },
				},
				data: {
					status: OrderStatus.CANCELLED,
					cancelledAt: new Date(),
					cancellationNote: `Booking cancelled by the restaurant: ${input.reason}`,
				},
			});
			await db.order.updateMany({
				where: {
					id: reservation.preOrderId,
					paymentStatus: PaymentStatus.PAID,
					refundRequiredReason: null,
				},
				data: {
					refundRequiredReason:
						"Pre-order for a booking the restaurant cancelled — refund in full",
				},
			});
		}

		await recordAuditEvent({
			restaurantId: restaurant.id,
			actorType: AuditActorType.OWNER,
			actorId: user.id,
			actorName: user.name ?? user.email,
			action: "reservation.cancelled_by_restaurant",
			target: `Reservation #${reservation.id.slice(-6).toUpperCase()}`,
			newValue: paid ? `${input.reason} (refund ${money} owed)` : input.reason,
		});

		// Email, plus SMS/WhatsApp on the restaurant's update channel.
		await notifyReservationCancelled(reservation.id);
		await notifyGuestReservationCancelled(reservation.id);

		await dispatchNotification({
			restaurantId: restaurant.id,
			type: NotificationType.RESERVATION_CANCELLED,
			audience: NotificationAudience.STAFF,
			title: "Reservation cancelled",
			body: `${reservation.customerName}'s booking for ${reservation.table.label} was cancelled by the manager. The table is free.`,
			actionUrl: `/dashboard/${restaurant.slug}/reservations?reservationId=${reservation.id}`,
			metadata: { reservationId: reservation.id },
		});

		revalidateReservationAdminPaths(restaurant.slug);
		revalidatePath(`/${restaurant.slug}/reservation/${reservation.id}`);
	});
}

/**
 * The guest didn't come. Ends the booking now instead of waiting for the hold
 * to run out (the cron does that automatically too). Whether a deposit is
 * kept is the restaurant's policy; nothing is refunded here.
 */
export async function markReservationNoShowAction(formData: FormData) {
	return actionResult(async () => {
		const input = reservationIdSchema.parse({
			slug: formData.get("slug"),
			reservationId: formData.get("reservationId"),
		});
		const user = await requireUser();
		const restaurant = await requireOwnedRestaurantBySlug(input.slug);
		const reservation = await db.reservation.findFirst({
			where: { id: input.reservationId, restaurantId: restaurant.id },
			select: { id: true, status: true, startsAt: true, qstashMessageId: true },
		});
		if (!reservation) throw new ActionError("Reservation not found.");
		if (reservation.startsAt > new Date()) {
			throw new ActionError("This booking hasn't started yet.");
		}
		const { count } = await db.reservation.updateMany({
			where: { id: reservation.id, status: ReservationStatus.ACTIVE },
			data: { status: ReservationStatus.EXPIRED, qstashMessageId: null },
		});
		if (count === 0) {
			throw new ActionError(
				"Only confirmed bookings that haven't checked in can be marked as a no-show.",
			);
		}
		await cancelReservationExpiry(reservation.qstashMessageId);
		await recordAuditEvent({
			restaurantId: restaurant.id,
			actorType: AuditActorType.OWNER,
			actorId: user.id,
			actorName: user.name ?? user.email,
			action: "reservation.no_show",
			target: `Reservation #${reservation.id.slice(-6).toUpperCase()}`,
		});
		revalidateReservationAdminPaths(restaurant.slug);
		revalidatePath(`/${restaurant.slug}/reservation/${reservation.id}`);
	});
}

const flagRefundSchema = reservationIdSchema.extend({
	reason: z
		.string()
		.trim()
		.min(3, "Add a short reason for the refund.")
		.max(300),
});

/**
 * Refund a paid booking that's already over (a dispute, goodwill, or the
 * restaurant's policy). Flags "Refund needed"; the owner then pays it back
 * from their payment provider and marks it done.
 */
export async function flagReservationRefundAction(formData: FormData) {
	return actionResult(async () => {
		const input = flagRefundSchema.parse({
			slug: formData.get("slug"),
			reservationId: formData.get("reservationId"),
			reason: formData.get("reason"),
		});
		const user = await requireUser();
		const restaurant = await requireOwnedRestaurantBySlug(input.slug);
		const reservation = await db.reservation.findFirst({
			where: { id: input.reservationId, restaurantId: restaurant.id },
			select: {
				id: true,
				reservationAmountPaid: true,
				reservationPaymentStatus: true,
				refundRequiredReason: true,
				refundedAt: true,
			},
		});
		if (!reservation) throw new ActionError("Reservation not found.");
		const amount = Number(reservation.reservationAmountPaid ?? 0);
		if (
			reservation.reservationPaymentStatus !== PaymentStatus.PAID ||
			amount <= 0
		) {
			throw new ActionError("Nothing was paid for this booking.");
		}
		if (reservation.refundRequiredReason) {
			throw new ActionError("A refund is already pending on this booking.");
		}
		if (reservation.refundedAt) {
			throw new ActionError("This booking has already been refunded.");
		}
		const money = `₦${amount.toLocaleString("en-NG")}`;
		await db.reservation.update({
			where: { id: reservation.id },
			data: {
				refundRequiredReason: `Refund ${money}. Reason: ${input.reason}`,
			},
		});
		await recordAuditEvent({
			restaurantId: restaurant.id,
			actorType: AuditActorType.OWNER,
			actorId: user.id,
			actorName: user.name ?? user.email,
			action: "reservation.refund_flagged",
			target: `Reservation #${reservation.id.slice(-6).toUpperCase()}`,
			newValue: `${money}: ${input.reason}`,
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
				startsAt: true,
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

		// Ending the hold now frees the table for later bookings. Never before the
		// start, though: a guest seated early and gone before their booked time
		// would leave a range that ends before it begins.
		await db.reservation.updateMany({
			where: { id: reservation.id, status: ReservationStatus.CHECKED_IN },
			data: {
				status: ReservationStatus.COMPLETED,
				expiresAt: new Date(
					Math.max(Date.now(), reservation.startsAt.getTime() + 60_000),
				),
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
	await assertRestaurantCanChange(restaurant.id);

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
	revalidatePublicMenu(restaurant.slug);
	revalidatePath(`/${restaurant.slug}/tables`);
	return { ok: true };
}

const blackoutSchema = z.object({
	slug: z.string().min(1),
	// The backslashes had been lost (/^d{4}-…/ matches a literal "dddd"), so
	// every blackout date was refused as invalid.
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date."),
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
	await assertRestaurantCanChange(restaurant.id);

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
	await assertRestaurantCanChange(restaurant.id);
	await db.restaurantBlackoutDate.deleteMany({
		where: { restaurantId: restaurant.id, date: parsed.data.date },
	});

	revalidateReservationAdminPaths(restaurant.slug);
	revalidatePath(`/${restaurant.slug}/tables`);
	return { ok: true };
}

/**
 * A guest cancels their own booking from the reservation page.
 *
 * The confirmation email has always said "View or cancel", but only the
 * restaurant could cancel. Allowed until the booking starts. The reservation
 * id in the page's URL is the guest's proof — the same unguessable link the
 * page itself is served from.
 *
 * If the guest has paid, cancelling doesn't refund automatically: whether and
 * how much to return is the restaurant's call under its cancellation policy, so
 * the booking is flagged "Refund needed" for the restaurant to settle.
 */
export async function cancelReservationAsGuestAction(formData: FormData) {
	return actionResult(async () => {
		const input = reservationIdSchema.parse({
			slug: formData.get("slug"),
			reservationId: formData.get("reservationId"),
		});

		const reservation = await db.reservation.findFirst({
			where: {
				id: input.reservationId,
				restaurant: { slug: input.slug },
			},
			select: {
				id: true,
				status: true,
				startsAt: true,
				qstashMessageId: true,
				preOrderId: true,
				customerName: true,
				reservationPaymentStatus: true,
				reservationAmountPaid: true,
				restaurantId: true,
				table: { select: { label: true } },
				restaurant: { select: { slug: true } },
			},
		});
		if (!reservation) throw new ActionError("Reservation not found.");

		const cancellable: ReservationStatus[] = [
			ReservationStatus.PENDING_APPROVAL,
			ReservationStatus.APPROVED,
			ReservationStatus.ACTIVE,
		];
		if (!cancellable.includes(reservation.status)) {
			throw new ActionError("This booking can no longer be cancelled.");
		}
		if (reservation.startsAt <= new Date()) {
			throw new ActionError(
				"Your booking time has started. Please contact the restaurant directly.",
			);
		}

		const paid = reservation.reservationPaymentStatus === PaymentStatus.PAID;
		const amount = Number(reservation.reservationAmountPaid ?? 0);

		// Conditional: a payment or a restaurant decision landing at the same
		// moment wins, rather than being overwritten by the cancellation.
		const { count } = await db.reservation.updateMany({
			where: { id: reservation.id, status: { in: cancellable } },
			data: {
				status: ReservationStatus.CANCELLED,
				qstashMessageId: null,
				paymentDueAt: null,
				cancelledBy: "GUEST",
				cancelledAt: new Date(),
				...(paid && amount > 0
					? {
							refundRequiredReason: `Guest cancelled after paying ₦${amount.toLocaleString("en-NG")} — refund according to your cancellation policy`,
						}
					: {}),
			},
		});
		if (count === 0) {
			throw new ActionError(
				"This booking has just changed. Refresh to see its current status.",
			);
		}

		if (reservation.preOrderId) {
			await db.order.updateMany({
				where: {
					id: reservation.preOrderId,
					paymentStatus: { not: PaymentStatus.PAID },
				},
				data: {
					status: OrderStatus.CANCELLED,
					cancelledAt: new Date(),
					cancellationNote: "Guest cancelled the reservation",
				},
			});
		}
		await cancelReservationExpiry(reservation.qstashMessageId);

		await notifyReservationCancelled(reservation.id, { byCustomer: true });
		await notifyOwnerGuestCancelled(reservation.id);
		await dispatchNotification({
			restaurantId: reservation.restaurantId,
			type: NotificationType.RESERVATION_CANCELLED,
			audience: NotificationAudience.BOTH,
			title:
				paid && amount > 0
					? "Guest cancelled: refund to handle"
					: "Guest cancelled a reservation",
			body: `${reservation.customerName} cancelled ${reservation.table.label}. The table is free.`,
			actionUrl: `/dashboard/${reservation.restaurant.slug}/reservations?reservationId=${reservation.id}`,
			metadata: { reservationId: reservation.id, refund: paid && amount > 0 },
		});

		revalidateReservationAdminPaths(reservation.restaurant.slug);
		revalidatePath(
			`/${reservation.restaurant.slug}/reservation/${reservation.id}`,
		);
	});
}

/**
 * The owner confirms they've refunded a guest, clearing "Refund needed".
 *
 * Reservation deposits are refunded from the payment provider's dashboard (or
 * in person), so the app can't see it happen — the owner records it. Kept in
 * the restaurant's audit trail, with what the flag said.
 */
export async function markReservationRefundedAction(formData: FormData) {
	return actionResult(async () => {
		const input = reservationIdSchema.parse({
			slug: formData.get("slug"),
			reservationId: formData.get("reservationId"),
		});
		const user = await requireUser();
		const restaurant = await requireOwnedRestaurantBySlug(input.slug);

		const reservation = await db.reservation.findFirst({
			where: { id: input.reservationId, restaurantId: restaurant.id },
			select: { id: true, refundRequiredReason: true },
		});
		if (!reservation?.refundRequiredReason) {
			throw new ActionError("There's no refund pending on this booking.");
		}

		await db.reservation.update({
			where: { id: reservation.id },
			data: { refundRequiredReason: null, refundedAt: new Date() },
		});

		await recordAuditEvent({
			restaurantId: restaurant.id,
			actorType: AuditActorType.OWNER,
			actorId: user.id,
			actorName: user.name ?? user.email,
			action: "reservation.refund_marked_done",
			target: `Reservation #${reservation.id.slice(-6).toUpperCase()}`,
			previousValue: reservation.refundRequiredReason,
		});

		revalidateReservationAdminPaths(restaurant.slug);
		revalidatePath(`/${restaurant.slug}/reservation/${reservation.id}`);
	});
}
