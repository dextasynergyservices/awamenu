"use server";

import { PlanTier, SubscriptionStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";

const optionalString = (max: number) =>
	z.preprocess(
		(value) =>
			value === null || (typeof value === "string" && value.trim() === "")
				? undefined
				: value,
		z.string().trim().max(max).optional(),
	);

// ─── Restaurants ──────────────────────────────────────

const toggleRestaurantActiveSchema = z.object({
	restaurantId: z.string().cuid(),
	isActive: z.coerce.boolean(),
});

export async function toggleRestaurantActiveAction(formData: FormData) {
	await requireSuperAdmin();
	const input = toggleRestaurantActiveSchema.parse({
		restaurantId: formData.get("restaurantId"),
		isActive: formData.get("isActive") === "true",
	});

	await db.restaurant.update({
		where: { id: input.restaurantId },
		data: { isActive: input.isActive },
	});

	revalidatePath("/super-admin/restaurants");
	revalidatePath(`/super-admin/restaurants/${input.restaurantId}`);
}

const assignPlanSchema = z.object({
	restaurantId: z.string().cuid(),
	planId: z.string().cuid(),
});

export async function assignRestaurantPlanAction(formData: FormData) {
	await requireSuperAdmin();
	const input = assignPlanSchema.parse({
		restaurantId: formData.get("restaurantId"),
		planId: formData.get("planId"),
	});

	const restaurant = await db.restaurant.findUniqueOrThrow({
		where: { id: input.restaurantId },
		select: {
			id: true,
			ownerId: true,
			subscription: { select: { id: true } },
		},
	});
	await db.plan.findUniqueOrThrow({ where: { id: input.planId } });

	const now = new Date();
	const periodEnd = new Date(now);
	periodEnd.setMonth(periodEnd.getMonth() + 1);

	if (restaurant.subscription) {
		await db.subscription.update({
			where: { id: restaurant.subscription.id },
			data: {
				planId: input.planId,
				status: SubscriptionStatus.ACTIVE,
				currentPeriodStart: now,
				currentPeriodEnd: periodEnd,
			},
		});
	} else {
		await db.subscription.create({
			data: {
				userId: restaurant.ownerId,
				planId: input.planId,
				restaurantId: restaurant.id,
				status: SubscriptionStatus.ACTIVE,
				currentPeriodStart: now,
				currentPeriodEnd: periodEnd,
			},
		});
	}

	revalidatePath("/super-admin/restaurants");
	revalidatePath(`/super-admin/restaurants/${input.restaurantId}`);
}

// ─── Plans ─────────────────────────────────────────────

const planSchema = z.object({
	name: z.string().min(1).max(80),
	description: optionalString(300),
	tier: z.nativeEnum(PlanTier),
	monthlyPrice: z.coerce.number().min(0),
	yearlyPrice: z.coerce.number().min(0),
	maxCategories: z.coerce.number().int(),
	maxMenuItems: z.coerce.number().int(),
	multipleTemplates: z.boolean(),
	advancedAnalytics: z.boolean(),
	removeAwamenuBranding: z.boolean(),
	whatsappIntegration: z.boolean(),
	prioritySupport: z.boolean(),
	basicSupport: z.boolean(),
	isActive: z.boolean(),
});

function parsePlanFormData(formData: FormData) {
	return planSchema.parse({
		name: formData.get("name"),
		description: formData.get("description"),
		tier: formData.get("tier"),
		monthlyPrice: formData.get("monthlyPrice"),
		yearlyPrice: formData.get("yearlyPrice"),
		maxCategories: formData.get("maxCategories"),
		maxMenuItems: formData.get("maxMenuItems"),
		multipleTemplates: formData.get("multipleTemplates") === "on",
		advancedAnalytics: formData.get("advancedAnalytics") === "on",
		removeAwamenuBranding: formData.get("removeAwamenuBranding") === "on",
		whatsappIntegration: formData.get("whatsappIntegration") === "on",
		prioritySupport: formData.get("prioritySupport") === "on",
		basicSupport: formData.get("basicSupport") === "on",
		isActive: formData.get("isActive") === "on",
	});
}

export async function createPlanAction(formData: FormData) {
	await requireSuperAdmin();
	const input = parsePlanFormData(formData);

	await db.plan.create({ data: input });

	revalidatePath("/super-admin/plans");
}

const updatePlanSchema = z.object({ planId: z.string().cuid() });

export async function updatePlanAction(formData: FormData) {
	await requireSuperAdmin();
	const { planId } = updatePlanSchema.parse({
		planId: formData.get("planId"),
	});
	const input = parsePlanFormData(formData);

	await db.plan.update({ where: { id: planId }, data: input });

	revalidatePath("/super-admin/plans");
	revalidatePath(`/super-admin/plans/${planId}`);
}

// ─── Users ─────────────────────────────────────────────

const updateUserRoleSchema = z.object({
	userId: z.string().cuid(),
	role: z.nativeEnum(UserRole),
});

export async function updateUserRoleAction(formData: FormData) {
	const currentAdmin = await requireSuperAdmin();
	const input = updateUserRoleSchema.parse({
		userId: formData.get("userId"),
		role: formData.get("role"),
	});

	if (input.userId === currentAdmin.id && input.role !== UserRole.SUPER_ADMIN) {
		throw new Error("You cannot remove your own super admin access.");
	}

	await db.user.update({
		where: { id: input.userId },
		data: { role: input.role },
	});

	revalidatePath("/super-admin/users");
}
