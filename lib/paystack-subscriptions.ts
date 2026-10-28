import { requireEnv } from "@/env";

/**
 * Stops Paystack from charging a subscription again. Paystack needs the
 * subscription's email token to disable it, so it's fetched first.
 *
 * Returns an error message rather than throwing, so callers can show it.
 */
export async function disablePaystackSubscription(
	code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
	const headers = {
		Authorization: `Bearer ${requireEnv("PAYSTACK_SECRET_KEY")}`,
		"Content-Type": "application/json",
	};

	const fetched = await fetch(
		`https://api.paystack.co/subscription/${encodeURIComponent(code)}`,
		{ headers },
	);
	if (!fetched.ok) {
		return {
			ok: false,
			error: "Couldn't reach Paystack for this subscription.",
		};
	}
	const data = (await fetched.json()) as {
		data?: { email_token?: string; status?: string };
	};
	// Already off on Paystack's side: nothing to do.
	if (data.data?.status === "cancelled" || data.data?.status === "complete") {
		return { ok: true };
	}
	const token = data.data?.email_token;
	if (!token) {
		return {
			ok: false,
			error: "Paystack didn't return the subscription token.",
		};
	}

	const disabled = await fetch("https://api.paystack.co/subscription/disable", {
		method: "POST",
		headers,
		body: JSON.stringify({ code, token }),
	});
	if (!disabled.ok) {
		return { ok: false, error: "Paystack refused to cancel the subscription." };
	}
	return { ok: true };
}
