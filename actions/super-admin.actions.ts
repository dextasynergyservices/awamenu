"use server";

import { PlanTier, SubscriptionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAuditLog } from "@/lib/audit-log";
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
	const admin = await requireSuperAdmin();
	const input = toggleRestaurantActiveSchema.parse({
		restaurantId: formData.get("restaurantId"),
		isActive: formData.get("isActive") === "true",
	});

	const restaurant = await db.restaurant.update({
		where: { id: input.restaurantId },
		data: { isActive: input.isActive },
		select: { name: true },
	});

	await recordAuditLog({
		adminId: admin.id,
		adminName: admin.name ?? admin.email,
		action: input.isActive ? "Restaurant Activated" : "Restaurant Suspended",
		target: restaurant.name,
	});

	revalidatePath("/super-admin/restaurants");
	revalidatePath(`/super-admin/restaurants/${input.restaurantId}`);
}

const assignPlanSchema = z.object({
	restaurantId: z.string().cuid(),
	planId: z.string().cuid(),
});

export async function assignRestaurantPlanAction(formData: FormData) {
	const admin = await requireSuperAdmin();
	const input = assignPlanSchema.parse({
		restaurantId: formData.get("restaurantId"),
		planId: formData.get("planId"),
	});

	const restaurant = await db.restaurant.findUniqueOrThrow({
		where: { id: input.restaurantId },
		select: {
			id: true,
			name: true,
			ownerId: true,
			subscription: { select: { id: true } },
		},
	});
	const plan = await db.plan.findUniqueOrThrow({ where: { id: input.planId } });

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

	await recordAuditLog({
		adminId: admin.id,
		adminName: admin.name ?? admin.email,
		action: "Plan Changed",
		target: `${restaurant.name} → ${plan.name}`,
	});

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
	const admin = await requireSuperAdmin();
	const input = parsePlanFormData(formData);

	await db.plan.create({ data: input });

	await recordAuditLog({
		adminId: admin.id,
		adminName: admin.name ?? admin.email,
		action: "Plan Created",
		target: input.name,
	});

	revalidatePath("/super-admin/plans");
}

const updatePlanSchema = z.object({ planId: z.string().cuid() });

export async function updatePlanAction(formData: FormData) {
	const admin = await requireSuperAdmin();
	const { planId } = updatePlanSchema.parse({
		planId: formData.get("planId"),
	});
	const input = parsePlanFormData(formData);

	await db.plan.update({ where: { id: planId }, data: input });

	await recordAuditLog({
		adminId: admin.id,
		adminName: admin.name ?? admin.email,
		action: "Plan Updated",
		target: input.name,
	});

	revalidatePath("/super-admin/plans");
	revalidatePath(`/super-admin/plans/${planId}`);
}

const togglePlanActiveSchema = z.object({
	planId: z.string().cuid(),
	isActive: z.coerce.boolean(),
});

export async function togglePlanActiveAction(formData: FormData) {
	const admin = await requireSuperAdmin();
	const input = togglePlanActiveSchema.parse({
		planId: formData.get("planId"),
		isActive: formData.get("isActive") === "true",
	});

	const plan = await db.plan.update({
		where: { id: input.planId },
		data: { isActive: input.isActive },
		select: { name: true },
	});

	await recordAuditLog({
		adminId: admin.id,
		adminName: admin.name ?? admin.email,
		action: input.isActive ? "Plan Enabled" : "Plan Disabled",
		target: plan.name,
	});

	revalidatePath("/super-admin/plans");
}

const deletePlanSchema = z.object({ planId: z.string().cuid() });

export async function deletePlanAction(formData: FormData) {
	const admin = await requireSuperAdmin();
	const { planId } = deletePlanSchema.parse({ planId: formData.get("planId") });

	const plan = await db.plan.findUniqueOrThrow({
		where: { id: planId },
		select: { name: true, _count: { select: { subscriptions: true } } },
	});

	if (plan._count.subscriptions > 0) {
		throw new Error(
			"Cannot delete a plan with active subscriptions. Move restaurants to another plan first.",
		);
	}

	await db.plan.delete({ where: { id: planId } });

	await recordAuditLog({
		adminId: admin.id,
		adminName: admin.name ?? admin.email,
		action: "Plan Deleted",
		target: plan.name,
	});

	revalidatePath("/super-admin/plans");
}

// ─── Users (restaurant owners) ─────────────────────────

const toggleUserActiveSchema = z.object({
	// User rows are managed by better-auth, which doesn't guarantee a cuid-shaped id.
	userId: z.string().min(1),
	isActive: z.coerce.boolean(),
	reason: optionalString(300),
});

