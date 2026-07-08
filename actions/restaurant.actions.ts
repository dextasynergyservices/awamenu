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
