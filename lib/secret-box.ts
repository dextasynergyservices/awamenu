import {
	createCipheriv,
	createDecipheriv,
	createHash,
	randomBytes,
	timingSafeEqual,
} from "node:crypto";
import { env } from "@/env";

/**
 * Reversible encryption for secrets that have to be *shown* again.
 *
 * Passwords are normally hashed, which is one-way and therefore impossible to
 * display. The staff dashboard password is different: it's a single shared
 * operational credential the owner reads out or copies to their staff, much
 * like a Wi-Fi password. It has to be recoverable, so it's encrypted rather
 * than hashed — and revealing it is gated behind re-entering the owner's own
 * account password.
 *
 * AES-256-GCM: authenticated, so tampering with the stored value is detected
 * rather than silently decrypting to garbage. A random IV per encryption means
 * the same password never produces the same ciphertext twice.
 */

const VERSION = "v1";
const IV_BYTES = 12;

/** Derived from the app secret so there's no extra key to provision. */
function key() {
	return createHash("sha256")
		.update(`staff-secret:${env.BETTER_AUTH_SECRET}`)
		.digest();
}

export function encryptSecret(plaintext: string): string {
	const iv = randomBytes(IV_BYTES);
	const cipher = createCipheriv("aes-256-gcm", key(), iv);
	const ciphertext = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const tag = cipher.getAuthTag();

	return [
		VERSION,
		iv.toString("base64url"),
		tag.toString("base64url"),
		ciphertext.toString("base64url"),
	].join(".");
}

/**
 * Returns null rather than throwing for anything that isn't a well-formed
 * value this module produced — notably the scrypt hashes written before this
 * existed, which can never be decrypted. Callers use null to mean "there's a
 * password set, but it can't be shown; ask the owner to set a new one."
 */
export function decryptSecret(stored: string): string | null {
	const parts = stored.split(".");
	if (parts.length !== 4 || parts[0] !== VERSION) return null;

	try {
		const [, ivPart, tagPart, dataPart] = parts;
		const decipher = createDecipheriv(
			"aes-256-gcm",
			key(),
			Buffer.from(ivPart, "base64url"),
		);
		decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
		return Buffer.concat([
			decipher.update(Buffer.from(dataPart, "base64url")),
			decipher.final(),
		]).toString("utf8");
	} catch {
		return null;
	}
}

export function isEncryptedSecret(stored: string): boolean {
	return stored.startsWith(`${VERSION}.`) && stored.split(".").length === 4;
}

/** Constant-time string comparison for verifying a submitted password. */
export function secretsMatch(a: string, b: string): boolean {
	const aBuf = Buffer.from(a);
	const bBuf = Buffer.from(b);
	if (aBuf.length !== bBuf.length) return false;
	return timingSafeEqual(aBuf, bBuf);
}
