import * as Sentry from "@sentry/nextjs";
import { env } from "@/env";
import { db } from "@/lib/db";
import { getResendClient, getRestaurantFromEmail } from "@/lib/email";

/**
 * Every lifecycle email for a table reservation.
 *
 * There were none at all: a guest could book a table, pay a deposit and receive
 * nothing — no confirmation, no time, no address, nothing to show on arrival.
 * The order side already had this; reservations were simply never given it.
 *
 * Modelled on lib/order-emails.ts deliberately, including the claim-before-send
 * discipline, because reservations have the same problem: the customer's return
 * from Paystack and the webhook can both confirm the same booking within
 * milliseconds of each other.
 */

type EmailSlot =
	| "requestedEmailSentAt"
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
			endsAt: true,
			specialRequests: true,
			declineReason: true,
			effectiveTableFee: true,
			reservationAmountPaid: true,
			reservationPaymentStatus: true,
			table: { select: { label: true } },
			restaurant: {
				select: {
					name: true,
					slug: true,
					phone: true,
					address: true,
					currency: true,
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
 * Written out in full, with the weekday.
 *
 * "13/08" is ambiguous across regions and easy to misread; a guest reading this
 * on a phone three weeks later needs the day of the week more than anything, so
 * it leads.
 */
const when = (date: Date) =>
	new Intl.DateTimeFormat("en-GB", {
		weekday: "long",
		day: "numeric",
		month: "long",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
		timeZone: "Africa/Lagos",
	}).format(date);

/** The details a guest needs on arrival, in the order they'll want them. */
function detailLines(reservation: Reservation): string[] {
	const lines = [
		`When: ${when(reservation.startsAt)}`,
		`Table: ${reservation.table.label}`,
		`Party size: ${reservation.partySize} ${reservation.partySize === 1 ? "guest" : "guests"}`,
	];

	if (reservation.restaurant.address) {
		lines.push(`Address: ${reservation.restaurant.address}`);
	}
	if (reservation.restaurant.phone) {
		lines.push(`Phone: ${reservation.restaurant.phone}`);
	}
	if (reservation.specialRequests) {
		lines.push(`Your note: ${reservation.specialRequests}`);
	}

	const paid = Number(reservation.reservationAmountPaid ?? 0);
	if (paid > 0) {
		lines.push(`Paid: ${money(paid, reservation.restaurant.currency)}`);
	}

	return lines;
}

async function send(
	reservation: Reservation,
	subject: string,
	body: string,
): Promise<void> {
	if (!reservation.customerEmail) return;

	try {
		await getResendClient().emails.send({
			from: getRestaurantFromEmail(reservation.restaurant.name),
			to: reservation.customerEmail,
			subject,
			text: body,
		});
	} catch (error) {
		// Never rethrown. A reservation must not fail because an email provider
		// is having a bad minute — the booking is the thing that matters.
		Sentry.captureException(error);
		console.error("[reservation-email] send failed", reservation.id, error);
	}
}

const viewUrl = (reservation: Reservation) =>
	`${env.NEXT_PUBLIC_APP_URL}/${reservation.restaurant.slug}/reservation/${reservation.id}`;

/** Sent when a booking needs the restaurant to approve it. */
export async function notifyReservationRequested(reservationId: string) {
	const reservation = await load(reservationId);
	if (!reservation?.customerEmail) return;
	if (!(await claim(reservationId, "requestedEmailSentAt"))) return;

	await send(
		reservation,
		`We received your table request — ${reservation.restaurant.name}`,
		[
			`Hi ${reservation.customerName},`,
			"",
			`Thanks for your request. ${reservation.restaurant.name} will confirm shortly — this is not a confirmed booking yet, and we'll email you the moment it is.`,
			"",
			...detailLines(reservation),
			"",
			`Track it here: ${viewUrl(reservation)}`,
			"",
			reservation.restaurant.name,
		].join("\n"),
	);
}

/** Sent when the table is actually theirs — approved, or paid and auto-confirmed. */
export async function notifyReservationConfirmed(reservationId: string) {
	const reservation = await load(reservationId);
	if (!reservation?.customerEmail) return;
	if (!(await claim(reservationId, "confirmedEmailSentAt"))) return;

	await send(
		reservation,
		`Table confirmed — ${reservation.restaurant.name}, ${when(reservation.startsAt)}`,
		[
			`Hi ${reservation.customerName},`,
			"",
			`Your table at ${reservation.restaurant.name} is confirmed. Show this email when you arrive.`,
			"",
			...detailLines(reservation),
			"",
			`View or cancel: ${viewUrl(reservation)}`,
			"",
			"If your plans change, please let us know so the table can go to someone else.",
			"",
			reservation.restaurant.name,
		].join("\n"),
	);
}

/** Sent when the restaurant turns a request down. */
export async function notifyReservationDeclined(reservationId: string) {
	const reservation = await load(reservationId);
	if (!reservation?.customerEmail) return;
	if (!(await claim(reservationId, "declinedEmailSentAt"))) return;

	const refunded = Number(reservation.reservationAmountPaid ?? 0) > 0;

	await send(
		reservation,
		`Your table request couldn't be confirmed — ${reservation.restaurant.name}`,
		[
			`Hi ${reservation.customerName},`,
			"",
			`We're sorry — ${reservation.restaurant.name} can't take your booking for ${when(reservation.startsAt)}.`,
			reservation.declineReason ? `\nReason: ${reservation.declineReason}` : "",
			refunded
				? "\nAnything you paid is being returned to you."
				: "\nYou have not been charged.",
			"",
			reservation.restaurant.phone
				? `Call ${reservation.restaurant.phone} if you'd like to try another time.`
				: "Please try another time if you'd still like to visit.",
			"",
			reservation.restaurant.name,
		]
			.filter(Boolean)
			.join("\n"),
	);
}

/** Sent when a booking is cancelled, by either side. */
export async function notifyReservationCancelled(
	reservationId: string,
	options?: { byCustomer?: boolean },
) {
	const reservation = await load(reservationId);
	if (!reservation?.customerEmail) return;
	if (!(await claim(reservationId, "cancelledEmailSentAt"))) return;

	await send(
		reservation,
		`Reservation cancelled — ${reservation.restaurant.name}`,
		[
			`Hi ${reservation.customerName},`,
			"",
			options?.byCustomer
				? `Your table for ${when(reservation.startsAt)} has been cancelled as requested.`
				: `Your table for ${when(reservation.startsAt)} has been cancelled by ${reservation.restaurant.name}.`,
			"",
			...detailLines(reservation),
			"",
			reservation.restaurant.phone
				? `Questions? Call ${reservation.restaurant.phone}.`
				: "",
			"",
			reservation.restaurant.name,
		]
			.filter(Boolean)
			.join("\n"),
	);
}