export async function toggleUserActiveAction(formData: FormData) {
	const admin = await requireSuperAdmin();
	const input = toggleUserActiveSchema.parse({
		userId: formData.get("userId"),
		isActive: formData.get("isActive") === "true",
		reason: formData.get("reason"),
	});

	if (!input.isActive && !input.reason) {
		throw new Error("A suspension reason is required.");
	}

	const user = await db.user.update({
		where: { id: input.userId },
		data: {
			isActive: input.isActive,
			suspensionReason: input.isActive ? null : input.reason,
		},
		select: { email: true },
	});

	await recordAuditLog({
		adminId: admin.id,
		adminName: admin.name ?? admin.email,
		action: input.isActive ? "Owner Activated" : "Owner Suspended",
		target: input.isActive ? user.email : `${user.email} — ${input.reason}`,
	});

	revalidatePath("/super-admin/users");
}

const deleteUserSchema = z.object({ userId: z.string().min(1) });

export async function deleteUserAction(formData: FormData) {
	const admin = await requireSuperAdmin();
	const { userId } = deleteUserSchema.parse({ userId: formData.get("userId") });

	const user = await db.user.findUniqueOrThrow({
		where: { id: userId },
		select: { email: true, _count: { select: { restaurants: true } } },
	});

	if (user._count.restaurants > 0) {
		throw new Error(
			"Cannot delete an owner with restaurants on the platform. Delete or reassign their restaurant(s) first.",
		);
	}

	await db.$transaction([
		db.subscription.deleteMany({ where: { userId } }),
		db.user.delete({ where: { id: userId } }),
	]);

	await recordAuditLog({
		adminId: admin.id,
		adminName: admin.name ?? admin.email,
		action: "Owner Deleted",
		target: user.email,
	});

	revalidatePath("/super-admin/users");
}

// ─── Reviews & Ratings ─────────────────────────────────

const toggleRatingHiddenSchema = z.object({
	ratingId: z.string().cuid(),
	isHidden: z.coerce.boolean(),
});

export async function toggleRatingHiddenAction(formData: FormData) {
	const admin = await requireSuperAdmin();
	const input = toggleRatingHiddenSchema.parse({
		ratingId: formData.get("ratingId"),
		isHidden: formData.get("isHidden") === "true",
	});

	const rating = await db.rating.update({
		where: { id: input.ratingId },
		data: { isHidden: input.isHidden },
		select: { restaurant: { select: { name: true } } },
	});

	await recordAuditLog({
		adminId: admin.id,
		adminName: admin.name ?? admin.email,
		action: input.isHidden ? "Review Hidden" : "Review Shown",
		target: rating.restaurant.name,
	});

	revalidatePath("/super-admin/reviews");
}

// ─── Platform Settings ─────────────────────────────────

const platformSettingsSchema = z.object({
	platformName: z.string().min(1).max(80),
	logoUrl: optionalString(500),
	paystackPublicKey: optionalString(200),
	paystackSecretKey: optionalString(200),
	maintenanceMode: z.boolean(),
});

export async function updatePlatformSettingsAction(formData: FormData) {
	const admin = await requireSuperAdmin();
	const input = platformSettingsSchema.parse({
		platformName: formData.get("platformName"),
		logoUrl: formData.get("logoUrl"),
		paystackPublicKey: formData.get("paystackPublicKey"),
		paystackSecretKey: formData.get("paystackSecretKey"),
		maintenanceMode: formData.get("maintenanceMode") === "on",
	});

	const existing = await db.platformSetting.findFirst({ select: { id: true } });

	const baseData = {
		platformName: input.platformName,
		logoUrl: input.logoUrl ?? null,
		paystackPublicKey: input.paystackPublicKey ?? null,
		maintenanceMode: input.maintenanceMode,
	};

	if (existing) {
		await db.platformSetting.update({
			where: { id: existing.id },
			data: {
				...baseData,
				// Blank secret key input means "keep the existing value" —
				// the real key is never rendered back into the form.
				...(input.paystackSecretKey !== undefined
					? { paystackSecretKey: input.paystackSecretKey }
					: {}),
			},
		});
	} else {
		await db.platformSetting.create({
			data: { ...baseData, paystackSecretKey: input.paystackSecretKey ?? null },
		});
	}

	await recordAuditLog({
		adminId: admin.id,
		adminName: admin.name ?? admin.email,
		action: "Platform Settings Updated",
		target: input.platformName,
	});

	revalidatePath("/super-admin/settings");
}
