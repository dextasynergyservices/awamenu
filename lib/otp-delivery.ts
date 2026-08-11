import { env } from "@/env";

/**
 * Sends a login code over WhatsApp or SMS through Twilio.
 *
 * Uses Twilio's REST API directly rather than the SDK — one authenticated POST,
 * against a Node SDK that would otherwise be pulled into every bundle that
 * touches this module.
 *
 * Returns a reason string when it can't send, rather than throwing: the caller
 * turns that into something the customer can act on ("try email instead"),
 * which is far better than a code that silently goes nowhere. That silent
 * failure is exactly what this replaces.
 */

export type OtpChannel = "whatsapp" | "sms" | "email";

/** Which non-email channels this deployment can actually deliver on. */
export function availableOtpChannels(): OtpChannel[] {
	const channels: OtpChannel[] = ["email"];
	const hasCredentials =
		env.TWILIO_ACCOUNT_SID &&
		(env.TWILIO_AUTH_TOKEN ||
			(env.TWILIO_API_KEY_SID && env.TWILIO_API_KEY_SECRET));
	if (!hasCredentials) return channels;
	if (env.TWILIO_WHATSAPP_FROM) channels.push("whatsapp");
	if (env.TWILIO_SMS_FROM) channels.push("sms");
	return channels;
}

/**
 * Nigerian numbers are typed as 0803…, but Twilio requires E.164.
 *
 * Only the local-zero and bare-country-code forms are converted; anything
 * already in `+…` form is passed through untouched so other countries work.
 */
export function toE164(raw: string, defaultCountryCode = "234") {
	const trimmed = raw.trim().replace(/[\s()-]/g, "");
	if (trimmed.startsWith("+")) return trimmed;
	if (trimmed.startsWith("0"))
		return `+${defaultCountryCode}${trimmed.slice(1)}`;
	if (trimmed.startsWith(defaultCountryCode)) return `+${trimmed}`;
	return `+${defaultCountryCode}${trimmed}`;
}

export async function sendOtpOverTwilio(input: {
	to: string;
	channel: "whatsapp" | "sms";
	code: string;
	restaurantName: string;
}): Promise<{ ok: true } | { error: string }> {
	const sent = await sendTwilioMessage({
		to: input.to,
		channel: input.channel,
		body: `${input.code} is your ${input.restaurantName} verification code. It expires in 10 minutes.`,
	});

	// The transport speaks in infrastructure terms; a customer needs to be told
	// what to do instead.
	if ("error" in sent) {
		return {
			error: `${input.channel === "whatsapp" ? "WhatsApp" : "SMS"} sign-in isn't available right now — please use your email address.`,
		};
	}
	return sent;
}

/**
 * Sends one message on the platform's Twilio sender.
 *
 * The single place credentials, E.164 conversion and the `whatsapp:` prefix
 * are handled, so order updates and login codes cannot drift apart.
 */
/** Whether a channel can actually be delivered on right now. */
export function canDeliverOn(channel: "whatsapp" | "sms") {
	return availableOtpChannels().includes(channel);
}

export async function sendTwilioMessage(input: {
	to: string;
	channel: "whatsapp" | "sms";
	body: string;
}): Promise<{ ok: true } | { error: string }> {
	const accountSid = env.TWILIO_ACCOUNT_SID;

	// Twilio accepts either the account's master Auth Token or an API Key pair
	// as the Basic-auth credentials. The API key is preferred and wins when
	// both are set: it can be revoked on its own, whereas leaking the Auth
	// Token means rotating every credential on the account. Either way the URL
	// still carries the Account SID — the key identifies *who is calling*, not
	// which account is billed.
	const apiKeySid = env.TWILIO_API_KEY_SID;
	const apiKeySecret = env.TWILIO_API_KEY_SECRET;
	const useApiKey = Boolean(apiKeySid && apiKeySecret);
	const authUser = useApiKey ? (apiKeySid as string) : accountSid;
	const authPass = useApiKey ? (apiKeySecret as string) : env.TWILIO_AUTH_TOKEN;
	const from =
		input.channel === "whatsapp"
			? env.TWILIO_WHATSAPP_FROM
			: env.TWILIO_SMS_FROM;

	if (!accountSid || !authUser || !authPass || !from) {
		return {
			error: `${input.channel === "whatsapp" ? "WhatsApp" : "SMS"} messaging isn't configured on this deployment.`,
		};
	}

	const to = toE164(input.to);
	const body = input.body;

	const params = new URLSearchParams({
		To: input.channel === "whatsapp" ? `whatsapp:${to}` : to,
		From:
			input.channel === "whatsapp" && !from.startsWith("whatsapp:")
				? `whatsapp:${from}`
				: from,
		Body: body,
	});

	try {
		const response = await fetch(
			`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
			{
				method: "POST",
				headers: {
					Authorization: `Basic ${Buffer.from(`${authUser}:${authPass}`).toString("base64")}`,
					"Content-Type": "application/x-www-form-urlencoded",
				},
				body: params,
			},
		);

		if (!response.ok) {
			// Twilio's own message is more useful than a generic failure — a
			// number outside the WhatsApp sandbox, or an unverified sender, both
			// say so plainly.
			const payload = (await response.json().catch(() => null)) as {
				message?: string;
			} | null;
			return {
				error:
					payload?.message ??
					"We couldn't send your code. Please try email instead.",
			};
		}

		return { ok: true };
	} catch {
		return { error: "We couldn't send your code. Please try email instead." };
	}
}
