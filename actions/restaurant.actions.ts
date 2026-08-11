"use server";

import { PaymentPolicy } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { getRestaurantPlanFeatures } from "@/lib/plan-features";
import { enforceRateLimit, getClientIp } from "@/lib/ratelimit";
import { decryptSecret, encryptSecret } from "@/lib/secret-box";

const updateSettingsSchema = z.object({
	slug: z.string().min(1),
	dineInPaymentPolicy: z.nativeEnum(PaymentPolicy),
	staffDashboardPassword: z.string().min(4).optional(),
	staffDashboardAutoLockHours: z.coerce.number().min(1).max(720).optional(),
});

const updateInfoSchema = z.object({
	restaurantId: z.string().min(1),
	slug: z
		.string()
		.min(3)
		.max(60)
		.regex(
			/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
			"Use lowercase letters, numbers, and hyphens only.",
		),
	name: z.string().min(2),
	description: z.string().optional(),
	phone: z.string().optional(),
	address: z.string().optional(),
	currency: z.string().min(3),
	timezone: z.string().min(1),
});

const updateBrandingSchema = z.object({
	slug: z.string().min(1),
	logoUrl: z.string().optional(),
	coverUrl: z.string().optional(),
	primaryColor: z.string().optional(),
	fontFamily: z.string().optional(),
	activeTemplate: z.string().min(1),
});

export async function updateRestaurantSettingsAction(formData: FormData) {
	const user = await requireUser();
	const input = updateSettingsSchema.parse({
		slug: formData.get("slug"),
		dineInPaymentPolicy: formData.get("dineInPaymentPolicy"),
		staffDashboardPassword: formData.get("staffDashboardPassword") || undefined,
		staffDashboardAutoLockHours: formData.get("staffDashboardAutoLockHours"),
	});

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug: input.slug, ownerId: user.id },
		select: { id: true, slug: true },
	});

	// Encrypted rather than hashed. This is a shared operational credential the
	// owner needs to read back and pass to staff, so it has to be recoverable —
	// see lib/secret-box.ts. Reading it back is gated behind re-entering the
	// owner's own account password.
	const encryptedStaffPassword =
		input.staffDashboardPassword !== undefined
			? encryptSecret(input.staffDashboardPassword)
			: undefined;

	await db.restaurant.update({
		where: { id: restaurant.id },
		data: {
			dineInPaymentPolicy: input.dineInPaymentPolicy,
			...(encryptedStaffPassword !== undefined && {
				staffDashboardPassword: encryptedStaffPassword,
			}),
			...(input.staffDashboardAutoLockHours !== undefined && {
				staffDashboardAutoLockHours: input.staffDashboardAutoLockHours,
			}),
		},
	});

	revalidatePath(`/dashboard/${restaurant.slug}/settings`);
	revalidatePath(`/${restaurant.slug}`);
}

export async function updateRestaurantInfoAction(formData: FormData) {
	const user = await requireUser();
	const input = updateInfoSchema.parse({
		restaurantId: formData.get("restaurantId"),
		slug: formData.get("slug"),
		name: formData.get("name"),
		description: formData.get("description") || undefined,
		phone: formData.get("phone") || undefined,
		address: formData.get("address") || undefined,
		currency: formData.get("currency") || "NGN",
		timezone: formData.get("timezone") || "Africa/Lagos",
	});

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { id: input.restaurantId, ownerId: user.id },
		select: { id: true, slug: true },
	});

	if (input.slug !== restaurant.slug) {
		const slugTaken = await db.restaurant.findUnique({
			where: { slug: input.slug },
			select: { id: true },
		});
		if (slugTaken) {
			throw new Error("That web address is already taken.");
		}
	}

	await db.restaurant.update({
		where: { id: restaurant.id },
		data: {
			slug: input.slug,
			name: input.name,
			description: input.description,
			phone: input.phone,
			address: input.address,
			currency: input.currency,
			timezone: input.timezone,
		},
	});

	revalidatePath(`/dashboard/${restaurant.slug}/settings`);
	revalidatePath(`/${restaurant.slug}`);

	if (input.slug !== restaurant.slug) {
		// The dashboard URL itself is slug-based — without this, the page the
		// admin is looking at would now point at a slug that no longer exists.
		redirect(`/dashboard/${input.slug}/settings`);
	}
}

