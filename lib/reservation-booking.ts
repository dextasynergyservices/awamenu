import {
	NotificationAudience,
	NotificationType,
	OrderStatus,
	PaymentStatus,
	type Prisma,
	ReservationStatus,
	TableBookingMode,
	TableInclusionType,
	TablePaymentTiming,
} from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { ActionError } from "@/lib/action-error";
import { db } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";
import { scheduleReservationExpiry } from "@/lib/qstash";
import {
	notifyReservationAwaitingPayment,
	notifyReservationConfirmed,
	notifyReservationReleased,
} from "@/lib/reservation-emails";

/**
 * The reservation lifecycle rules, in one place.
 *
 * Owner approval, staff approval, auto-confirm, the payment webhook, the
 * customer's return from checkout and the cron all used to carry their own copy
 * of "does this booking hold the table" — and the copies disagreed (staff
 * approval skipped the overlap check entirely). Everything that changes whether
 * a table is held goes through here.
 *
 * The lifecycle:
 *
 *   PENDING_APPROVAL ──approve──▶ APPROVED (owes money, held until paymentDueAt)
 *         │                          │ paid            │ window ends
 *         │                          ▼                 ▼
 *         ├──approve (free)──▶    ACTIVE ──────▶   EXPIRED   (table released)
 *         │                          │ check in
 *         ▼                          ▼
 *      EXPIRED (never answered)   CHECKED_IN ──▶ COMPLETED
 *
 * Correctness never depends on the cron running on time: a lapsed hold is
 * treated as free the moment its deadline passes (see holdingReservationWhere)
 * and is swept before any write that could collide with it. The database's
 * exclusion constraint (in prisma/migrations/0_init) is the final
 * guarantee that two bookings can never hold one table at once.
 */

/** Statuses the database exclusion constraint treats as holding a table. */
export const HOLDING_STATUSES = [
	ReservationStatus.APPROVED,
	ReservationStatus.ACTIVE,
	ReservationStatus.CHECKED_IN,
] as const;

/** Used when a restaurant has no reservation settings row yet. */
export const DEFAULT_PAYMENT_WINDOW_MINUTES = 120;

/**
 * Minimum time a guest has once they press "Pay".
 *
 * A guest who opens checkout two minutes before the deadline would otherwise
 * be charged for a table released mid-payment. Pressing Pay tops the hold up to
 * this much (never past the booking itself) — the same short checkout hold
 * ticketing sites use.
 */
export const CHECKOUT_HOLD_MINUTES = 15;

const MINUTE = 60_000;

/**
 * Reservations that hold their table right now.
 *
 * An APPROVED booking stops holding the moment its payment deadline passes,
 * even before the sweep marks it EXPIRED, so availability is right however late
 * the cron runs. A null deadline is a booking approved before deadlines
 * existed; it keeps holding until the backfill sets one.
 */
export function holdingReservationWhere(
	now: Date = new Date(),
): Prisma.ReservationWhereInput {
	return {
		OR: [
			{
				status: {
					in: [ReservationStatus.ACTIVE, ReservationStatus.CHECKED_IN],
				},
			},
			{
				status: ReservationStatus.APPROVED,
				OR: [
					{ reservationPaymentStatus: PaymentStatus.PAID },
					{ paymentDueAt: null },
					{ paymentDueAt: { gt: now } },
				],
			},
		],
	};
}

/**
 * True when Postgres refused a write because it would double-book a table.
 *
 * Prisma has no error code for exclusion constraints, so it surfaces as an
 * unknown request error carrying the database message — matched on the
 * constraint name and SQLSTATE 23P01.
 */
export function isReservationOverlapError(error: unknown): boolean {
	const message =
		error instanceof Error
			? error.message
			: typeof error === "string"
				? error
				: "";
	return (
		message.includes("reservation_no_overlap") || message.includes("23P01")
	);
}

