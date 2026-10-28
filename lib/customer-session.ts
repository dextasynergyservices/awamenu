import { cookies } from "next/headers";
import { signToken, verifyToken } from "@/lib/signed-token";

/**
 * Who a customer has proven they are, by passing an OTP.
 *
 * Customers have no accounts; identity is a phone number or email they have
 * shown they control. Before this cookie existed, the customer actions took
 * that identifier as a plain argument — so anyone could pass someone else's
 * number and read their orders and home address, or rewrite their profile.
 * Now the identifier comes only from this signed, httpOnly cookie, set when an
 * OTP is verified.
 */

const COOKIE_NAME = "awamenu-customer";
const PURPOSE = "customer-session";
const TTL_SECONDS = 30 * 24 * 60 * 60;

export type CustomerSession = {
	identityType: "phone" | "email";
	identifier: string;
	exp: number;
};

export async function createCustomerSession(
	identityType: CustomerSession["identityType"],
	identifier: string,
) {
	const token = signToken<CustomerSession>(PURPOSE, {
		identityType,
		identifier,
		exp: Date.now() + TTL_SECONDS * 1000,
	});
	const store = await cookies();
	store.set(COOKIE_NAME, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: TTL_SECONDS,
	});
}

export async function getCustomerSession(): Promise<CustomerSession | null> {
	const store = await cookies();
	return verifyToken<CustomerSession>(PURPOSE, store.get(COOKIE_NAME)?.value);
}

export async function destroyCustomerSession() {
	const store = await cookies();
	store.delete(COOKIE_NAME);
}
