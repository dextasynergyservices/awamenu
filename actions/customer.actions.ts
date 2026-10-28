"use server";

import { randomInt } from "node:crypto";
import { z } from "zod";
import { ActionError, actionData } from "@/lib/action-error";
import {
	createCustomerSession,
	destroyCustomerSession,
	getCustomerSession,
} from "@/lib/customer-session";
import { db } from "@/lib/db";
import { sendCustomerOtpEmail } from "@/lib/email";
import { availableOtpChannels, sendOtpOverTwilio } from "@/lib/otp-delivery";
import { enforceRateLimit, getClientIp } from "@/lib/ratelimit";
import { hashesMatch, keyedHash } from "@/lib/signed-token";

const identityTypeSchema = z.enum(["phone", "email"]);
const otpChannelSchema = z.enum(["whatsapp", "sms", "email"]);

const requestOtpSchema = z.object({
	restaurantSlug: z.string().min(1),
	identityType: identityTypeSchema,
	identifier: z.string().trim().min(3).max(120),
	channel: otpChannelSchema,
});

const verifyOtpSchema = z.object({
	restaurantSlug: z.string().min(1),
	identityType: identityTypeSchema,
	identifier: z.string().trim().min(3).max(120),
	code: z.string().trim().length(6),
});

const profileSchema = z.object({
	identifier: z.string().trim().min(3).max(120),
	fullName: z.string().trim().max(100).optional(),
	whatsappNumber: z.string().trim().max(40).optional(),
	alternativePhone: z.string().trim().max(40).optional(),
	email: z.string().trim().email().optional().or(z.literal("")),
	deliveryAddress: z.string().trim().max(240).optional(),
});

function normalizeIdentifier(
	identityType: "phone" | "email",
	identifier: string,
) {
	if (identityType === "email") return identifier.trim().toLowerCase();
	return identifier.replace(/\s+/g, "").trim();
}

function normalizeOptional(value: string | undefined) {
	return value?.trim() ? value.trim() : null;
}

function serializeOrder(order: {
	id: string;
	customerName: string;
	customerPhone: string;
	customerEmail: string | null;
	type: string;
	status: string;
	statusNote: string | null;
	cancellationNote: string | null;
	paymentStatus: string;
	total: unknown;
	createdAt: Date;
	restaurant: {
		name: string;
		slug: string;
		currency: string;
		phone: string | null;
		address: string | null;
	};
	items: Array<{
		id: string;
		name: string;
		qty: number;
		unitPrice: unknown;
		notes: string | null;
	}>;
}) {
	return {
		...order,
		total: String(order.total),
		createdAt: order.createdAt.toISOString(),
		items: order.items.map((item) => ({
			...item,
			unitPrice: String(item.unitPrice),
		})),
	};
}

async function findCustomerProfile(identifier: string) {
	return db.customerProfile.findFirst({
		where: {
			OR: [{ whatsappNumber: identifier }, { email: identifier }],
		},
	});
}

async function ensureCustomerProfile(
	identityType: "phone" | "email",
	identifier: string,
) {
	const existingProfile = await findCustomerProfile(identifier);
	if (existingProfile) return existingProfile;

	return db.customerProfile.create({
		data:
			identityType === "email"
				? { email: identifier }
				: { whatsappNumber: identifier },
	});
}

/** Codes live ten minutes and allow five wrong guesses before they burn. */
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
/** Also enforced from the database, so the cap holds even without Redis. */
const OTP_MAX_SENDS_PER_15_MIN = 3;

const SIGNED_OUT = "Please sign in again to see your account.";

/** Bound to the identifier, so a code issued for one number can't be used
 *  for another even if stored hashes were ever swapped. */
function hashOtp(identifier: string, code: string) {
	return keyedHash("customer-otp", `${identifier}:${code}`);
}

