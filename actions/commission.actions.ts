"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, actionResult, parseInput } from "@/lib/action-error";
import { recordAuditLog } from "@/lib/audit-log";
import { requireSuperAdmin } from "@/lib/auth-guards";
import {
	commissionLabel,
	effectiveCommission,
	getPlatformCommissionPercent,
} from "@/lib/commission";
import { db } from "@/lib/db";

const schema = z
	.object({
		restaurantId: z.string().min(1),
		mode: z.enum(["platform", "custom", "exempt"]),
		percent: z.coerce
			.number()
			.min(0, "Can't be negative.")
			.max(50, "50% at most.")
			.optional(),
		note: z.string().trim().max(300).optional(),
	})
	.refine(
		(v) => v.mode !== "custom" || (v.percent !== undefined && v.percent > 0),
		{
			message: "Enter a custom rate above 0%. Use Exempt for no commission.",
		},
	)
	.refine((v) => v.mode === "platform" || (v.note && v.note.length >= 3), {
		message: "Say why this restaurant differs from the platform rate.",
	});

/**
 * Sets one restaurant's AwaMenu Pay commission: follow the platform rate,
 * a custom rate, or exempt. Applies from the next payment; past payments keep
 * the rate they were charged at.
 */
export async function setRestaurantCommissionAction(formData: FormData) {
	return actionResult(async () => {
		const admin = await requireSuperAdmin();
		const input = parseInput(schema, {
			restaurantId: formData.get("restaurantId"),
			mode: formData.get("mode"),
			percent: formData.get("percent") || undefined,
			note: formData.get("note") || undefined,
		});
		const restaurant = await db.restaurant.findUnique({
			where: { id: input.restaurantId },
			select: {
				id: true,
				name: true,
				slug: true,
				commissionPercentOverride: true,
			},
		});
		if (!restaurant) throw new ActionError("Restaurant not found.");

		const override =
			input.mode === "platform"
				? null
				: input.mode === "exempt"
					? 0
					: (input.percent ?? null);
		const platform = await getPlatformCommissionPercent();
		const before = effectiveCommission(
			restaurant.commissionPercentOverride,
			platform,
		);
		const after = effectiveCommission(override, platform);

		await db.restaurant.update({
			where: { id: restaurant.id },
			data: {
				commissionPercentOverride: override,
				commissionNote: input.mode === "platform" ? null : (input.note ?? null),
				commissionUpdatedAt: new Date(),
			},
		});
		await recordAuditLog({
			adminId: admin.id,
			adminName: admin.name ?? admin.email,
			action: "Commission Changed",
			target: `${restaurant.name}: ${commissionLabel(before)} → ${commissionLabel(after)}${input.note ? ` (${input.note})` : ""}`,
		});

		revalidatePath("/super-admin/restaurants");
		revalidatePath(`/super-admin/restaurants/${restaurant.id}`);
		revalidatePath("/super-admin/settings");
		revalidatePath(`/dashboard/${restaurant.slug}/settings`);
	});
}
