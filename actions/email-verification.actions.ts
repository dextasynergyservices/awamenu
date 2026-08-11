"use server";

import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { env } from "@/env";
import { ActionError, actionResult } from "@/lib/action-error";
import { db } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";

const TOKEN_IDENTIFIER_PREFIX = "verify_email_token_";
const OTP_IDENTIFIER_PREFIX = "verify_email_otp_";
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESEND_COOLDOWN_MS = 60 * 1000; // 1 minute

function generateNumericOtp(length: number): string {
	let result = "";
	for (let i = 0; i < length; i++) {
		result += Math.floor(Math.random() * 10).toString();
	}
	return result;
}

async function issueAndSendVerification(
	email: string,
	plan?: string | null,
	billing?: string | null,
) {
	const token = randomBytes(32).toString("hex");
	const code = generateNumericOtp(6);

	const [hashedToken, hashedCode] = await Promise.all([
		bcrypt.hash(token, 10),
		bcrypt.hash(code, 10),
	]);

	const tokenIdentifier = `${TOKEN_IDENTIFIER_PREFIX}${email}`;
	const otpIdentifier = `${OTP_IDENTIFIER_PREFIX}${email}`;
	const expiresAt = new Date(Date.now() + EXPIRY_MS);

	await db.$transaction([
		db.verification.deleteMany({ where: { identifier: tokenIdentifier } }),
		db.verification.deleteMany({ where: { identifier: otpIdentifier } }),
		db.verification.create({
			data: { identifier: tokenIdentifier, value: hashedToken, expiresAt },
		}),
		db.verification.create({
			data: { identifier: otpIdentifier, value: hashedCode, expiresAt },
		}),
	]);

	const verifyUrl = new URL("/verify-email", env.NEXT_PUBLIC_APP_URL);
	verifyUrl.searchParams.set("token", token);
	verifyUrl.searchParams.set("email", email);
	if (plan) verifyUrl.searchParams.set("plan", plan);
	if (billing) verifyUrl.searchParams.set("billing", billing);

	try {
		await sendVerificationEmail({
			to: email,
			verifyUrl: verifyUrl.toString(),
			code,
		});
	} catch (error) {
		// The rows are written first so the code is live the instant the email
		// lands. If the send fails they must not survive: they leave a code
		// nobody received and — worse — start the resend cooldown, locking the
		// user out of the one button that could fix it.
		await db.verification.deleteMany({
			where: { identifier: { in: [tokenIdentifier, otpIdentifier] } },
		});
		throw error;
	}
}

const sendVerificationSchema = z.object({
	email: z.string().email(),
	plan: z.string().min(1).optional(),
	billing: z.string().min(1).optional(),
});

/**
 * Sends the initial verification email (link + code) right after signup.
 * A no-op for accounts that are already verified.
 */
export async function sendEmailVerificationAction(formData: FormData) {
	return actionResult(async () => {
		const input = sendVerificationSchema.parse({
			email: formData.get("email"),
			plan: formData.get("plan") || undefined,
			billing: formData.get("billing") || undefined,
		});

		const user = await db.user.findUnique({ where: { email: input.email } });
		if (!user || user.emailVerified) return;

		try {
			await issueAndSendVerification(input.email, input.plan, input.billing);
		} catch {
			throw new ActionError(
				"We couldn't send your verification email. Use Resend on the next screen.",
			);
		}
	});
}

/**
 * Whether an email belongs to an account that exists but hasn't verified.
 *
 * Lets sign-in and sign-up route someone back into verification rather than
 * failing at them — "user already exists" is a dead end for a person who
 * simply closed the tab before entering their code.
 */
export async function getEmailVerificationStateAction(email: string) {
	const parsed = z.string().email().safeParse(email);
	if (!parsed.success) return { exists: false, verified: false };

	const user = await db.user.findUnique({
		where: { email: parsed.data },
		select: { emailVerified: true },
	});

	return { exists: Boolean(user), verified: Boolean(user?.emailVerified) };
}