export async function requestCustomerOtpAction(input: unknown) {
	return actionData(async () => {
		const parsed = requestOtpSchema.parse(input);
		const identifier = normalizeIdentifier(
			parsed.identityType,
			parsed.identifier,
		);

		// Every send costs money (WhatsApp/SMS via Twilio) and can be aimed at a
		// stranger's phone, so it is capped per recipient and per sender.
		const clientIp = await getClientIp();
		await enforceRateLimit("otpSendIp", clientIp);
		await enforceRateLimit("otpSendIdentifier", identifier);
		const recentSends = await db.customerOtp.count({
			where: {
				identifier,
				createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) },
			},
		});
		if (recentSends >= OTP_MAX_SENDS_PER_15_MIN) {
			throw new ActionError(
				"We've sent several codes already. Please wait a few minutes before asking for another.",
			);
		}

		const restaurant = await db.restaurant.findFirstOrThrow({
			where: { slug: parsed.restaurantSlug, isActive: true },
			select: { id: true, name: true },
		});

		// A channel is only offered if this deployment can actually deliver on
		// it. The original bug was the opposite of a missing check: every channel
		// returned success and only email was ever sent, so a customer choosing
		// WhatsApp waited for a code that went nowhere.
		if (!availableOtpChannels().includes(parsed.channel)) {
			throw new ActionError(
				parsed.channel === "whatsapp"
					? "WhatsApp sign-in isn't available right now — please use your email address."
					: "SMS sign-in isn't available right now — please use your email address.",
			);
		}

		// `crypto.randomInt` rather than `Math.random`, which is not a
		// cryptographically secure source and makes codes predictable.
		const code = String(randomInt(100000, 1000000));

		// Only the newest code works: older unused ones are retired, so a guesser
		// can't spread attempts across several live codes.
		await db.customerOtp.updateMany({
			where: { identifier, consumedAt: null },
			data: { consumedAt: new Date() },
		});
		await db.customerOtp.create({
			data: {
				identifier,
				channel: parsed.channel,
				code: hashOtp(identifier, code),
				expiresAt: new Date(Date.now() + OTP_TTL_MS),
			},
		});

		if (parsed.channel === "email") {
			await sendCustomerOtpEmail({
				to: identifier,
				code,
				restaurantId: restaurant.id,
			});
		} else {
			const sent = await sendOtpOverTwilio({
				to: identifier,
				channel: parsed.channel,
				code,
				restaurantName: restaurant.name,
			});
			// Surfaced rather than swallowed: the customer needs to know to try
			// another channel instead of staring at a code-entry box.
			if ("error" in sent) throw new ActionError(sent.error);
		}

		return { ok: true };
	});
}

export async function verifyCustomerOtpAction(input: unknown) {
	return actionData(async () => {
		const parsed = verifyOtpSchema.parse(input);
		const identifier = normalizeIdentifier(
			parsed.identityType,
			parsed.identifier,
		);

		const clientIp = await getClientIp();
		await enforceRateLimit("otpVerify", `${clientIp}:${identifier}`);

		// The live code for this identifier, compared by hash below — not looked
		// up by code, which would let a guess land without counting as an attempt.
		const otp = await db.customerOtp.findFirst({
			where: {
				identifier,
				consumedAt: null,
				expiresAt: { gt: new Date() },
			},
			orderBy: { createdAt: "desc" },
		});

		const invalid = "Invalid or expired verification code.";
		if (!otp) throw new ActionError(invalid);

		if (!hashesMatch(otp.code, hashOtp(identifier, parsed.code))) {
			// Counted atomically; the fifth wrong guess burns the code.
			const updated = await db.customerOtp.update({
				where: { id: otp.id },
				data: { attempts: { increment: 1 } },
				select: { attempts: true },
			});
			if (updated.attempts >= OTP_MAX_ATTEMPTS) {
				await db.customerOtp.update({
					where: { id: otp.id },
					data: { consumedAt: new Date() },
				});
				throw new ActionError(
					"Too many wrong codes. Please request a new one.",
				);
			}
			throw new ActionError(invalid);
		}

		// Claimed conditionally, so one code can't sign in twice in a race.
		const claimed = await db.customerOtp.updateMany({
			where: { id: otp.id, consumedAt: null },
			data: { consumedAt: new Date() },
		});
		if (claimed.count === 0) throw new ActionError(invalid);

		await ensureCustomerProfile(parsed.identityType, identifier);
		await createCustomerSession(parsed.identityType, identifier);

		return loadCustomerHub(
			parsed.restaurantSlug,
			parsed.identityType,
			identifier,
		);
	});
}

