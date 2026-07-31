/**
 * Resolved staff permissions after merging restaurant defaults
 * with per-staff overrides (null = use default).
 */
export type StaffPermissions = {
	dineIn: boolean;
	pickup: boolean;
	delivery: boolean;
	cashPayment: boolean;
	approveReservations: boolean;
};

type RestaurantDefaults = {
	staffDefaultDineIn: boolean;
	staffDefaultPickup: boolean;
	staffDefaultDelivery: boolean;
	staffDefaultCashPayment: boolean;
	staffDefaultApproveReservations: boolean;
};

type StaffOverrides = {
	canHandleDineIn: boolean | null;
	canHandlePickup: boolean | null;
	canHandleDelivery: boolean | null;
	canRecordCashPayment: boolean | null;
	canApproveReservations: boolean | null;
};

/**
 * Resolve effective staff permissions by merging restaurant-level
 * defaults with per-staff overrides. Null overrides fall through
 * to the restaurant default.
 *
 * Same pattern as `resolveEffectivePolicy` for table reservations.
 */
export function resolveStaffPermissions(
	restaurant: RestaurantDefaults,
	staff: StaffOverrides,
): StaffPermissions {
	return {
		dineIn: staff.canHandleDineIn ?? restaurant.staffDefaultDineIn,
		pickup: staff.canHandlePickup ?? restaurant.staffDefaultPickup,
		delivery: staff.canHandleDelivery ?? restaurant.staffDefaultDelivery,
		cashPayment:
			staff.canRecordCashPayment ?? restaurant.staffDefaultCashPayment,
		approveReservations:
			staff.canApproveReservations ??
			restaurant.staffDefaultApproveReservations,
	};
}
