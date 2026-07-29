"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";

const bankAccountSchema = z.object({
	id: z.string().optional(),
	slug: z.string().min(1),
	accountName: z.string().min(2),
	accountNumber: z.string().min(5),
	bankName: z.string().min(2),
});

export async function saveBankAccountAction(formData: FormData) {
	const user = await requireUser();
	const input = bankAccountSchema.parse({
		id: formData.get("id")?.toString() || undefined,
		slug: formData.get("slug"),
		accountName: formData.get("accountName"),
		accountNumber: formData.get("accountNumber"),
		bankName: formData.get("bankName"),
	});

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug: input.slug, ownerId: user.id },
		select: { id: true, slug: true },
	});

	if (input.id) {
		await db.restaurantBankAccount.update({
			where: { id: input.id, restaurantId: restaurant.id },
			data: {
				accountName: input.accountName,
				accountNumber: input.accountNumber,
				bankName: input.bankName,
			},
		});
	} else {
		await db.restaurantBankAccount.create({
			data: {
				restaurantId: restaurant.id,
				accountName: input.accountName,
				accountNumber: input.accountNumber,
				bankName: input.bankName,
			},
		});
	}

	revalidatePath(`/dashboard/${restaurant.slug}/settings`);
	revalidatePath(`/${restaurant.slug}`);
}

export async function toggleBankAccountStatusAction(formData: FormData) {
	const user = await requireUser();
	const id = formData.get("id") as string;
	const slug = formData.get("slug") as string;
	const isActive = formData.get("isActive") === "true";

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug, ownerId: user.id },
		select: { id: true, slug: true },
	});

	await db.restaurantBankAccount.update({
		where: { id, restaurantId: restaurant.id },
		data: { isActive },
	});

	revalidatePath(`/dashboard/${restaurant.slug}/settings`);
	revalidatePath(`/${restaurant.slug}`);
}

export async function deleteBankAccountAction(formData: FormData) {
	const user = await requireUser();
	const id = formData.get("id") as string;
	const slug = formData.get("slug") as string;

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug, ownerId: user.id },
		select: { id: true, slug: true },
	});

	await db.restaurantBankAccount.delete({
		where: { id, restaurantId: restaurant.id },
	});

	revalidatePath(`/dashboard/${restaurant.slug}/settings`);
	revalidatePath(`/${restaurant.slug}`);
}