/** Ends the customer's session on this device. */
export async function signOutCustomerAction() {
	await destroyCustomerSession();
	return { ok: true as const };
}

/**
 * The signed-in customer's orders, reservations and profile.
 *
 * Identity comes from the session cookie only. This used to accept the phone
 * number or email as an argument, which returned anyone's order history to
 * anyone who asked.
 */
export async function getCustomerHubDataAction(input: unknown) {
	return actionData(async () => {
		const { restaurantSlug } = z
			.object({ restaurantSlug: z.string().min(1) })
			.parse(input);
		const session = await getCustomerSession();
		if (!session) throw new ActionError(SIGNED_OUT);
		return loadCustomerHub(
			restaurantSlug,
			session.identityType,
			session.identifier,
		);
	});
}

async function loadCustomerHub(
	restaurantSlug: string,
	identityType: "phone" | "email",
	identifier: string,
) {
	const parsed = { restaurantSlug, identityType };
	const profile = await ensureCustomerProfile(parsed.identityType, identifier);
	const orderWhere =
		parsed.identityType === "email"
			? { customerEmail: identifier }
			: { customerPhone: identifier };

	const [currentRestaurant, orders, reservations] = await Promise.all([
		db.restaurant.findFirstOrThrow({
			where: { slug: parsed.restaurantSlug, isActive: true },
			select: { id: true, name: true, slug: true },
		}),
		db.order.findMany({
			where: orderWhere,
			orderBy: { createdAt: "desc" },
			take: 50,
			select: {
				id: true,
				customerName: true,
				customerPhone: true,
				customerEmail: true,
				type: true,
				status: true,
				statusNote: true,
				cancellationNote: true,
				paymentStatus: true,
				total: true,
				createdAt: true,
				restaurant: {
					select: {
						name: true,
						slug: true,
						currency: true,
						phone: true,
						address: true,
					},
				},
				items: {
					select: {
						id: true,
						name: true,
						qty: true,
						unitPrice: true,
						notes: true,
					},
				},
			},
		}),
		db.reservation.findMany({
			where:
				parsed.identityType === "email"
					? { customerEmail: identifier }
					: { customerPhone: identifier },
			orderBy: { createdAt: "desc" },
			take: 30,
			select: {
				id: true,
				partySize: true,
				startsAt: true,
				status: true,
				reservationPaymentStatus: true,
				restaurant: { select: { name: true, slug: true } },
				table: { select: { label: true } },
			},
		}),
	]);
	const vendorMap = new Map<
		string,
		{ name: string; slug: string; orders: number; reservations: number }
	>();

	for (const order of orders) {
		const current = vendorMap.get(order.restaurant.slug) ?? {
			name: order.restaurant.name,
			slug: order.restaurant.slug,
			orders: 0,
			reservations: 0,
		};
		current.orders += 1;
		vendorMap.set(order.restaurant.slug, current);
	}

	for (const reservation of reservations) {
		const current = vendorMap.get(reservation.restaurant.slug) ?? {
			name: reservation.restaurant.name,
			slug: reservation.restaurant.slug,
			orders: 0,
			reservations: 0,
		};
		current.reservations += 1;
		vendorMap.set(reservation.restaurant.slug, current);
	}

	return {
		profile,
		currentRestaurant,
		orders: orders.map(serializeOrder),
		reservations: reservations.map((reservation) => ({
			...reservation,
			startsAt: reservation.startsAt.toISOString(),
		})),
		vendors: Array.from(vendorMap.values()),
		rewards: [],
	};
}

