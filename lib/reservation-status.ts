export const ReservationStatus = {
	PENDING_APPROVAL: "PENDING_APPROVAL",
	APPROVED: "APPROVED",
	ACTIVE: "ACTIVE",
	CHECKED_IN: "CHECKED_IN",
	COMPLETED: "COMPLETED",
	DECLINED: "DECLINED",
	CANCELLED: "CANCELLED",
	EXPIRED: "EXPIRED",
} as const;

export type ReservationStatus =
	(typeof ReservationStatus)[keyof typeof ReservationStatus];

/**
 * What a customer is told a reservation status means.
 *
 * The database keeps eight states because the restaurant needs the detail, but
 * a diner doesn't: ACTIVE and CHECKED_IN both mean "your booking is live", and
 * "Active" tells them nothing about whether they've been seated. This collapses
 * to four words a guest actually recognises, with declined/expired terminal.
 */
export function getCustomerReservationLabel(status: ReservationStatus) {
	switch (status) {
		case ReservationStatus.PENDING_APPROVAL:
			return "Requested";
		case ReservationStatus.APPROVED:
		case ReservationStatus.ACTIVE:
			return "Confirmed";
		case ReservationStatus.CHECKED_IN:
			return "Seated";
		case ReservationStatus.COMPLETED:
			return "Complete";
		case ReservationStatus.DECLINED:
			return "Declined";
		case ReservationStatus.EXPIRED:
			return "Expired";
		default:
			return "Cancelled";
	}
}

/** The three steps a guest sees, in order. Terminal states sit outside it. */
export const CUSTOMER_RESERVATION_STEPS = [
	{ status: ReservationStatus.PENDING_APPROVAL, label: "Requested" },
	{ status: ReservationStatus.APPROVED, label: "Confirmed" },
	{ status: ReservationStatus.CHECKED_IN, label: "Seated" },
	{ status: ReservationStatus.COMPLETED, label: "Complete" },
] as const;
