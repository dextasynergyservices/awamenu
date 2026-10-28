import * as Sentry from "@sentry/nextjs";
import type { ReactElement } from "react";
import type { EmailBrand } from "@/emails/brand";
import {
	type BookingFacts,
	ReservationAwaitingPaymentEmail,
	ReservationCancelledEmail,
	ReservationConfirmedEmail,
	ReservationDeclinedEmail,
	ReservationReleasedEmail,
	ReservationRequestedEmail,
} from "@/emails/customer";
import {
	OwnerBookingRequestEmail,
	OwnerGuestCancelledEmail,
} from "@/emails/owner";
import { env } from "@/env";
import { db } from "@/lib/db";
import { getAccountsFromEmail } from "@/lib/email";
import {
	getPlatformBrand,
	getRestaurantEmailIdentity,
} from "@/lib/email-brand";
import { getQueuedMailer } from "@/lib/outbox";
import { formatInTimeZone } from "@/lib/zoned-time";

/**
 * Every lifecycle email for a table reservation.
 *
 * Guests hear from the restaurant, in its branding (lib/email-brand.ts). The
 * owner hears from AwaMenu, and only about what a guest did (a request that
 * needs approval, a guest cancelling): never a copy of what the owner did
 * themselves.
 *
 * Guest emails claim a slot before sending, like lib/order-emails.ts, because
 * the customer's return from Paystack and the webhook can both confirm the
 * same booking within milliseconds of each other.
 */

type EmailSlot =
	| "requestedEmailSentAt"
	| "approvedEmailSentAt"
	| "confirmedEmailSentAt"
	| "declinedEmailSentAt"
	| "cancelledEmailSentAt";

/**
 * Claims a slot, returning true only for the caller that won it.
 *
 * Postgres picks the winner via the conditional UPDATE, so two concurrent
 * confirmations cannot both send. Claiming before sending means a crash loses
 * an email rather than sending two.
 */
async function claim(reservationId: string, slot: EmailSlot): Promise<boolean> {
	const { count } = await db.reservation.updateMany({
		where: { id: reservationId, [slot]: null },
		data: { [slot]: new Date() },
	});
	return count === 1;
}

async function load(reservationId: string) {
	return db.reservation.findUnique({
		where: { id: reservationId },
		select: {
			id: true,
			customerName: true,
			customerEmail: true,
			partySize: true,
			startsAt: true,
			specialRequests: true,
			declineReason: true,
			cancellationReason: true,
			refundRequiredReason: true,
			reservationAmountPaid: true,
			reservationPaymentStatus: true,
			paymentDueAt: true,
			table: { select: { label: true } },
			restaurant: {
				select: {
					id: true,
					name: true,
					slug: true,
					currency: true,
					timezone: true,
					owner: { select: { email: true } },
				},
			},
		},
	});
}

type Reservation = NonNullable<Awaited<ReturnType<typeof load>>>;

const money = (value: number, currency: string) =>
	new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);

/**
 * Written out in full, with the weekday, in the restaurant's timezone (the
 * guest is going there). "13/08" is ambiguous; a guest reading this weeks
 * later needs the day of the week more than anything.
 */
const when = (reservation: Reservation, date: Date) =>
	formatInTimeZone(
		date,
		reservation.restaurant.timezone,
		{
			weekday: "long",
			day: "numeric",
			month: "long",
			year: "numeric",
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		},
		"en-GB",
	);

const paidAmount = (reservation: Reservation) =>
	reservation.reservationPaymentStatus === "PAID"
		? Number(reservation.reservationAmountPaid ?? 0)
		: 0;

function facts(reservation: Reservation): BookingFacts {
	// reservationAmountPaid holds the amount *due* until the guest pays, so it
	// only reads as "Paid" once the payment has actually landed.
	const amount = Number(reservation.reservationAmountPaid ?? 0);
	const currency = reservation.restaurant.currency;
	return {
		reference: reservation.id.slice(-6).toUpperCase(),
		when: when(reservation, reservation.startsAt),
		table: reservation.table.label,
		partySize: reservation.partySize,
		note: reservation.specialRequests,
		amount:
			amount > 0
				? [
						reservation.reservationPaymentStatus === "PAID"
							? "Paid"
							: "Amount due",
						money(amount, currency),
					]
				: null,
	};
}

