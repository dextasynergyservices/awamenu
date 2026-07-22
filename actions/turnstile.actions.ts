"use server";

import { verifyTurnstileToken } from "@/lib/turnstile";

/**
 * Used by client flows that call better-auth's client SDK directly (e.g.
 * signup) rather than a custom server action — verify the token first and
 * only proceed with the real request if it passes.
 */
export async function verifyTurnstileAction(
	token: string,
): Promise<{ success: boolean }> {
	const success = await verifyTurnstileToken(token);
	return { success };
}
