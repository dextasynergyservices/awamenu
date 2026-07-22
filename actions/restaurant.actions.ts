"use server";

import { PaymentPolicy } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";

const updateSettingsSchema = z.object({
	slug: z.string().min(1),
	dineInPaymentPolicy: z.nativeEnum(PaymentPolicy),
	staffDashboardPassword: z.string().optional(),
	staffDashboardAutoLockHours: z.coerce.number().min(1).max(720).optional(),
});

const updateInfoSchema = z.object({
	slug: z.string().min(1),
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

	await db.restaurant.update({
		where: { id: restaurant.id },
		data: {
			dineInPaymentPolicy: input.dineInPaymentPolicy,
			...(input.staffDashboardPassword !== undefined && {
				staffDashboardPassword: input.staffDashboardPassword,
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
		slug: formData.get("slug"),
		name: formData.get("name"),
		description: formData.get("description") || undefined,
		phone: formData.get("phone") || undefined,
		address: formData.get("address") || undefined,
		currency: formData.get("currency") || "NGN",
		timezone: formData.get("timezone") || "Africa/Lagos",
	});

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug: input.slug, ownerId: user.id },
		select: { id: true, slug: true },
	});

	await db.restaurant.update({
		where: { id: restaurant.id },
		data: {
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

	await db.restaurant.update({
		where: { id: restaurant.id },
		data: {
			logoUrl: input.logoUrl,
			coverUrl: input.coverUrl,
			primaryColor: input.primaryColor,
			fontFamily: input.fontFamily,
			activeTemplate: input.activeTemplate,
		},
	});

	revalidatePath(`/dashboard/${restaurant.slug}/settings`);
	revalidatePath(`/${restaurant.slug}`);
}
