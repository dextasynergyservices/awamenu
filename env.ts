import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * The app's public URL when NEXT_PUBLIC_APP_URL isn't set.
 *
 * Payment return links, email links and webhooks are built from this, so in
 * production it must be the real domain:
 * 1. A production deployment uses Vercel's stable production domain
 *    (VERCEL_PROJECT_PRODUCTION_URL) — not VERCEL_URL, which is that one
 *    deployment's own address and would send customers back from Paystack to
 *    an old or protected build.
 * 2. A preview deployment uses its own URL, so previews link to themselves.
 * 3. Local development falls back to http://localhost:3000. Never in
 *    production — there, an unset URL stays unset rather than producing
 *    links to localhost.
 */
function fallbackAppUrl(): string | undefined {
	if (
		process.env.VERCEL_ENV === "production" &&
		process.env.VERCEL_PROJECT_PRODUCTION_URL
	) {
		return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
	}
	if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
	if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
	return undefined;
}

export const env = createEnv({
	server: {
		BETTER_AUTH_SECRET: z.string().min(1),
		BETTER_AUTH_URL: z.string().url().optional(),
		DATABASE_URL: z.string().min(1),
		DIRECT_DATABASE_URL: z.string().min(1).optional(),
		PAYSTACK_SECRET_KEY: z.string().min(1).optional(),
		PAYSTACK_WEBHOOK_SECRET: z.string().min(1).optional(),
		CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
		CLOUDINARY_API_KEY: z.string().min(1).optional(),
		CLOUDINARY_API_SECRET: z.string().min(1).optional(),
		RESEND_API_KEY: z.string().min(1).optional(),
		// Order-related emails only (order confirmations).
		RESEND_FROM_EMAIL: z.string().email().optional(),
		// Everything else: signup/verification, welcome, billing, subscriptions.
		RESEND_ACCOUNTS_FROM_EMAIL: z.string().email().optional(),
		QSTASH_TOKEN: z.string().min(1).optional(),
		QSTASH_CURRENT_SIGNING_KEY: z.string().min(1).optional(),
		QSTASH_NEXT_SIGNING_KEY: z.string().min(1).optional(),
		// Shared secret for triggering cron routes from any external scheduler
		// (cron-jobs.org, Vercel Cron, GitHub Actions...). QStash-signed
		// requests are still accepted; this is the alternative for schedulers
		// that can't produce a QStash signature.
		CRON_SECRET: z.string().min(16).optional(),
		// Monnify. Sandbox and live are separate environments with separate
		// credentials AND separate base URLs, so the host is configurable rather
		// than hardcoded — pointing sandbox keys at the live host just 401s.
		MONNIFY_BASE_URL: z.string().url().optional(),
		MONNIFY_API_KEY: z.string().min(1).optional(),
		MONNIFY_SECRET_KEY: z.string().min(1).optional(),
		MONNIFY_CONTRACT_CODE: z.string().min(1).optional(),
		// Twilio delivers the customer login code over WhatsApp or SMS. Absent
		// credentials simply remove those options rather than breaking sign-in.
		TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
		TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
		// Preferred over the master Auth Token: revocable on its own.
		TWILIO_API_KEY_SID: z.string().min(1).optional(),
		TWILIO_API_KEY_SECRET: z.string().min(1).optional(),
		TWILIO_WHATSAPP_FROM: z.string().min(1).optional(),
		TWILIO_SMS_FROM: z.string().min(1).optional(),
		// JSON of approved WhatsApp template Content SIDs, keyed by message — see
		// lib/whatsapp-templates.ts and docs/whatsapp-templates.md.
		TWILIO_WHATSAPP_TEMPLATES: z.string().min(2).optional(),
		// "true" only for Twilio's WhatsApp sandbox, which accepts free text.
		TWILIO_WHATSAPP_ALLOW_FREEFORM: z.enum(["true", "false"]).optional(),
		UPSTASH_REDIS_REST_URL: z.string().url().optional(),
		UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
		VAPID_PRIVATE_KEY: z.string().min(1).optional(),
		VAPID_EMAIL: z.string().email().optional(),
		TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
		POSTHOG_PROJECT_API_KEY: z.string().min(1).optional(),
		// Reading analytics back (Super Admin → Analytics → Traffic): a personal
		// API key with read access, and the project id.
		POSTHOG_PERSONAL_API_KEY: z.string().min(1).optional(),
		POSTHOG_PROJECT_ID: z.string().min(1).optional(),
		// The app host for queries, e.g. https://us.posthog.com or https://eu.posthog.com.
		POSTHOG_API_HOST: z.string().url().optional(),
	},
	client: {
		NEXT_PUBLIC_APP_URL: z.string().url().optional(),
		NEXT_PUBLIC_CLOUDINARY_DELIVERY_URL: z.string().url().optional(),
		NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
		NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
		NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
		NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
		NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
	},
	runtimeEnv: {
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? fallbackAppUrl(),
		DATABASE_URL: process.env.DATABASE_URL,
		DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL,
		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? fallbackAppUrl(),
		NEXT_PUBLIC_CLOUDINARY_DELIVERY_URL:
			process.env.NEXT_PUBLIC_CLOUDINARY_DELIVERY_URL,
		PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
		PAYSTACK_WEBHOOK_SECRET: process.env.PAYSTACK_WEBHOOK_SECRET,
		CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
		CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
		CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
		RESEND_API_KEY: process.env.RESEND_API_KEY,
		RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
		RESEND_ACCOUNTS_FROM_EMAIL: process.env.RESEND_ACCOUNTS_FROM_EMAIL,
		QSTASH_TOKEN: process.env.QSTASH_TOKEN,
		QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
		QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
		CRON_SECRET: process.env.CRON_SECRET,
		MONNIFY_BASE_URL: process.env.MONNIFY_BASE_URL,
		MONNIFY_API_KEY: process.env.MONNIFY_API_KEY,
		MONNIFY_SECRET_KEY: process.env.MONNIFY_SECRET_KEY,
		MONNIFY_CONTRACT_CODE: process.env.MONNIFY_CONTRACT_CODE,
		TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
		TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
		TWILIO_API_KEY_SID: process.env.TWILIO_API_KEY_SID,
		TWILIO_API_KEY_SECRET: process.env.TWILIO_API_KEY_SECRET,
		TWILIO_WHATSAPP_FROM: process.env.TWILIO_WHATSAPP_FROM,
		TWILIO_SMS_FROM: process.env.TWILIO_SMS_FROM,
		TWILIO_WHATSAPP_TEMPLATES: process.env.TWILIO_WHATSAPP_TEMPLATES,
		TWILIO_WHATSAPP_ALLOW_FREEFORM: process.env.TWILIO_WHATSAPP_ALLOW_FREEFORM,
		UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
		UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
		VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
		VAPID_EMAIL: process.env.VAPID_EMAIL,
		TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
		POSTHOG_PROJECT_API_KEY: process.env.POSTHOG_PROJECT_API_KEY,
		POSTHOG_PERSONAL_API_KEY: process.env.POSTHOG_PERSONAL_API_KEY,
		POSTHOG_PROJECT_ID: process.env.POSTHOG_PROJECT_ID,
		POSTHOG_API_HOST: process.env.POSTHOG_API_HOST,
		NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
		NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
		NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
		NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
		NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
	},
	skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});

export function requireEnv(name: keyof typeof env) {
	const value = env[name];

	if (!value) {
		throw new Error(`${name} is required`);
	}

	return value;
}
