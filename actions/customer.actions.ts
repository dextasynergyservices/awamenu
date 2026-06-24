"use server";

import { z } from "zod";
import { db } from "@/lib/db";

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
	paymentStatus: string;
	total: unknown;
	createdAt: Date;
	restaurant: { name: string; slug: string; currency: string };
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

export async function requestCustomerOtpAction(input: unknown) {
	const parsed = requestOtpSchema.parse(input);
	const identifier = normalizeIdentifier(
		parsed.identityType,
		parsed.identifier,
	);

	await db.restaurant.findFirstOrThrow({
		where: { slug: parsed.restaurantSlug, isActive: true },
		select: { id: true },
	});
	await ensureCustomerProfile(parsed.identityType, identifier);

	const code = String(Math.floor(100000 + Math.random() * 900000));
	await db.customerOtp.create({
		data: {
			identifier,
			channel: parsed.channel,
			code,
			expiresAt: new Date(Date.now() + 10 * 60 * 1000),
		},
	});

	return {
		ok: true,
		// Until SMS/WhatsApp OTP delivery is connected, expose this in dev UI.
		devCode: code,
	};
}

export async function verifyCustomerOtpAction(input: unknown) {
	const parsed = verifyOtpSchema.parse(input);
	const identifier = normalizeIdentifier(
		parsed.identityType,
		parsed.identifier,
	);
	const otp = await db.customerOtp.findFirst({
		where: {
			identifier,
			code: parsed.code,
			consumedAt: null,
			expiresAt: { gt: new Date() },
		},
		orderBy: { createdAt: "desc" },
	});

	if (!otp) {
		throw new Error("Invalid or expired verification code.");
	}

	await db.customerOtp.update({
		where: { id: otp.id },
		data: { consumedAt: new Date() },
	});
	await ensureCustomerProfile(parsed.identityType, identifier);

	return getCustomerHubDataAction({
		restaurantSlug: parsed.restaurantSlug,
		identityType: parsed.identityType,
		identifier,
	});
}

export async function getCustomerHubDataAction(input: unknown) {
	const parsed = z
		.object({
			restaurantSlug: z.string().min(1),
			identityType: identityTypeSchema,
			identifier: z.string().trim().min(3).max(120),
		})
		.parse(input);
	const identifier = normalizeIdentifier(
		parsed.identityType,
		parsed.identifier,
	);
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
				paymentStatus: true,
				total: true,
				createdAt: true,
				restaurant: { select: { name: true, slug: true, currency: true } },
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

export async function updateCustomerProfileAction(input: unknown) {
	const parsed = profileSchema.parse(input);
	const identifier = parsed.identifier.trim();
	const existingProfile = await findCustomerProfile(identifier);
	const data = {
		fullName: normalizeOptional(parsed.fullName),
		whatsappNumber: normalizeOptional(parsed.whatsappNumber),
		alternativePhone: normalizeOptional(parsed.alternativePhone),
		email: normalizeOptional(parsed.email || undefined),
		deliveryAddress: normalizeOptional(parsed.deliveryAddress),
	};

	if (existingProfile) {
		return db.customerProfile.update({
			where: { id: existingProfile.id },
			data,
		});
	}

	return db.customerProfile.create({ data });
}