const viewUrl = (reservation: Reservation) =>
	`${env.NEXT_PUBLIC_APP_URL}/${reservation.restaurant.slug}/reservation/${reservation.id}`;

const bookUrl = (reservation: Reservation) =>
	`${env.NEXT_PUBLIC_APP_URL}/${reservation.restaurant.slug}/tables`;

const dashboardUrl = (reservation: Reservation) =>
	`${env.NEXT_PUBLIC_APP_URL}/dashboard/${reservation.restaurant.slug}/reservations?reservationId=${reservation.id}`;

/**
 * Never rethrows. A reservation must not fail because an email provider is
 * having a bad minute — the booking is the thing that matters.
 */
async function attempt(reservationId: string, run: () => Promise<unknown>) {
	try {
		await run();
	} catch (error) {
		Sentry.captureException(error, { tags: { email: "reservation" } });
		console.error("[reservation-email] send failed", reservationId, error);
	}
}

/** A guest email, in the restaurant's name and branding. */
function sendToGuest(
	reservation: Reservation,
	subject: string,
	build: (brand: EmailBrand) => ReactElement,
) {
	return attempt(reservation.id, async () => {
		if (!reservation.customerEmail) return;
		const identity = await getRestaurantEmailIdentity(
			reservation.restaurant.id,
		);
		await getQueuedMailer().emails.send({
			from: identity.from,
			replyTo: identity.replyTo,
			to: reservation.customerEmail,
			subject,
			react: build(identity.brand),
		});
	});
}

/** An owner email, from AwaMenu. */
function sendToOwner(
	reservation: Reservation,
	subject: string,
	react: ReactElement,
) {
	return attempt(reservation.id, () =>
		getQueuedMailer().emails.send({
			from: getAccountsFromEmail(),
			to: reservation.restaurant.owner.email,
			subject,
			react,
		}),
	);
}

// ─── Guest ────────────────────────────────────────────

/** Sent when a booking needs the restaurant to approve it. */
export async function notifyReservationRequested(reservationId: string) {
	const reservation = await load(reservationId);
	if (!reservation?.customerEmail) return;
	if (!(await claim(reservationId, "requestedEmailSentAt"))) return;

	await sendToGuest(reservation, "We've received your table request", (brand) =>
		ReservationRequestedEmail({
			brand,
			customerName: reservation.customerName,
			booking: facts(reservation),
			viewUrl: viewUrl(reservation),
		}),
	);
}

/** Sent when the table is actually theirs — approved, or paid and auto-confirmed. */
export async function notifyReservationConfirmed(reservationId: string) {
	const reservation = await load(reservationId);
	if (!reservation?.customerEmail) return;
	if (!(await claim(reservationId, "confirmedEmailSentAt"))) return;

	await sendToGuest(
		reservation,
		`Your table is confirmed: ${when(reservation, reservation.startsAt)}`,
		(brand) =>
			ReservationConfirmedEmail({
				brand,
				customerName: reservation.customerName,
				booking: facts(reservation),
				viewUrl: viewUrl(reservation),
			}),
	);
}

/** Sent when the restaurant turns a request down. */
export async function notifyReservationDeclined(reservationId: string) {
	const reservation = await load(reservationId);
	if (!reservation?.customerEmail) return;
	if (!(await claim(reservationId, "declinedEmailSentAt"))) return;

	await sendToGuest(reservation, "We can't take your table booking", (brand) =>
		ReservationDeclinedEmail({
			brand,
			customerName: reservation.customerName,
			when: when(reservation, reservation.startsAt),
			reason: reservation.declineReason,
			paid: paidAmount(reservation) > 0,
			bookUrl: bookUrl(reservation),
		}),
	);
}

