import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Small signed tokens for our own cookies (staff and customer sessions).
 *
 * Each purpose gets its own key, derived from BETTER_AUTH_SECRET with a label,
 * so a token minted for one purpose can never be replayed as another, and the
 * better-auth secret itself never signs anything directly. Signatures are
 * compared in constant time.
 */

function keyFor(purpose: string): Buffer {
	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret) throw new Error("BETTER_AUTH_SECRET is required");
	return createHmac("sha256", secret).update(`awamenu:${purpose}:v1`).digest();
}

function signature(purpose: string, encoded: string) {
	return createHmac("sha256", keyFor(purpose)).update(encoded).digest();
}

export function signToken<T extends { exp: number }>(
	purpose: string,
	payload: T,
): string {
	const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
	return `${encoded}.${signature(purpose, encoded).toString("base64url")}`;
}

export function verifyToken<T extends { exp: number }>(
	purpose: string,
	token: string | undefined,
): T | null {
	if (!token) return null;
	const [encoded, sig] = token.split(".");
	if (!encoded || !sig) return null;

	const expected = signature(purpose, encoded);
	const given = Buffer.from(sig, "base64url");
	if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
		return null;
	}

	try {
		const data = JSON.parse(Buffer.from(encoded, "base64url").toString()) as T;
		if (typeof data.exp !== "number" || Date.now() > data.exp) return null;
		return data;
	} catch {
		return null;
	}
}

/** Keyed hash for short secrets we must check but never store (OTP codes). */
export function keyedHash(purpose: string, value: string): string {
	return createHmac("sha256", keyFor(purpose)).update(value).digest("hex");
}

export function hashesMatch(a: string, b: string): boolean {
	const left = Buffer.from(a, "hex");
	const right = Buffer.from(b, "hex");
	return left.length === right.length && timingSafeEqual(left, right);
}