/**
 * Updates the signed-in customer's own profile.
 *
 * Whose profile comes from the session; it used to come from the request, so
 * anyone could rewrite anyone's name and delivery address. The sign-in
 * identifier itself is pinned to the session's value — it is what the session
 * proves, and changing it here would quietly hand the profile to another number.
 */
export async function updateCustomerProfileAction(input: unknown) {
	return actionData(async () => {
		const session = await getCustomerSession();
		if (!session) throw new ActionError(SIGNED_OUT);

		const parsed = profileSchema.omit({ identifier: true }).parse(input);
		const profile = await ensureCustomerProfile(
			session.identityType,
			session.identifier,
		);

		return db.customerProfile.update({
			where: { id: profile.id },
			data: {
				fullName: normalizeOptional(parsed.fullName),
				whatsappNumber:
					session.identityType === "phone"
						? session.identifier
						: normalizeOptional(parsed.whatsappNumber),
				alternativePhone: normalizeOptional(parsed.alternativePhone),
				email:
					session.identityType === "email"
						? session.identifier
						: normalizeOptional(parsed.email || undefined),
				deliveryAddress: normalizeOptional(parsed.deliveryAddress),
			},
		});
	});
}

const lookupByPhoneSchema = z.object({
	restaurantSlug: z.string().min(1),
	phone: z.string().trim().min(7).max(40),
});

/**
 * Checkout prefill for a returning customer.
 *
 * Only for the signed-in customer, and only for a phone number that is theirs.
 * It used to return the name, email and home address on file for *any* number
 * typed in — a lookup service for strangers' addresses.
 */
export async function lookupCustomerByPhoneAction(input: unknown) {
	const parsed = lookupByPhoneSchema.parse(input);
	const phone = parsed.phone.replace(/\s+/g, "").trim();

	const session = await getCustomerSession();
	if (!session) return null;
	const sessionProfile = await findCustomerProfile(session.identifier);
	const ownsPhone =
		(session.identityType === "phone" && session.identifier === phone) ||
		sessionProfile?.whatsappNumber === phone ||
		sessionProfile?.alternativePhone === phone;
	if (!ownsPhone) return null;
	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug: parsed.restaurantSlug, isActive: true },
		select: { id: true },
	});

	// Try customer profile first
	const profile = await db.customerProfile.findFirst({
		where: {
			OR: [{ whatsappNumber: phone }, { alternativePhone: phone }],
		},
		select: {
			fullName: true,
			email: true,
			deliveryAddress: true,
		},
	});

	if (profile) {
		// If profile has no delivery address, try the most recent order
		let address = profile.deliveryAddress;
		if (!address) {
			const recentOrder = await db.order.findFirst({
				where: {
					restaurantId: restaurant.id,
					customerPhone: phone,
					deliveryAddress: { not: null },
				},
				orderBy: { createdAt: "desc" },
				select: { deliveryAddress: true },
			});
			address = recentOrder?.deliveryAddress ?? null;
		}

		return {
			fullName: profile.fullName,
			email: profile.email,
			deliveryAddress: address,
		};
	}

	// Fallback: look up by recent orders
	const recentOrder = await db.order.findFirst({
		where: { restaurantId: restaurant.id, customerPhone: phone },
		orderBy: { createdAt: "desc" },
		select: {
			customerName: true,
			customerEmail: true,
			deliveryAddress: true,
		},
	});

	if (recentOrder) {
		return {
			fullName: recentOrder.customerName,
			email: recentOrder.customerEmail,
			deliveryAddress: recentOrder.deliveryAddress,
		};
	}

	return null;
}
