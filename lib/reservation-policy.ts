import type {
	ReservationSetting,
	TableBookingMode,
	TableInclusionType,
	TablePaymentTiming,
	TableSeat,
} from "@prisma/client";

type ReservationPolicyInput = Pick<
	ReservationSetting,
	"bookingMode" | "paymentTiming" | "inclusionType" | "defaultTableFee"
>;

type TablePolicyInput = Pick<
	TableSeat,
	| "bookingModeOverride"
	| "paymentTimingOverride"
	| "inclusionTypeOverride"
	| "tableFee"
>;

export function resolveEffectivePolicy(
	setting: ReservationPolicyInput,
	table: TablePolicyInput,
): {
	bookingMode: TableBookingMode;
	paymentTiming: TablePaymentTiming;
	inclusionType: TableInclusionType;
	tableFee: typeof setting.defaultTableFee;
} {
	return {
		bookingMode: table.bookingModeOverride ?? setting.bookingMode,
		paymentTiming: table.paymentTimingOverride ?? setting.paymentTiming,
		inclusionType: table.inclusionTypeOverride ?? setting.inclusionType,
		tableFee: table.tableFee ?? setting.defaultTableFee,
	};
}
