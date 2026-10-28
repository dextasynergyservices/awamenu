"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { z } from "zod";
import { ActionError, actionData, actionResult } from "@/lib/action-error";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import {
	issueOwnerPasswordReset,
	resetCodeIdentifier,
} from "@/lib/owner-password-reset";
import { enforceRateLimit, getClientIp, getRatelimiter } from "@/lib/ratelimit";

const requestOtpSchema = z.object({
	email: z.string().email(),
});

export async function requestPasswordResetOtpAction(formData: FormData) {
	return actionResult(async () => {
		const input = requestOtpSchema.parse({
			email: formData.get("email"),
		});

		// This custom flow isn't covered by better-auth's own rate limits, so it
		// carries its own: unlimited requests would let anyone flood an owner's
		// inbox, and each send costs an email.
		const clientIp = await getClientIp();
		await enforceRateLimit("otpSendIp", `owner-reset:${clientIp}`);
		await enforceRateLimit("otpSendIdentifier", `owner-reset:${input.email}`);

		// Silently succeeds for unknown emails, to prevent email enumeration.
		await issueOwnerPasswordReset(input.email);
	});
}

const verifyOtpSchema = z.object({
	email: z.string().email(),
	otp: z.string().length(6),
});

export async function verifyPasswordResetOtpAction(formData: FormData) {
	return actionData(async () => {
		const input = verifyOtpSchema.parse({
			email: formData.get("email"),
			otp: formData.get("otp"),
		});

		const identifier = resetCodeIdentifier(input.email);

		// Five tries per code: the counter is consumed on every attempt, and
		// once it runs out the code is destroyed and a new one must be sent.
		const attemptLimiter = getRatelimiter("resetVerify");
		if (attemptLimiter) {
			const allowed = await attemptLimiter
				.limit(input.email)
				.then((result) => result.success)
				.catch(() => true);
			if (!allowed) {
				await db.verification.deleteMany({ where: { identifier } });
				throw new ActionError(
					"Too many wrong codes. Please request a new one.",
				);
			}
		}

		const verification = await db.verification.findFirst({
			where: { identifier },
			orderBy: { createdAt: "desc" },
		});

		if (!verification) {
			throw new ActionError("Invalid or expired verification code.");
		}

		if (verification.expiresAt < new Date()) {
			throw new ActionError("Verification code has expired.");
		}

		const isValid = await bcrypt.compare(
			input.otp.toUpperCase(),
			verification.value,
		);
		if (!isValid) {
			throw new ActionError("Invalid verification code.");
		}

		// Code is valid. Clean up OTP and issue a short-lived reset token
		await db.verification.delete({ where: { id: verification.id } });

		const resetToken = randomBytes(32).toString("hex");
		const hashedToken = await bcrypt.hash(resetToken, 10);
		const tokenIdentifier = `reset_token_${input.email}`;

		await db.verification.deleteMany({
			where: { identifier: tokenIdentifier },
		});

		await db.verification.create({
			data: {
				identifier: tokenIdentifier,
				value: hashedToken,
				expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins to complete reset
			},
		});

		return { resetToken };
	});
}

const resetPasswordSchema = z.object({
	email: z.string().email(),
	resetToken: z.string().min(1),
	newPassword: z.string().min(8, "Password must be at least 8 characters."),
});

export async function resetPasswordWithTokenAction(formData: FormData) {
	return actionResult(async () => {
		const input = resetPasswordSchema.parse({
			email: formData.get("email"),
			resetToken: formData.get("resetToken"),
			newPassword: formData.get("newPassword"),
		});

		const identifier = `reset_token_${input.email}`;
		const verification = await db.verification.findFirst({
			where: { identifier },
			orderBy: { createdAt: "desc" },
		});

		if (!verification || verification.expiresAt < new Date()) {
			throw new ActionError(
				"Session expired. Please restart the password reset process.",
			);
		}

		const isValid = await bcrypt.compare(input.resetToken, verification.value);
		if (!isValid) {
			throw new ActionError("Invalid session.");
		}

		const user = await db.user.findUnique({
			where: { email: input.email },
			include: { accounts: true },
		});

		if (!user) {
			throw new ActionError("User not found.");
		}

		const credentialAccount = user.accounts.find(
			(a: (typeof user.accounts)[number]) => a.provider === "credential",
		);
		if (!credentialAccount) {
			throw new ActionError("No password login setup for this account.");
		}

		const hashedPassword = await hashPassword(input.newPassword);

		await db.account.update({
			where: { id: credentialAccount.id },
			data: { password: hashedPassword },
		});

		await db.verification.delete({ where: { id: verification.id } });

		// A reset is often a response to a compromised account: every existing
		// session — including one an attacker holds — ends here.
		await db.session.deleteMany({ where: { userId: user.id } });
	});
}

const updateAdminPasswordSchema = z.object({
	currentPassword: z.string().min(1),
	newPassword: z.string().min(8, "Password must be at least 8 characters."),
});

export async function updateAdminPasswordAction(formData: FormData) {
	return actionResult(async () => {
		const user = await requireUser();
		const input = updateAdminPasswordSchema.parse({
			currentPassword: formData.get("currentPassword"),
			newPassword: formData.get("newPassword"),
		});

		const userDb = await db.user.findUnique({
			where: { id: user.id },
			include: { accounts: true },
		});

		if (!userDb) throw new ActionError("User not found.");

		const credentialAccount = userDb.accounts.find(
			(a: (typeof userDb.accounts)[number]) => a.provider === "credential",
		);
		if (!credentialAccount?.password) {
			throw new ActionError("No password login setup for this account.");
		}

		const isValid = await verifyPassword({
			hash: credentialAccount.password,
			password: input.currentPassword,
		});
		if (!isValid) {
			throw new ActionError("Incorrect current password.");
		}

		const hashedPassword = await hashPassword(input.newPassword);

		await db.account.update({
			where: { id: credentialAccount.id },
			data: { password: hashedPassword },
		});
	});
}
