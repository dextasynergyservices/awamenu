// src/lib/reservation-status.ts

export const ReservationStatusList = {
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
	(typeof ReservationStatusList)[keyof typeof ReservationStatusList];
