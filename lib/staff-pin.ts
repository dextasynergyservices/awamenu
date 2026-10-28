import { randomInt } from "node:crypto";
import { ActionError } from "@/lib/action-error";
import { db } from "@/lib/db";
import { hashesMatch, keyedHash } from "@/lib/signed-token";

/**
 * Per-staff PINs: the Staff ID says who someone claims to be (colleagues can
 * see it), the PIN proves it. Without one, anyone on shift could record a cash
 * payment under a colleague's ID.
 *
 * - The owner generates the PIN; it is shown once and stored only as a keyed
 *   hash (HMAC with a key derived from BETTER_AUTH_SECRET, salted with the
 *   staff member's id), so a database leak alone doesn't reveal 4-digit PINs.
 *   Rotating BETTER_AUTH_SECRET invalidates every PIN; owners reissue them.
 * - Wrong guesses are counted in the database, not only in Redis (the Redis
 *   limiter fails open): MAX_ATTEMPTS wrong PINs lock it for LOCK_MINUTES.
 */

export const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const PURPOSE = "staff-pin";

export function hashStaffPin(staffMemberId: string, pin: string): string {
	return keyedHash(PURPOSE, `${staffMemberId}:${pin}`);
}

/** All one digit, or a run up or down (1234, 9876): the first guesses anyone tries. */
function isGuessable(pin: string): boolean {
	const digits = [...pin].map(Number);
	const steps = new Set(digits.slice(1).map((d, i) => d - digits[i]));
	return steps.size === 1 && [0, 1, -1].includes([...steps][0]);
}

export function generateStaffPin(): string {
	for (;;) {
		const pin = randomInt(0, 10 ** PIN_LENGTH)
			.toString()
			.padStart(PIN_LENGTH, "0");
		if (!isGuessable(pin)) return pin;
	}
}

/** New PIN for a staff member: clears any lockout. Returns the PIN to show once. */
export async function issueStaffPin(staffMemberId: string): Promise<string> {
	const pin = generateStaffPin();
	await db.staffMember.update({
		where: { id: staffMemberId },
		data: {
			pinHash: hashStaffPin(staffMemberId, pin),
			pinSetAt: new Date(),
			pinFailedAttempts: 0,
			pinLockedUntil: null,
		},
	});
	return pin;
}

type PinState = {
	id: string;
	pinHash: string | null;
	pinFailedAttempts: number;
	pinLockedUntil: Date | null;
};

/** Throws an ActionError unless `pin` is this staff member's current PIN. */
export async function checkStaffPin(staff: PinState, pin: string) {
	if (!staff.pinHash) {
		throw new ActionError(
			"You don't have a PIN yet. Ask your manager to set one in Staff settings.",
		);
	}

	const now = new Date();
	if (staff.pinLockedUntil && staff.pinLockedUntil > now) {
		const minutes = Math.ceil(
			(staff.pinLockedUntil.getTime() - now.getTime()) / 60_000,
		);
		throw new ActionError(
			`Too many wrong PINs. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or ask your manager to reset your PIN.`,
		);
	}

	const valid =
		/^\d+$/.test(pin) &&
		pin.length === PIN_LENGTH &&
		hashesMatch(hashStaffPin(staff.id, pin), staff.pinHash);

	if (valid) {
		if (staff.pinFailedAttempts > 0 || staff.pinLockedUntil) {
			await db.staffMember.update({
				where: { id: staff.id },
				data: { pinFailedAttempts: 0, pinLockedUntil: null },
			});
		}
		return;
	}

	// Increment atomically so parallel guesses can't share one count.
	const { pinFailedAttempts } = await db.staffMember.update({
		where: { id: staff.id },
		data: { pinFailedAttempts: { increment: 1 } },
		select: { pinFailedAttempts: true },
	});

	if (pinFailedAttempts >= MAX_ATTEMPTS) {
		await db.staffMember.update({
			where: { id: staff.id },
			data: {
				pinFailedAttempts: 0,
				pinLockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60_000),
			},
		});
		throw new ActionError(
			`Too many wrong PINs. Your PIN is locked for ${LOCK_MINUTES} minutes, or ask your manager to reset it.`,
		);
	}

	const left = MAX_ATTEMPTS - pinFailedAttempts;
	throw new ActionError(
		`Wrong Staff ID or PIN. ${left} attempt${left === 1 ? "" : "s"} left before it locks.`,
	);
}
