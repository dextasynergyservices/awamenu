import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signToken, verifyToken } from "@/lib/signed-token";

const COOKIE_NAME = "staff-session";

interface StaffSessionPayload {
	staffMemberId: string;
	restaurantId: string;
	slug: string;
	exp: number;
}

// Signed with a key of its own (see lib/signed-token.ts) and checked in
// constant time. This used to sign with BETTER_AUTH_SECRET directly and
// compare signatures with `!==`.
const PURPOSE = "staff-session";

function sign(payload: StaffSessionPayload): string {
	return signToken(PURPOSE, payload);
}

function verify(token: string): StaffSessionPayload | null {
	return verifyToken<StaffSessionPayload>(PURPOSE, token);
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
		redirect(`/${slug}/staff/login`);
	}
	return session;
}
