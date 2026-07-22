import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	server: {
		BETTER_AUTH_SECRET: z.string().min(1),
		BETTER_AUTH_URL: z.string().url(),
		DATABASE_URL: z.string().min(1),
		DIRECT_DATABASE_URL: z.string().min(1).optional(),
		PAYSTACK_SECRET_KEY: z.string().min(1).optional(),
		PAYSTACK_WEBHOOK_SECRET: z.string().min(1).optional(),
		CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
		CLOUDINARY_API_KEY: z.string().min(1).optional(),
		CLOUDINARY_API_SECRET: z.string().min(1).optional(),
		RESEND_API_KEY: z.string().min(1).optional(),
		RESEND_FROM_EMAIL: z.string().email().optional(),
		QSTASH_TOKEN: z.string().min(1).optional(),
		QSTASH_CURRENT_SIGNING_KEY: z.string().min(1).optional(),
		QSTASH_NEXT_SIGNING_KEY: z.string().min(1).optional(),
		UPSTASH_REDIS_REST_URL: z.string().url().optional(),
		UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
		VAPID_PRIVATE_KEY: z.string().min(1).optional(),
		VAPID_EMAIL: z.string().email().optional(),
		TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
		POSTHOG_PROJECT_API_KEY: z.string().min(1).optional(),
	},
	client: {
		NEXT_PUBLIC_APP_URL: z.string().url(),
		NEXT_PUBLIC_CLOUDINARY_DELIVERY_URL: z.string().url().optional(),
		NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
		NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
		NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
		NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
		NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
	},
	runtimeEnv: {
		BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
		DATABASE_URL: process.env.DATABASE_URL,
		DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL,
		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
		NEXT_PUBLIC_CLOUDINARY_DELIVERY_URL:
			process.env.NEXT_PUBLIC_CLOUDINARY_DELIVERY_URL,
		PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
		PAYSTACK_WEBHOOK_SECRET: process.env.PAYSTACK_WEBHOOK_SECRET,
		CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
		CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
		CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
		RESEND_API_KEY: process.env.RESEND_API_KEY,
		RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
		QSTASH_TOKEN: process.env.QSTASH_TOKEN,
		QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
		QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
		UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
		UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
		VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
		VAPID_EMAIL: process.env.VAPID_EMAIL,
		TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
		POSTHOG_PROJECT_API_KEY: process.env.POSTHOG_PROJECT_API_KEY,
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
