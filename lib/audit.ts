import type { AuditActorType } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Records who did something inside a restaurant.
 *
 * The platform's existing AuditLog only covers super-admin actions, which left
 * an owner unable to answer the questions they actually ask: who marked this
 * order paid, who changed where our money is sent, who cancelled this booking.
 *
 * `actorName` is captured rather than joined because staff get deleted and the
 * question "who did this" still needs an answer years later.
 *
 * Never throws. An audit write failing must not roll back the action it was
 * describing — losing the note is bad, losing the payment is worse.
 */
export async function recordAuditEvent(entry: {
	restaurantId: string;
	actorType: AuditActorType;
	actorId?: string | null;
	actorName: string;
	/** Dotted and stable, e.g. "payout.account_changed". */
	action: string;
	/** Human-readable, safe to render, e.g. "Order #A12F". */
	target: string;
	previousValue?: string | null;
	newValue?: string | null;
	ipAddress?: string | null;
}): Promise<void> {
	try {
		await db.restaurantAuditEvent.create({
			data: {
				restaurantId: entry.restaurantId,
				actorType: entry.actorType,
				actorId: entry.actorId ?? null,
				actorName: entry.actorName,
				action: entry.action,
				target: entry.target,
				previousValue: entry.previousValue ?? null,
				newValue: entry.newValue ?? null,
				ipAddress: entry.ipAddress ?? null,
			},
		});
	} catch (error) {
		console.error("[audit] failed to record", entry.action, error);
	}
}

/** Labels for the audit UI. Unknown actions fall back to the raw key rather
 *  than being hidden — an unlabelled entry is still evidence. */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
	"payment.recorded": "Payment recorded",
	"payment.refunded": "Refund issued",
	"payment.mismatch": "Payment mismatch",
	"payout.account_changed": "Payout account changed",
	"payout.account_removed": "Payout account removed",
	"order.cancelled": "Order cancelled",
	"reservation.cancelled": "Reservation cancelled",
	"staff.password_changed": "Staff password changed",
};
