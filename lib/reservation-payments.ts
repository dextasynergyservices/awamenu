import {
	NotificationAudience,
	NotificationType,
	type PaymentGateway,
	PaymentStatus,
	ReservationStatus,
} from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { dispatchNotification } from "@/lib/notifications";
import { notifyOrderConfirmed, notifyOrderPaid } from "@/lib/order-emails";
import { creditOrder } from "@/lib/payment-ledger";
import {
	holdingReservationWhere,
	isReservationOverlapError,
	scheduleNoShowExpiry,
} from "@/lib/reservation-booking";
import { notifyReservationConfirmed } from "@/lib/reservation-emails";

/**
 * Applies a successful gateway charge to a reservation — the one place that
 * happens.
 *
 * It used to be done twice, by the webhook and by the customer's return page,
 * each with a read-then-write: both could see "unpaid", both scheduled expiry,
 * and neither checked the amount. Because Paystack transactions can be started
 * by anyone holding the public key, with any amount and any metadata, a ₦1
 * charge tagged with a reservation id confirmed that reservation. And a payment
 * landing after a booking had been declined or released brought it back to
 * life on a table someone else now held.
 *
 * Guarantees:
 * 1. **Amount and currency are checked** against what the booking owes.
 * 2. **Exactly-once.** The status change is a conditional update; replays of the
 *    same charge are recognised by reference and change nothing.
 * 3. **No double booking.** A late payment is honoured only if the table is
 *    still free — the exclusion constraint decides — otherwise the money is
 *    flagged for refund, never silently kept or silently dropped.
 *
 * Side effects (emails, notifications, ledger) run only for the call that won,
 * and each is isolated so a failing email can't make the webhook retry.
 */

export type ReservationCharge = {
	reservationId: string;
	gateway: PaymentGateway;
	reference: string;
	/** Minor units (kobo), as the provider reported them. */
	paidMinorUnits: number;
	currency: string;
	gatewayFeeMinorUnits?: number | null;
	subaccountCode?: string | null;
	rawPayload?: unknown;
};

export type ReservationSettlement =
	| { outcome: "CONFIRMED" }
	| { outcome: "ALREADY_CONFIRMED" }
	/** Paid after the hold lapsed, and the table was still free. */
	| { outcome: "REINSTATED" }
	/** Money arrived that can't be honoured; the restaurant has been told. */
	| { outcome: "REFUND_REQUIRED"; reason: string }
	| { outcome: "AMOUNT_MISMATCH"; reason: string }
	| { outcome: "NOT_FOUND" };

async function safely(label: string, run: () => Promise<unknown>) {
	try {
		await run();
	} catch (error) {
		Sentry.captureException(error, { tags: { component: label } });
		console.error(`[reservation-payment] ${label} failed`, error);
	}
}