/** Sent to the guest when a booking is cancelled, by either side. */
export async function notifyReservationCancelled(
	reservationId: string,
	options?: { byCustomer?: boolean },
) {
	const reservation = await load(reservationId);
	if (!reservation?.customerEmail) return;
	if (!(await claim(reservationId, "cancelledEmailSentAt"))) return;

	// A refund the restaurant now owes (it cancelled a paid booking, or the
	// guest cancelled within the policy). The restaurant pays it back.
	const owed = reservation.refundRequiredReason ? paidAmount(reservation) : 0;

	await sendToGuest(
		reservation,
		options?.byCustomer
			? "Your booking is cancelled"
			: "Your table booking has been cancelled",
		(brand) =>
			ReservationCancelledEmail({
				brand,
				customerName: reservation.customerName,
				booking: facts(reservation),
				viewUrl: viewUrl(reservation),
				by: options?.byCustomer ? "guest" : "restaurant",
				reason: reservation.cancellationReason,
				refund: owed > 0 ? money(owed, reservation.restaurant.currency) : null,
			}),
	);
}

/**
 * Sent when a paid booking is approved and the table is now held for them.
 *
 * Before this the guest was never told: the "requested" email promised to
 * follow up, approval sent nothing, and the deposit sat unpaid until someone
 * happened to reopen the tracking page.
 */
export async function notifyReservationAwaitingPayment(reservationId: string) {
	const reservation = await load(reservationId);
	if (!reservation?.customerEmail) return;
	if (!(await claim(reservationId, "approvedEmailSentAt"))) return;

	await sendToGuest(
		reservation,
		"Approved: pay now to secure your table",
		(brand) =>
			ReservationAwaitingPaymentEmail({
				brand,
				customerName: reservation.customerName,
				booking: facts(reservation),
				viewUrl: viewUrl(reservation),
				payBy: reservation.paymentDueAt
					? when(reservation, reservation.paymentDueAt)
					: null,
			}),
	);
}

/**
 * Sent when a booking stops holding its table without the guest cancelling:
 * the payment window ran out, or the restaurant never answered the request.
 *
 * Shares the cancellation slot — either way the guest hears once that the
 * table is no longer theirs.
 */
export async function notifyReservationReleased(
	reservationId: string,
	reason: "PAYMENT_WINDOW_ENDED" | "REQUEST_NOT_ANSWERED",
) {
	const reservation = await load(reservationId);
	if (!reservation?.customerEmail) return;
	if (!(await claim(reservationId, "cancelledEmailSentAt"))) return;

	await sendToGuest(reservation, "Your table is no longer held", (brand) =>
		ReservationReleasedEmail({
			brand,
			customerName: reservation.customerName,
			when: when(reservation, reservation.startsAt),
			reason,
			bookUrl: bookUrl(reservation),
		}),
	);
}

// ─── Owner ────────────────────────────────────────────
// Called once, from the action that made the change, so no claim slot.

/** A guest asked for a table that needs approval. */
export async function notifyOwnerBookingRequested(reservationId: string) {
	const reservation = await load(reservationId);
	if (!reservation) return;
	const at = when(reservation, reservation.startsAt);
	await sendToOwner(
		reservation,
		`Booking request: ${reservation.customerName}, ${at}`,
		OwnerBookingRequestEmail({
			brand: await getPlatformBrand(),
			restaurantName: reservation.restaurant.name,
			customerName: reservation.customerName,
			when: at,
			table: reservation.table.label,
			partySize: reservation.partySize,
			note: reservation.specialRequests,
			dashboardUrl: dashboardUrl(reservation),
		}),
	);
}

/** The guest cancelled their own booking. */
export async function notifyOwnerGuestCancelled(reservationId: string) {
	const reservation = await load(reservationId);
	if (!reservation) return;
	const at = when(reservation, reservation.startsAt);
	const owed = reservation.refundRequiredReason ? paidAmount(reservation) : 0;
	await sendToOwner(
		reservation,
		`${reservation.customerName} cancelled their booking for ${at}`,
		OwnerGuestCancelledEmail({
			brand: await getPlatformBrand(),
			restaurantName: reservation.restaurant.name,
			customerName: reservation.customerName,
			when: at,
			table: reservation.table.label,
			refund: owed > 0 ? money(owed, reservation.restaurant.currency) : null,
			dashboardUrl: dashboardUrl(reservation),
		}),
	);
}