/** Runs a side effect without letting its failure undo the work before it. */
async function safely(label: string, run: () => Promise<unknown>) {
	try {
		await run();
	} catch (error) {
		Sentry.captureException(error, { tags: { component: label } });
		console.error(`[reservation] ${label} failed`, error);
	}
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

/** What the guest owes up front for a booking, in naira. */
export function calculateReservationAmountDue({
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

/**
 * The payment deadline for a hold starting now.
 *
 * Capped at the end of the booking: a hold that outlives the sitting it is for
 * would block the table for nothing.
 */
export function paymentDeadline(input: {
	now: Date;
	windowMinutes: number;
	expiresAt: Date;
}) {
	return new Date(
		Math.min(
			input.now.getTime() + input.windowMinutes * MINUTE,
			input.expiresAt.getTime(),
		),
	);
}

/** Schedules the no-show expiry for a confirmed booking and records its id. */
export async function scheduleNoShowExpiry(reservation: {
	id: string;
	expiresAt: Date;
}) {
	const qstashMessageId = await scheduleReservationExpiry({
		reservationId: reservation.id,
		expiresAt: reservation.expiresAt,
	});
	if (qstashMessageId) {
		await db.reservation.update({
			where: { id: reservation.id },
			data: { qstashMessageId },
		});
	}
}

/**
 * Releases approved bookings whose payment window has ended.
 *
 * Called by the cron, and inline before any write to a table so a stale hold
 * can never make the exclusion constraint refuse a legitimate booking. Each row
 * is claimed with a conditional update, so concurrent sweeps release — and
 * notify — each booking exactly once.
 */
export async function releaseLapsedPaymentHolds(
	options: { tableId?: string; now?: Date; limit?: number } = {},
) {
	const now = options.now ?? new Date();
	const lapsedWhere: Prisma.ReservationWhereInput = {
		status: ReservationStatus.APPROVED,
		reservationPaymentStatus: { not: PaymentStatus.PAID },
		paymentDueAt: { lte: now },
		...(options.tableId ? { tableId: options.tableId } : {}),
	};

	const lapsed = await db.reservation.findMany({
		where: lapsedWhere,
		select: {
			id: true,
			restaurantId: true,
			preOrderId: true,
			customerName: true,
			table: { select: { label: true } },
			restaurant: { select: { slug: true } },
		},
		orderBy: { paymentDueAt: "asc" },
		take: options.limit ?? 100,
	});

	let released = 0;

	for (const reservation of lapsed) {
		const { count } = await db.reservation.updateMany({
			where: { id: reservation.id, ...lapsedWhere },
			data: { status: ReservationStatus.EXPIRED },
		});
		if (count === 0) continue;
		released += 1;

		if (reservation.preOrderId) {
			await db.order.updateMany({
				where: {
					id: reservation.preOrderId,
					paymentStatus: { not: PaymentStatus.PAID },
				},
				data: {
					status: OrderStatus.CANCELLED,
					cancelledAt: now,
					cancellationNote: "Reservation payment window ended",
				},
			});
		}

		await safely("hold-released-email", () =>
			notifyReservationReleased(reservation.id, "PAYMENT_WINDOW_ENDED"),
		);
		await safely("hold-released-notification", () =>
			dispatchNotification({
				restaurantId: reservation.restaurantId,
				type: NotificationType.RESERVATION_EXPIRED,
				audience: NotificationAudience.ADMIN,
				title: "Unpaid table released",
				body: `${reservation.customerName} didn't pay in time, so ${reservation.table.label} is free again`,
				actionUrl: `/dashboard/${reservation.restaurant.slug}/reservations?reservationId=${reservation.id}`,
				metadata: { reservationId: reservation.id },
			}),
		);
	}

	return released;
}

/**
 * Expires requests the restaurant never answered before the booking time.
 *
 * They hold nothing, but left alone they sit in the owner's queue forever and
 * the guest is never told.
 */
export async function expireUnansweredRequests(
	options: { now?: Date; limit?: number } = {},
) {
	const now = options.now ?? new Date();
	const staleWhere: Prisma.ReservationWhereInput = {
		status: ReservationStatus.PENDING_APPROVAL,
		startsAt: { lte: now },
	};

	const stale = await db.reservation.findMany({
		where: staleWhere,
		select: { id: true, preOrderId: true },
		take: options.limit ?? 100,
	});

	let expired = 0;
	for (const reservation of stale) {
		const { count } = await db.reservation.updateMany({
			where: { id: reservation.id, ...staleWhere },
			data: { status: ReservationStatus.EXPIRED },
		});
		if (count === 0) continue;
		expired += 1;

		if (reservation.preOrderId) {
			await db.order.updateMany({
				where: {
					id: reservation.preOrderId,
					paymentStatus: { not: PaymentStatus.PAID },
				},
				data: {
					status: OrderStatus.CANCELLED,
					cancelledAt: now,
					cancellationNote: "Reservation request was not answered in time",
				},
			});
		}

		await safely("request-lapsed-email", () =>
			notifyReservationReleased(reservation.id, "REQUEST_NOT_ANSWERED"),
		);
	}

	return expired;
}

/**
 * Marks a confirmed booking a no-show once its grace window has passed.
 *
 * QStash fires this at the exact moment when it is configured; the cron sweeps
 * anything QStash missed. Idempotent either way.
 */
export async function expireNoShow(reservationId: string, now = new Date()) {
	const reservation = await db.reservation.findUnique({
		where: { id: reservationId },
		select: {
			id: true,
			restaurantId: true,
			customerName: true,
			table: { select: { label: true } },
			restaurant: { select: { slug: true } },
		},
	});
	if (!reservation) return false;

	const { count } = await db.reservation.updateMany({
		where: {
			id: reservation.id,
			status: ReservationStatus.ACTIVE,
			expiresAt: { lte: now },
		},
		data: { status: ReservationStatus.EXPIRED, qstashMessageId: null },
	});
	if (count === 0) return false;

	await safely("no-show-notification", () =>
		dispatchNotification({
			restaurantId: reservation.restaurantId,
			type: NotificationType.RESERVATION_EXPIRED,
			audience: NotificationAudience.ADMIN,
			title: "Reservation expired",
			body: `${reservation.customerName}'s reservation for ${reservation.table.label} expired`,
			actionUrl: `/dashboard/${reservation.restaurant.slug}/reservations?reservationId=${reservation.id}`,
			metadata: { reservationId: reservation.id },
		}),
	);
	return true;
}

export async function expireNoShows(
	options: { now?: Date; limit?: number } = {},
) {
	const now = options.now ?? new Date();
	const due = await db.reservation.findMany({
		where: { status: ReservationStatus.ACTIVE, expiresAt: { lte: now } },
		select: { id: true },
		take: options.limit ?? 100,
	});

	let expired = 0;
	for (const reservation of due) {
		if (await expireNoShow(reservation.id, now)) expired += 1;
	}
	return expired;
}

/**
 * Approves a pending request — the one path for owner and staff alike.
 *
 * Free bookings go straight to ACTIVE. Paid ones become APPROVED with a payment
 * deadline, which is what makes an abandoned checkout give the table back.
 * The status change is a conditional update guarded by the exclusion
 * constraint, so two people approving competing requests for one slot cannot
 * both succeed, and approving the same request twice is harmless.
 */
export async function approveReservation(input: {
	restaurantId: string;
	reservationId: string;
}) {
	const now = new Date();
	const reservation = await db.reservation.findFirst({
		where: { id: input.reservationId, restaurantId: input.restaurantId },
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
			restaurant: {
				select: {
					reservationSetting: { select: { paymentWindowMinutes: true } },
				},
			},
		},
	});

	if (!reservation) {
		throw new ActionError("Reservation not found.");
	}
	if (reservation.status !== ReservationStatus.PENDING_APPROVAL) {
		throw new ActionError("Only pending table requests can be approved.");
	}
	if (reservation.expiresAt <= now) {
		throw new ActionError(
			"This booking time has already passed, so it can't be approved.",
		);
	}

	await releaseLapsedPaymentHolds({ tableId: reservation.tableId, now });

	// Checked first only to give a clear message in the common case. The
	// exclusion constraint below is what actually prevents the double booking.
	const conflict = await db.reservation.findFirst({
		where: {
			id: { not: reservation.id },
			tableId: reservation.tableId,
			startsAt: { lt: reservation.expiresAt },
			expiresAt: { gt: reservation.startsAt },
			AND: [holdingReservationWhere(now)],
		},
		select: { id: true },
	});
	const takenMessage =
		"This table is already reserved for that time. Decline this request and suggest another table.";
	if (conflict) {
		throw new ActionError(takenMessage);
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
	// Approving a paid booking the guest has no way to pay would only hold the
	// table until the deadline and then release it.
	if (isPaymentRequired && !(await canTakeOnlinePayment(input.restaurantId))) {
		throw new ActionError(NO_ONLINE_PAYMENTS_FOR_TABLES);
	}
	const nextStatus = isPaymentRequired
		? ReservationStatus.APPROVED
		: ReservationStatus.ACTIVE;
	const paymentDueAt = isPaymentRequired
		? paymentDeadline({
				now,
				windowMinutes:
					reservation.restaurant.reservationSetting?.paymentWindowMinutes ??
					DEFAULT_PAYMENT_WINDOW_MINUTES,
				expiresAt: reservation.expiresAt,
			})
		: null;

	try {
		// A batch, so both writes travel in one round trip. The order update is
		// conditioned on the reservation having just reached nextStatus, so it is a
		// no-op if the approval itself lost a race.
		const [claimed] = await db.$transaction([
			db.reservation.updateMany({
				where: {
					id: reservation.id,
					status: ReservationStatus.PENDING_APPROVAL,
				},
				data: {
					status: nextStatus,
					approvedAt: now,
					declinedAt: null,
					declineReason: null,
					paymentDueAt,
					reservationPaymentStatus: isPaymentRequired
						? PaymentStatus.PENDING
						: PaymentStatus.PAID,
					reservationAmountPaid: isPaymentRequired ? amountDue : null,
				},
			}),
			...(reservation.preOrderId
				? [
						db.order.updateMany({
							where: {
								id: reservation.preOrderId,
								linkedReservation: {
									is: { id: reservation.id, status: nextStatus },
								},
							},
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

		if (claimed.count === 0) {
			throw new ActionError("This request has already been handled.");
		}
	} catch (error) {
		if (isReservationOverlapError(error)) {
			throw new ActionError(takenMessage);
		}
		throw error;
	}

	if (isPaymentRequired) {
		await safely("awaiting-payment-email", () =>
			notifyReservationAwaitingPayment(reservation.id),
		);
	} else {
		await safely("no-show-expiry", () => scheduleNoShowExpiry(reservation));
		await safely("confirmed-email", () =>
			notifyReservationConfirmed(reservation.id),
		);
	}

	return {
		status: nextStatus,
		paymentDueAt,
		customerName: reservation.customerName,
		tableLabel: reservation.table.label,
	};
}

/**
 * Starts checkout for an approved booking, topping its hold up so the guest
 * cannot lose the table mid-payment.
 *
 * Throws when the window has already closed — the hold is released right then
 * rather than waiting for the cron, so the guest is told the truth.
 */
export async function beginReservationCheckout(reservation: {
	id: string;
	tableId: string;
	expiresAt: Date;
	paymentDueAt: Date | null;
}) {
	const now = new Date();

	if (reservation.paymentDueAt && reservation.paymentDueAt <= now) {
		await releaseLapsedPaymentHolds({ tableId: reservation.tableId, now });
		throw new ActionError(
			"The time to pay for this booking has run out and the table has been released. Please make a new booking.",
		);
	}

	const minimum = new Date(
		Math.min(
			now.getTime() + CHECKOUT_HOLD_MINUTES * MINUTE,
			reservation.expiresAt.getTime(),
		),
	);

	// Only ever lengthens a hold. A null deadline (approved before deadlines
	// existed) already holds indefinitely; setting one here would shorten it.
	if (reservation.paymentDueAt && reservation.paymentDueAt < minimum) {
		await db.reservation.updateMany({
			where: {
				id: reservation.id,
				status: ReservationStatus.APPROVED,
				reservationPaymentStatus: { not: PaymentStatus.PAID },
			},
			data: { paymentDueAt: minimum },
		});
	}
}

const NO_ONLINE_PAYMENTS_FOR_TABLES =
	"Guests can't pay online yet. Turn on AwaMenu Pay or connect your own gateway in Settings → Payments, or set this table to pay on arrival.";

/** Whether this restaurant can take an online payment at all right now. */
async function canTakeOnlinePayment(restaurantId: string) {
	const { listCheckoutGateways } = await import("@/lib/payment-routing");
	const options = await listCheckoutGateways(restaurantId);
	return options.length > 0;
}

/**
 * Refuses table rules that ask guests to pay when booking if the restaurant has
 * no online payment channel. Without this a table could be saved as "deposit
 * on booking", guests approved, and then nobody able to pay — every such hold
 * simply expiring.
 */
export async function assertTableRulesCollectable(
	restaurantId: string,
	rules: { bookingMode: TableBookingMode; paymentTiming: TablePaymentTiming },
) {
	const takesPaymentOnBooking =
		rules.paymentTiming === TablePaymentTiming.PAY_ON_BOOKING &&
		rules.bookingMode !== TableBookingMode.FREE_BOOKING;
	if (takesPaymentOnBooking && !(await canTakeOnlinePayment(restaurantId))) {
		throw new ActionError(NO_ONLINE_PAYMENTS_FOR_TABLES);
	}
}
