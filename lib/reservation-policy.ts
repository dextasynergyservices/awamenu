import type {
	TableBookingMode,
	TableInclusionType,
	TablePaymentTiming,
	TableSeat,
} from "@prisma/client";

/**
 * Booking rules now live on the table itself.
 *
 * This used to merge a restaurant-wide default with a per-table override,
 * which meant the same rule was stated in two places and could disagree — and
 * an owner editing a table couldn't see which value was actually in force.
 * A table for two and a private room for twelve never shared these anyway.
 */
export type TablePolicyInput = Pick<
	TableSeat,
	| "bookingMode"
	| "paymentTiming"
	| "inclusionType"
	| "tableFee"
	| "depositPercent"
	| "minimumSpend"
	| "holdMinutes"
	| "minPartySize"
	| "maxPartySize"
	| "capacity"
>;

export type EffectivePolicy = {
	bookingMode: TableBookingMode;
	paymentTiming: TablePaymentTiming;
	inclusionType: TableInclusionType;
	tableFee: TableSeat["tableFee"];
	depositPercent: number;
	minimumSpend: TableSeat["minimumSpend"];
	holdMinutes: number;
	minPartySize: number;
	/** Resolved: 0 on the table means "up to capacity". */
	maxPartySize: number;
};

export function resolveEffectivePolicy(
	table: TablePolicyInput,
): EffectivePolicy {
	return {
		bookingMode: table.bookingMode,
		paymentTiming: table.paymentTiming,
		inclusionType: table.inclusionType,
		tableFee: table.tableFee,
		depositPercent: table.depositPercent,
		minimumSpend: table.minimumSpend,
		holdMinutes: table.holdMinutes,
		minPartySize: Math.max(1, table.minPartySize),
		maxPartySize:
			table.maxPartySize > 0
				? Math.min(table.maxPartySize, table.capacity)
				: table.capacity,
	};
}

/** Whether this table obliges the customer to order food with the booking. */
export function requiresFoodOrder(policy: {
	bookingMode: TableBookingMode;
	inclusionType: TableInclusionType;
}) {
	return (
		policy.bookingMode === "ORDER_REQUIRED" ||
		policy.inclusionType === "FOOD_ONLY" ||
		policy.inclusionType === "FOOD_AND_TABLE_FEE"
	);
}
