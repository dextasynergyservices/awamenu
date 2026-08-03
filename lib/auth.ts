import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { env } from "@/env";
import { db } from "@/lib/db";

export const auth = betterAuth({
	baseURL: env.BETTER_AUTH_URL,
	secret: env.BETTER_AUTH_SECRET,
	database: prismaAdapter(db, {
		provider: "postgresql",
	}),
	account: {
		fields: {
			providerId: "provider",
		},
	},
	emailAndPassword: {
		enabled: true,
		autoSignIn: true,
	},
	// Default rate limiting is enabled automatically in production, but with
	// in-memory storage — on Vercel's serverless runtime that counter resets
	// on effectively every cold start, making it close to a no-op. Backing it
	// with the database instead makes it durable across invocations. Stricter
	// per-path rules on the credential-guessing endpoints specifically, since
	// the global default (100 req/10s) is far too loose to deter brute force.
	rateLimit: {
		storage: "database",
		customRules: {
			"/sign-in/email": { window: 60, max: 5 },
			"/sign-up/email": { window: 60, max: 5 },
			"/request-password-reset": { window: 60, max: 3 },
			"/reset-password": { window: 60, max: 5 },
		},
	},
	plugins: [nextCookies()],
});

export async function getSession() {
	return auth.api.getSession({
		headers: await headers(),
	});
}
