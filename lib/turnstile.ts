import { env } from "@/env";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verifies a Cloudflare Turnstile token server-side. Returns `true`
 * automatically when `TURNSTILE_SECRET_KEY` isn't configured — dev-safe
 * no-op, matching the rest of the app's defensive pattern for optional
 * third-party integrations (Redis, Sentry, etc).
 */
export async function verifyTurnstileToken(
	token: string | null | undefined,
	remoteIp?: string,
): Promise<boolean> {
	const secretKey = env.TURNSTILE_SECRET_KEY;
	if (!secretKey) return true;
	if (!token) return false;

	try {
		const body = new URLSearchParams({ secret: secretKey, response: token });
		if (remoteIp) body.set("remoteip", remoteIp);

		const res = await fetch(VERIFY_URL, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body,
		});
		const data = (await res.json()) as { success: boolean };
		return data.success;
	} catch {
		return false;
	}
}
