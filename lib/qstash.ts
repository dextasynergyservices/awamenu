import { Client, Receiver } from "@upstash/qstash";
import { env } from "@/env";

type ReservationExpiryPayload = {
	type: "EXPIRE_RESERVATION";
	reservationId: string;
};

function getQstashClient() {
	if (!env.QSTASH_TOKEN) return null;

	return new Client({ token: env.QSTASH_TOKEN });
}

export async function scheduleReservationExpiry(input: {
	reservationId: string;
	expiresAt: Date;
}) {
	const client = getQstashClient();

	if (!client) return null;

	const delay = Math.max(
		0,
		Math.ceil((input.expiresAt.getTime() - Date.now()) / 1000),
	);
	const payload: ReservationExpiryPayload = {
		type: "EXPIRE_RESERVATION",
		reservationId: input.reservationId,
	};

	try {
		const response = await client.publishJSON({
			url: `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/qstash`,
			body: payload,
			delay,
			retries: 3,
		});

		return "messageId" in response ? response.messageId : null;
	} catch (error) {
		console.error("Failed to schedule reservation expiry", error);
		return null;
	}
}

export async function cancelReservationExpiry(messageId?: string | null) {
	const client = getQstashClient();

	if (!client || !messageId) return;

	try {
		await client.messages.cancel(messageId);
	} catch (error) {
		console.error("Failed to cancel reservation expiry", error);
	}
}

export async function verifyQstashSignature(input: {
	signature: string | null;
	body: string;
	url?: string;
}) {
	if (!env.QSTASH_CURRENT_SIGNING_KEY || !env.QSTASH_NEXT_SIGNING_KEY) {
		return true;
	}

	if (!input.signature) return false;

	const receiver = new Receiver({
		currentSigningKey: env.QSTASH_CURRENT_SIGNING_KEY,
		nextSigningKey: env.QSTASH_NEXT_SIGNING_KEY,
	});

	try {
		return await receiver.verify({
			signature: input.signature,
			body: input.body,
			url: input.url,
		});
	} catch {
		return false;
	}
}
