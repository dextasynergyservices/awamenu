import { ActionError } from "@/lib/action-error";
import { db } from "@/lib/db";
import { enforceRateLimit, getClientIp } from "@/lib/ratelimit";
import { getStaffSession } from "@/lib/staff-auth";
import { resolveStaffPermissions } from "@/lib/staff-permissions";
import { checkStaffPin } from "@/lib/staff-pin";

/**
 * Authorises a staff action: a live staff-dashboard session for this
 * restaurant, plus the Staff ID and that member's PIN, which together prove
 * who is acting (the ID alone is visible to colleagues).
 *
 * Lives here rather than in actions/staff.actions.ts because every export of a
 * "use server" file is a public endpoint — as an export there, this was itself
 * callable from a browser and returned the full staff record.
 */
export async function verifyStaffAction(
	slug: string,
	staffId: string,
	pin: string,
) {
	const restaurant = await db.restaurant.findUnique({
		where: { slug, isActive: true },
		select: {
			id: true,
			slug: true,
			staffDefaultDineIn: true,
			staffDefaultPickup: true,
			staffDefaultDelivery: true,
			staffDefaultCashPayment: true,
			staffDefaultApproveReservations: true,
		},
	});

	if (!restaurant) {
		throw new ActionError("Restaurant not found.");
	}

	// The staff dashboard's login is what proves the caller is staff here. The
	// page is guarded by it, but server actions are public endpoints that skip
	// the page entirely — so without this check a staff ID alone (known to any
	// ex-employee) could mark orders paid or approve bookings from anywhere.
	const session = await getStaffSession();
	if (!session || session.restaurantId !== restaurant.id) {
		throw new ActionError(
			"Your staff session has ended. Please sign in to the staff dashboard again.",
		);
	}

	const clientIp = await getClientIp();
	await enforceRateLimit("staffPin", `${clientIp}:${restaurant.id}`);

	const staff = await db.staffMember.findFirst({
		where: {
			restaurantId: restaurant.id,
			// Scoped to this restaurant as well as the id, so an id from another
			// restaurant can never attribute actions here.
			staffId: staffId.trim().toUpperCase(),
			isActive: true,
		},
	});

	if (!staff) {
		throw new ActionError("Wrong Staff ID or PIN.");
	}

	await checkStaffPin(staff, pin);

	const permissions = resolveStaffPermissions(restaurant, staff);
	return { staff, permissions, restaurant };
}
