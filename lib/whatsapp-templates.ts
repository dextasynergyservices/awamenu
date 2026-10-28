import { env } from "@/env";

/**
 * Meta-approved WhatsApp templates, by message.
 *
 * WhatsApp only accepts free-form text inside the 24 hours after the customer
 * last messaged you. AwaMenu always messages first — order updates, sign-in
 * codes — so every WhatsApp send must use an approved template, or Twilio
 * rejects it (error 63016). The template wording to submit is in
 * docs/whatsapp-templates.md; once Meta approves each one, its Content SID
 * ("HX…") goes into TWILIO_WHATSAPP_TEMPLATES as JSON:
 *
 *   {"verification_code":"HX…","order_confirmed":"HX…", …}
 *
 * A message with no approved template is not sent on WhatsApp at all — never
 * silently switched to SMS, which would be an unexpected bill. For Twilio's
 * sandbox (which accepts free text), set TWILIO_WHATSAPP_ALLOW_FREEFORM=true.
 */

export const WHATSAPP_TEMPLATE_KEYS = [
	"verification_code",
	"order_confirmed",
	"order_on_the_way",
	"order_ready_pickup",
	"order_ready_table",
	"reservation_table_ready",
	"order_delivered",
	"order_completed",
	"reservation_completed",
	"reservation_cancelled",
] as const;

export type WhatsAppTemplateKey = (typeof WHATSAPP_TEMPLATE_KEYS)[number];

export type WhatsAppTemplate = {
	key: WhatsAppTemplateKey;
	/** Numbered placeholders, as the approved template defines them. */
	variables: Record<string, string>;
};

let parsed: Partial<Record<WhatsAppTemplateKey, string>> | null = null;

function templateSids(): Partial<Record<WhatsAppTemplateKey, string>> {
	if (parsed) return parsed;
	parsed = {};
	const raw = env.TWILIO_WHATSAPP_TEMPLATES;
	if (!raw) return parsed;
	try {
		const json = JSON.parse(raw) as Record<string, unknown>;
		for (const key of WHATSAPP_TEMPLATE_KEYS) {
			const sid = json[key];
			// Twilio Content SIDs start with "HX"; anything else is a typo that
			// would fail on every send.
			if (typeof sid === "string" && /^HX[0-9a-f]{32}$/i.test(sid)) {
				parsed[key] = sid;
			}
		}
	} catch {
		console.error("[whatsapp] TWILIO_WHATSAPP_TEMPLATES is not valid JSON");
	}
	return parsed;
}

export function whatsappTemplateSid(key: WhatsAppTemplateKey): string | null {
	return templateSids()[key] ?? null;
}

/** Free text is only for Twilio's sandbox; production must use templates. */
export function allowFreeformWhatsApp(): boolean {
	return env.TWILIO_WHATSAPP_ALLOW_FREEFORM === "true";
}

/** Whether this WhatsApp message can actually be delivered. */
export function canSendWhatsApp(key: WhatsAppTemplateKey): boolean {
	return Boolean(whatsappTemplateSid(key)) || allowFreeformWhatsApp();
}