const naira = (minorUnits: number) =>
	`₦${(minorUnits / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

function loadReservation(reservationId: string) {
	return db.reservation.findUnique({
		where: { id: reservationId },
		select: {
			id: true,
			status: true,
			restaurantId: true,
			tableId: true,
			startsAt: true,
			expiresAt: true,
			preOrderId: true,
			customerName: true,
			reservationPaymentStatus: true,
			reservationPaymentRef: true,
			reservationAmountPaid: true,
			refundRequiredReason: true,
			table: { select: { label: true } },
			restaurant: { select: { slug: true } },
		},
	});
}

type LoadedReservation = NonNullable<
	Awaited<ReturnType<typeof loadReservation>>
>;

const reservationUrl = (reservation: LoadedReservation) =>
	`/dashboard/${reservation.restaurant.slug}/reservations?reservationId=${reservation.id}`;

/**
 * Records that money needs to go back, once.
 *
 * Status is left alone: the booking's state is still true, the restaurant just
 * holds money it must return. The reference is kept so the refund can be found
 * in the gateway dashboard.
 */
async function flagForRefund(
	reservation: LoadedReservation,
	charge: ReservationCharge,
	reason: string,
): Promise<ReservationSettlement> {
	const fullReason = `${reason} (${naira(charge.paidMinorUnits)}, ref ${charge.reference})`;
	let existing = reservation.refundRequiredReason;
	let recorded = false;

	// One line per charge. A replay of the same charge changes nothing, and the
	// optimistic `where` on the previous value stops two concurrent flags from
	// overwriting each other — the loser re-reads and appends.
	for (let attempt = 0; attempt < 3; attempt += 1) {
		if (existing?.includes(`ref ${charge.reference})`)) break;
		const { count } = await db.reservation.updateMany({
			where: { id: reservation.id, refundRequiredReason: existing },
			data: {
				refundRequiredReason: existing
					? `${existing}\n${fullReason}`
					: fullReason,
			},
		});
		if (count === 1) {
			recorded = true;
			break;
		}
		const latest = await db.reservation.findUnique({
			where: { id: reservation.id },
			select: { refundRequiredReason: true },
		});
		existing = latest?.refundRequiredReason ?? null;
	}

	if (recorded) {
		Sentry.captureMessage("Reservation payment needs a refund", {
			level: "warning",
			extra: { reservationId: reservation.id, reason: fullReason },
		});
		await safely("refund-notification", () =>
			dispatchNotification({
				restaurantId: reservation.restaurantId,
				type: NotificationType.PAYMENT_RECEIVED,
				audience: NotificationAudience.ADMIN,
				title: "Refund needed for a table payment",
				body: `${reservation.customerName}: ${fullReason}`,
				actionUrl: reservationUrl(reservation),
				metadata: {
					reservationId: reservation.id,
					reference: charge.reference,
					refund: true,
				},
			}),
		);
	}

	return { outcome: "REFUND_REQUIRED", reason: fullReason };
}

/** Ledger entry for the food pre-order. Idempotent by reference. */
async function creditPreOrder(
	reservation: LoadedReservation,
	charge: ReservationCharge,
) {
	if (!reservation.preOrderId) return;
	const preOrderId = reservation.preOrderId;

	// A deposit is expected to be a part payment of the food, so the charge is
	// passed as its own expected amount: recorded in full, order left owing the
	// balance rather than flagged as an underpayment.
	const credit = await creditOrder(preOrderId, {
		kind: "GATEWAY",
		gateway: charge.gateway,
		reference: charge.reference,
		paidMinorUnits: charge.paidMinorUnits,
		expectedMinorUnits: charge.paidMinorUnits,
		currency: charge.currency,
		gatewayFeeMinorUnits: charge.gatewayFeeMinorUnits ?? null,
		subaccountCode: charge.subaccountCode ?? null,
		rawPayload: charge.rawPayload,
	});

	if (credit.ok && credit.newlyPaid) {
		await safely("preorder-paid-email", () =>
			notifyOrderPaid(preOrderId, { method: "Card or bank transfer" }),
		);
		await safely("preorder-confirmed-email", () =>
			notifyOrderConfirmed(preOrderId),
		);
	}
}

async function afterConfirmed(
	reservation: LoadedReservation,
	charge: ReservationCharge,
	options: { late: boolean },
) {
	await safely("no-show-expiry", () => scheduleNoShowExpiry(reservation));
	await safely("confirmed-email", () =>
		notifyReservationConfirmed(reservation.id),
	);
	await safely("preorder-credit", () => creditPreOrder(reservation, charge));
	await safely("paid-notification", () =>
		dispatchNotification({
			restaurantId: reservation.restaurantId,
			type: NotificationType.NEW_RESERVATION,
			audience: NotificationAudience.BOTH,
			title: options.late ? "Late table payment accepted" : "Reservation paid",
			body: options.late
				? `${reservation.customerName} paid after the hold ran out; ${reservation.table.label} was still free, so the booking is confirmed`
				: `${reservation.customerName} completed a table reservation payment`,
			actionUrl: reservationUrl(reservation),
			metadata: { reservationId: reservation.id },
		}),
	);
}

export async function settleReservationPayment(
	charge: ReservationCharge,
): Promise<ReservationSettlement> {
	const reservation = await loadReservation(charge.reservationId);
	if (!reservation) return { outcome: "NOT_FOUND" };

	// A replay of the charge that already confirmed this booking. The ledger
	// write is retried because it is idempotent and may be the step a crash
	// interrupted; nothing else repeats.
	if (
		reservation.reservationPaymentStatus === PaymentStatus.PAID &&
		reservation.reservationPaymentRef === charge.reference
	) {
		await safely("preorder-credit-replay", () =>
			creditPreOrder(reservation, charge),
		);
		return { outcome: "ALREADY_CONFIRMED" };
	}

	const dueMinorUnits = Math.round(
		Number(reservation.reservationAmountPaid ?? 0) * 100,
	);
	const wrongCurrency = charge.currency.toUpperCase() !== "NGN";
	if (wrongCurrency || charge.paidMinorUnits < dueMinorUnits) {
		const reason = wrongCurrency
			? `Paid in ${charge.currency}, expected NGN`
			: `Paid ${naira(charge.paidMinorUnits)} against ${naira(dueMinorUnits)} due`;
		console.error(
			`[reservation-payment] refused ${charge.reference} for ${reservation.id}: ${reason}`,
		);
		// Recorded for a human, never credited. The money is real, so it is
		// flagged rather than ignored.
		await flagForRefund(
			reservation,
			charge,
			`Payment did not match: ${reason}`,
		);
		return { outcome: "AMOUNT_MISMATCH", reason };
	}

	// A second, different charge for a booking that is already paid — two tabs,
	// or a double tap on a slow connection.
	if (reservation.reservationPaymentStatus === PaymentStatus.PAID) {
		return flagForRefund(reservation, charge, "Booking was already paid");
	}

	const paidData = {
		status: ReservationStatus.ACTIVE,
		reservationPaymentStatus: PaymentStatus.PAID,
		reservationPaymentRef: charge.reference,
		paymentDueAt: null,
	};

	// The normal path. Only one caller can move APPROVED → ACTIVE.
	const claimed = await db.reservation.updateMany({
		where: {
			id: reservation.id,
			status: ReservationStatus.APPROVED,
			reservationPaymentStatus: { not: PaymentStatus.PAID },
		},
		data: paidData,
	});
	if (claimed.count === 1) {
		await afterConfirmed(reservation, charge, { late: false });
		return { outcome: "CONFIRMED" };
	}

	// Lost the claim: someone else confirmed it, or it is no longer APPROVED.
	const current = await loadReservation(reservation.id);
	if (!current) return { outcome: "NOT_FOUND" };

	if (current.reservationPaymentStatus === PaymentStatus.PAID) {
		return current.reservationPaymentRef === charge.reference
			? { outcome: "ALREADY_CONFIRMED" }
			: flagForRefund(current, charge, "Booking was already paid");
	}

	// Paid after the hold lapsed. Honour it if the sitting hasn't passed and the
	// table is still free; the exclusion constraint makes that decision
	// atomically, so a table resold in the meantime can't be double-booked.
	if (
		current.status === ReservationStatus.EXPIRED &&
		current.expiresAt > new Date()
	) {
		const resoldMessage =
			"Paid after the hold ran out, and the table had already been rebooked";
		// Checked first only to keep the logs honest — Prisma logs every
		// constraint refusal as an error, and payment logs full of expected
		// "errors" teach people to ignore them. The constraint below is still
		// what decides a genuine race.
		const taken = await db.reservation.findFirst({
			where: {
				id: { not: current.id },
				tableId: current.tableId,
				startsAt: { lt: current.expiresAt },
				expiresAt: { gt: current.startsAt },
				AND: [holdingReservationWhere()],
			},
			select: { id: true },
		});
		if (taken) {
			return flagForRefund(current, charge, resoldMessage);
		}

		try {
			const reinstated = await db.reservation.updateMany({
				where: {
					id: current.id,
					status: ReservationStatus.EXPIRED,
					reservationPaymentStatus: { not: PaymentStatus.PAID },
				},
				data: paidData,
			});
			if (reinstated.count === 1) {
				await afterConfirmed(current, charge, { late: true });
				return { outcome: "REINSTATED" };
			}
		} catch (error) {
			if (!isReservationOverlapError(error)) throw error;
			return flagForRefund(current, charge, resoldMessage);
		}
	}

	const why: Partial<Record<ReservationStatus, string>> = {
		[ReservationStatus.DECLINED]: "Paid for a request the restaurant declined",
		[ReservationStatus.CANCELLED]: "Paid for a booking that was cancelled",
		[ReservationStatus.EXPIRED]: "Paid after the booking time had passed",
		[ReservationStatus.PENDING_APPROVAL]:
			"Paid before the restaurant approved the request",
	};
	return flagForRefund(
		current,
		charge,
		why[current.status] ?? `Paid while the booking was ${current.status}`,
	);
}