/**
 * Issues a fresh code for someone returning to an unverified account.
 *
 * Bypasses the resend cooldown on purpose: this fires once when they arrive
 * back at the screen, not from a button they can hammer.
 */
export async function resumeEmailVerificationAction(formData: FormData) {
	return actionResult(async () => {
		const input = sendVerificationSchema.parse({
			email: formData.get("email"),
			plan: formData.get("plan") || undefined,
			billing: formData.get("billing") || undefined,
		});

		const user = await db.user.findUnique({ where: { email: input.email } });
		if (!user || user.emailVerified) return;

		await issueAndSendVerification(input.email, input.plan, input.billing);
	});
}

/**
 * Re-sends the verification email, rate-limited to one per minute so a user
 * mashing "resend" can't spam themselves (or someone else's inbox).
 */
export async function resendVerificationEmailAction(formData: FormData) {
	return actionResult(async () => {
		const input = sendVerificationSchema.parse({
			email: formData.get("email"),
			plan: formData.get("plan") || undefined,
			billing: formData.get("billing") || undefined,
		});

		const user = await db.user.findUnique({ where: { email: input.email } });
		if (!user) {
			throw new ActionError("No account found for that email.");
		}
		if (user.emailVerified) return;

		const existing = await db.verification.findFirst({
			where: { identifier: `${TOKEN_IDENTIFIER_PREFIX}${input.email}` },
			orderBy: { createdAt: "desc" },
		});

		if (
			existing &&
			Date.now() - existing.createdAt.getTime() < RESEND_COOLDOWN_MS
		) {
			throw new ActionError(
				"Please wait a moment before requesting another email.",
			);
		}

		await issueAndSendVerification(input.email, input.plan, input.billing);
	});
}

const verifyCodeSchema = z.object({
	email: z.string().email(),
	code: z.string().length(6),
});

/**
 * Verifies via the 6-digit code path. Shared cleanup with the link path
 * lives in `markEmailVerified` below.
 */
export async function verifyEmailWithCodeAction(formData: FormData) {
	return actionResult(async () => {
		const input = verifyCodeSchema.parse({
			email: formData.get("email"),
			code: formData.get("code"),
		});

		const identifier = `${OTP_IDENTIFIER_PREFIX}${input.email}`;
		const verification = await db.verification.findFirst({
			where: { identifier },
			orderBy: { createdAt: "desc" },
		});

		if (!verification || verification.expiresAt < new Date()) {
			throw new ActionError("Invalid or expired verification code.");
		}

		const isValid = await bcrypt.compare(input.code, verification.value);
		if (!isValid) {
			throw new ActionError("Invalid verification code.");
		}

		await markEmailVerified(input.email);
	});
}

/**
 * Verifies via the emailed link. Called directly (not as a form action) from
 * the `/verify-email` page's server component, since that's a plain GET
 * navigation, not a form submission.
 */
export async function verifyEmailWithToken(email: string, token: string) {
	const identifier = `${TOKEN_IDENTIFIER_PREFIX}${email}`;
	const verification = await db.verification.findFirst({
		where: { identifier },
		orderBy: { createdAt: "desc" },
	});

	if (!verification || verification.expiresAt < new Date()) {
		return false;
	}

	const isValid = await bcrypt.compare(token, verification.value);
	if (!isValid) return false;

	await markEmailVerified(email);
	return true;
}

async function markEmailVerified(email: string) {
	// Batched into one round-trip instead of two sequential awaits — this was
	// a meaningful chunk of the delay before the verification result showed.
	await db.$transaction([
		db.user.update({ where: { email }, data: { emailVerified: true } }),
		db.verification.deleteMany({
			where: {
				OR: [
					{ identifier: `${TOKEN_IDENTIFIER_PREFIX}${email}` },
					{ identifier: `${OTP_IDENTIFIER_PREFIX}${email}` },
				],
			},
		}),
	]);
}
