import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "staff-session";

interface StaffSessionPayload {
	staffMemberId: string;
	restaurantId: string;
	slug: string;
	exp: number;
}

function getSecret(): string {
	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret)
		throw new Error("BETTER_AUTH_SECRET is required for staff sessions");
	return secret;
}

function sign(payload: StaffSessionPayload): string {
	const data = JSON.stringify(payload);
	const encoded = Buffer.from(data).toString("base64url");
	const sig = createHmac("sha256", getSecret())
		.update(encoded)
		.digest("base64url");
	return `${encoded}.${sig}`;
}

function verify(token: string): StaffSessionPayload | null {
	const [encoded, sig] = token.split(".");
	if (!encoded || !sig) return null;

	const expectedSig = createHmac("sha256", getSecret())
		.update(encoded)
		.digest("base64url");

	if (sig !== expectedSig) return null;

	try {
		const data = JSON.parse(Buffer.from(encoded, "base64url").toString());
		if (data.exp && Date.now() > data.exp) return null;
		return data as StaffSessionPayload;
	} catch {
		return null;
	}
}

/**
 * Create a staff session by setting a signed HTTP-only cookie.
 */
export async function createStaffSession(
	staffMemberId: string,
	restaurantId: string,
	slug: string,
	autoLockHours: number = 24,
): Promise<void> {
	const ttlSeconds = autoLockHours * 60 * 60;

	const payload: StaffSessionPayload = {
		staffMemberId,
		restaurantId,
		slug,
		exp: Date.now() + ttlSeconds * 1000,
	};

	const token = sign(payload);
	const cookieStore = await cookies();

	cookieStore.set(COOKIE_NAME, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: ttlSeconds,
	});
}

/**
 * Read and validate the staff session cookie.
 * Returns the session payload or null if invalid/expired.
 */
export async function getStaffSession(): Promise<StaffSessionPayload | null> {
	const cookieStore = await cookies();
	const token = cookieStore.get(COOKIE_NAME)?.value;
	if (!token) return null;
	return verify(token);
}

/**
 * Clear the staff session cookie.
 */
export async function destroyStaffSession(): Promise<void> {
	const cookieStore = await cookies();
	cookieStore.delete(COOKIE_NAME);
}

/**
 * Require a valid staff session. Redirects to login if not authenticated.
 * Used in staff layout guards.
 */
export async function requireStaffSession(
	slug: string,
): Promise<StaffSessionPayload> {
	const session = await getStaffSession();
	if (!session || session.slug !== slug) {
		redirect(`/staff/${slug}/login`);
	}
	return session;
}