export async function updateRestaurantBrandingAction(formData: FormData) {
	const user = await requireUser();
	const input = updateBrandingSchema.parse({
		slug: formData.get("slug"),
		logoUrl: formData.get("logoUrl") || undefined,
		coverUrl: formData.get("coverUrl") || undefined,
		primaryColor: formData.get("primaryColor") || undefined,
		fontFamily: formData.get("fontFamily") || undefined,
		activeTemplate: formData.get("activeTemplate") || "classic",
	});

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug: input.slug, ownerId: user.id },
		select: { id: true, slug: true },
	});

	// The layout picker greys out locked templates, but that's presentation
	// only — this form posts a plain string, so the entitlement is re-checked
	// here before it's persisted.
	//
	// Coerced to "classic" rather than rejected: the branding form re-submits
	// whatever template is already stored as a hidden field, so a restaurant
	// that downgraded while on a paid layout would otherwise be unable to save
	// even their logo. Normalising on write also stops a stale locked template
	// from lingering in the database.
	const planFeatures = await getRestaurantPlanFeatures(restaurant.id);
	const activeTemplate = (planFeatures.availableTemplates as string[]).includes(
		input.activeTemplate,
	)
		? input.activeTemplate
		: "classic";

	await db.restaurant.update({
		where: { id: restaurant.id },
		data: {
			logoUrl: input.logoUrl,
			coverUrl: input.coverUrl,
			primaryColor: input.primaryColor,
			fontFamily: input.fontFamily,
			activeTemplate,
		},
	});

	revalidatePath(`/dashboard/${restaurant.slug}/settings`);
	revalidatePath(`/${restaurant.slug}`);
}

const revealStaffPasswordSchema = z.object({
	slug: z.string().min(1),
	adminPassword: z.string().min(1),
});

/**
 * Reveals the staff dashboard password to the restaurant owner.
 *
 * Re-authenticates against the owner's own account password first: the
 * dashboard session alone isn't enough, so an unattended logged-in device
 * can't be used to lift the staff credential.
 *
 * Rate limited because this is a password-guessing surface — without it, the
 * endpoint would be an unthrottled oracle for the owner's account password.
 */
export async function revealStaffPasswordAction(input: {
	slug: string;
	adminPassword: string;
}): Promise<{ password: string } | { error: string }> {
	const user = await requireUser();
	const parsed = revealStaffPasswordSchema.parse(input);

	try {
		await enforceRateLimit(
			"staffLogin",
			`reveal:${user.id}:${await getClientIp()}`,
		);
	} catch {
		return { error: "Too many attempts. Please wait a minute and try again." };
	}

	const restaurant = await db.restaurant.findFirst({
		where: { slug: parsed.slug, ownerId: user.id },
		select: { staffDashboardPassword: true },
	});

	if (!restaurant) return { error: "Restaurant not found." };
	if (!restaurant.staffDashboardPassword) {
		return { error: "No staff password has been set yet." };
	}

	const account = await db.account.findFirst({
		where: { userId: user.id, provider: "credential" },
		select: { password: true },
	});

	if (!account?.password) {
		return { error: "Password confirmation isn't available for this account." };
	}

	const { verifyPassword } = await import("better-auth/crypto");
	const validAdmin = await verifyPassword({
		hash: account.password,
		password: parsed.adminPassword,
	});

	if (!validAdmin) return { error: "Incorrect password." };

	const plain = decryptSecret(restaurant.staffDashboardPassword);
	if (plain === null) {
		// Stored before staff passwords were made recoverable — it's a one-way
		// hash, so there is nothing to reveal.
		return {
			error:
				"This password was saved in an older format and can't be shown. Set a new one below to enable viewing.",
		};
	}

	return { password: plain };
}
