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
