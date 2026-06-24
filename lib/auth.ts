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
	plugins: [nextCookies()],
});

export async function getSession() {
	return auth.api.getSession({
		headers: await headers(),
	});
}
