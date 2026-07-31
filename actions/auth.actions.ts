"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { sendPasswordResetOtpEmail } from "@/lib/email";

function generateAlphanumericOtp(length: number): string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	let result = "";
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

const requestOtpSchema = z.object({
	email: z.string().email(),
});

export async function requestPasswordResetOtpAction(formData: FormData) {
	const input = requestOtpSchema.parse({
		email: formData.get("email"),
	});

	const user = await db.user.findUnique({
		where: { email: input.email },
	});

	if (!user) {
		// Silently succeed to prevent email enumeration
		return;
	}

	const otp = generateAlphanumericOtp(6);
	const hashedOtp = await bcrypt.hash(otp, 10);
	const identifier = `reset_otp_${input.email}`;

	// Clear any existing OTPs
	await db.verification.deleteMany({
		where: { identifier },
	});

	await db.verification.create({
		data: {
			identifier,
			value: hashedOtp,
			expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
		},
	});

	await sendPasswordResetOtpEmail({
		to: input.email,
		otp,
	});
}

const verifyOtpSchema = z.object({
	email: z.string().email(),
	otp: z.string().length(6),
});

export async function verifyPasswordResetOtpAction(formData: FormData) {
	const input = verifyOtpSchema.parse({
		email: formData.get("email"),
		otp: formData.get("otp"),
	});

	const identifier = `reset_otp_${input.email}`;
	const verification = await db.verification.findFirst({
		where: { identifier },
		orderBy: { createdAt: "desc" },
	});

	if (!verification) {
		throw new Error("Invalid or expired verification code.");
	}

	if (verification.expiresAt < new Date()) {
		throw new Error("Verification code has expired.");
	}

	const isValid = await bcrypt.compare(
		input.otp.toUpperCase(),
		verification.value,
	);
	if (!isValid) {
		throw new Error("Invalid verification code.");
	}

	// Code is valid. Clean up OTP and issue a short-lived reset token
	await db.verification.delete({ where: { id: verification.id } });

	const resetToken = randomBytes(32).toString("hex");
	const hashedToken = await bcrypt.hash(resetToken, 10);
	const tokenIdentifier = `reset_token_${input.email}`;

	await db.verification.deleteMany({ where: { identifier: tokenIdentifier } });

	await db.verification.create({
		data: {
			identifier: tokenIdentifier,
			value: hashedToken,
			expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins to complete reset
		},
	});

	return { resetToken };
}

const resetPasswordSchema = z.object({
	email: z.string().email(),
	resetToken: z.string().min(1),
	newPassword: z.string().min(8, "Password must be at least 8 characters."),
});

export async function resetPasswordWithTokenAction(formData: FormData) {
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
		throw new Error(
			"Session expired. Please restart the password reset process.",
		);
	}

	const isValid = await bcrypt.compare(input.resetToken, verification.value);
	if (!isValid) {
		throw new Error("Invalid session.");
	}

	const user = await db.user.findUnique({
		where: { email: input.email },
		include: { accounts: true },
	});

	if (!user) {
		throw new Error("User not found.");
	}

	const credentialAccount = user.accounts.find(
		(a: (typeof user.accounts)[number]) => a.provider === "credential",
	);
	if (!credentialAccount) {
		throw new Error("No password login setup for this account.");
	}

	const hashedPassword = await hashPassword(input.newPassword);

	await db.account.update({
		where: { id: credentialAccount.id },
		data: { password: hashedPassword },
	});

	await db.verification.delete({ where: { id: verification.id } });
}

const updateAdminPasswordSchema = z.object({
	currentPassword: z.string().min(1),
	newPassword: z.string().min(8, "Password must be at least 8 characters."),
});

export async function updateAdminPasswordAction(formData: FormData) {
	const user = await requireUser();
	const input = updateAdminPasswordSchema.parse({
		currentPassword: formData.get("currentPassword"),
		newPassword: formData.get("newPassword"),
	});

	const userDb = await db.user.findUnique({
		where: { id: user.id },
		include: { accounts: true },
	});

	if (!userDb) throw new Error("User not found.");

	const credentialAccount = userDb.accounts.find(
		(a: (typeof userDb.accounts)[number]) => a.provider === "credential",
	);
	if (!credentialAccount?.password) {
		throw new Error("No password login setup for this account.");
	}

	const isValid = await verifyPassword({
		hash: credentialAccount.password,
		password: input.currentPassword,
	});
	if (!isValid) {
		throw new Error("Incorrect current password.");
	}

	const hashedPassword = await hashPassword(input.newPassword);

	await db.account.update({
		where: { id: credentialAccount.id },
		data: { password: hashedPassword },
	});
}
