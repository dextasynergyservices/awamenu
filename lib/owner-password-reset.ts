import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { sendPasswordResetOtpEmail } from "@/lib/email";

/**
 * Issues an owner's password-reset code and emails it.
 *
 * Shared by the "forgot password" page and the Super Admin's "send password
 * reset" — an admin never sets or sees an owner's password; the owner always
 * chooses the new one themselves from the code in their inbox.
 *
 * The code used to come from Math.random, which is predictable; it now comes
 * from the crypto RNG. Stored only as a bcrypt hash.
 */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_TTL_MS = 15 * 60 * 1000;

export const resetCodeIdentifier = (email: string) => `reset_otp_${email}`;

function generateCode(length = 6) {
	let code = "";
	for (let i = 0; i < length; i++) {
		code += ALPHABET[randomInt(ALPHABET.length)];
	}
	return code;
}

/** Returns false when no owner has this email (callers stay silent about it). */
export async function issueOwnerPasswordReset(email: string): Promise<boolean> {
	const user = await db.user.findUnique({
		where: { email },
		select: { id: true },
	});
	if (!user) return false;

	const code = generateCode();
	const identifier = resetCodeIdentifier(email);

	// One live code at a time.
	await db.verification.deleteMany({ where: { identifier } });
	await db.verification.create({
		data: {
			identifier,
			value: await bcrypt.hash(code, 10),
			expiresAt: new Date(Date.now() + CODE_TTL_MS),
		},
	});

	await sendPasswordResetOtpEmail({ to: email, otp: code });
	return true;
}
