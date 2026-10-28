"use server";

import { PlanTier, SubscriptionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, actionResult, parseInput } from "@/lib/action-error";
import { recordAuditLog } from "@/lib/audit-log";
import { requireSuperAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { revalidateLegalPages } from "@/lib/legal";
import { LEGAL_PAGE_META } from "@/lib/legal-defaults";
import { clearMaintenanceCache } from "@/lib/maintenance";
import { BASE_MENU_TEMPLATE, isMenuTemplateId } from "@/lib/menu-templates";
import { issueOwnerPasswordReset } from "@/lib/owner-password-reset";
import { revalidatePublicMenu } from "@/lib/public-menu";
import { encryptSecret } from "@/lib/secret-box";

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
	/** Required to suspend: the owner sees it on their dashboard. */
	reason: optionalString(300),
});

export async function toggleRestaurantActiveAction(formData: FormData) {
	return actionResult(async () => {
		const admin = await requireSuperAdmin();
		const input = toggleRestaurantActiveSchema.parse({
			restaurantId: formData.get("restaurantId"),
			isActive: formData.get("isActive") === "true",
			reason: formData.get("reason"),
		});
		if (!input.isActive && !input.reason) {
			throw new ActionError(
				"Give a reason for the suspension. The owner will see it.",
			);
		}

		// Only for deliberate suspensions. An unpaid plan never comes through
		// here: it's read-only by its own dates (lib/billing-state.ts).
		const restaurant = await db.restaurant.update({
			where: { id: input.restaurantId },
			data: input.isActive
				? { isActive: true, suspensionReason: null, suspendedAt: null }
				: {
						isActive: false,
						suspensionReason: input.reason ?? null,
						suspendedAt: new Date(),
					},
			select: { name: true, slug: true },
		});
		// The menu goes dark (or comes back) now, not at the cache's next refresh.
		revalidatePublicMenu(restaurant.slug);

		await recordAuditLog({
			adminId: admin.id,
			adminName: admin.name ?? admin.email,
			action: input.isActive ? "Restaurant Activated" : "Restaurant Suspended",
			target: input.isActive
				? restaurant.name
				: `${restaurant.name} — ${input.reason}`,
		});

		revalidatePath("/super-admin/restaurants");
		revalidatePath(`/super-admin/restaurants/${input.restaurantId}`);
	});
}

const assignPlanSchema = z.object({
	restaurantId: z.string().cuid(),
	planId: z.string().cuid(),
});

export async function assignRestaurantPlanAction(formData: FormData) {
	return actionResult(async () => {
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
				slug: true,
				ownerId: true,
				subscription: { select: { id: true, lastExpiryNoticeStage: true } },
			},
		});
		const plan = await db.plan.findUniqueOrThrow({
			where: { id: input.planId },
		});

		const now = new Date();
		// Free never expires; a paid plan assigned by an admin runs a month, after
		// which normal billing applies.
		const isFree = Number(plan.monthlyPrice) <= 0;
		const periodEnd = new Date(now);
		if (isFree) periodEnd.setFullYear(periodEnd.getFullYear() + 100);
		else periodEnd.setMonth(periodEnd.getMonth() + 1);

		if (restaurant.subscription) {
			await db.subscription.update({
				where: { id: restaurant.subscription.id },
				data: {
					planId: input.planId,
					originalPlanId: input.planId,
					status: SubscriptionStatus.ACTIVE,
					billingInterval: "MONTHLY",
					currentPeriodStart: now,
					currentPeriodEnd: periodEnd,
					// A new period: its expiry reminders must be sent afresh.
					lastExpiryNoticeStage: null,
				},
			});

			// Lift a non-payment suspension the billing cron applied — the plan is
			// now in force. A suspension a super admin applied is left alone.
			if (restaurant.subscription.lastExpiryNoticeStage === "SUSPENDED") {
				await db.restaurant.update({
					where: { id: restaurant.id },
					data: { isActive: true },
				});
			}
		} else {
			await db.subscription.create({
				data: {
					userId: restaurant.ownerId,
					planId: input.planId,
					restaurantId: restaurant.id,
					status: SubscriptionStatus.ACTIVE,
					billingInterval: "MONTHLY",
					currentPeriodStart: now,
					currentPeriodEnd: periodEnd,
				},
			});
		}

		// Categories a forced downgrade hid come back on any plan change; the
		// public menu still caps what is shown to the new plan's limits.
		await db.menuCategory.updateMany({
			where: { restaurantId: restaurant.id, hiddenByDowngrade: true },
			data: { isActive: true, hiddenByDowngrade: false },
		});
		revalidatePublicMenu(restaurant.slug);

		await recordAuditLog({
			adminId: admin.id,
			adminName: admin.name ?? admin.email,
			action: "Plan Changed",
			target: `${restaurant.name} → ${plan.name}`,
		});

		revalidatePath("/super-admin/restaurants");
		revalidatePath(`/super-admin/restaurants/${input.restaurantId}`);
	});
}

// ─── Plans ─────────────────────────────────────────────

const planSchema = z.object({
	name: z.string().min(1).max(80),
	description: optionalString(300),
	tier: z.nativeEnum(PlanTier),
	monthlyPrice: z.coerce.number().min(0),
	quarterlyPrice: z.coerce.number().min(0),
	yearlyPrice: z.coerce.number().min(0),
	paystackPlanCode: optionalString(120),
	paystackMonthlyPlanCode: optionalString(120),
	paystackQuarterlyPlanCode: optionalString(120),
	paystackYearlyPlanCode: optionalString(120),
	maxCategories: z.coerce.number().int(),
	maxMenuItems: z.coerce.number().int(),
	maxTables: z.coerce.number().int(),
	advancedAnalytics: z.boolean(),
	removeAwamenuBranding: z.boolean(),
	whatsappIntegration: z.boolean(),
	prioritySupport: z.boolean(),
	basicSupport: z.boolean(),
	availableTemplates: z.array(z.string()),
	isActive: z.boolean(),
});

function parsePlanFormData(formData: FormData) {
	return planSchema.parse({
		name: formData.get("name"),
		description: formData.get("description"),
		tier: formData.get("tier"),
		monthlyPrice: formData.get("monthlyPrice"),
		quarterlyPrice: formData.get("quarterlyPrice"),
		yearlyPrice: formData.get("yearlyPrice"),
		paystackPlanCode: formData.get("paystackPlanCode"),
		paystackMonthlyPlanCode: formData.get("paystackMonthlyPlanCode"),
		paystackQuarterlyPlanCode: formData.get("paystackQuarterlyPlanCode"),
		paystackYearlyPlanCode: formData.get("paystackYearlyPlanCode"),
		maxCategories: formData.get("maxCategories"),
		maxMenuItems: formData.get("maxMenuItems"),
		maxTables: formData.get("maxTables"),
		advancedAnalytics: formData.get("advancedAnalytics") === "on",
		removeAwamenuBranding: formData.get("removeAwamenuBranding") === "on",
		whatsappIntegration: formData.get("whatsappIntegration") === "on",
		prioritySupport: formData.get("prioritySupport") === "on",
		basicSupport: formData.get("basicSupport") === "on",
		// Unknown ids are dropped and the base layout is always re-added, so a
		// plan can never end up granting a layout that doesn't render, nor zero
		// layouts at all.
		availableTemplates: Array.from(
			new Set([
				BASE_MENU_TEMPLATE,
				...formData
					.getAll("availableTemplates")
					.filter((value): value is string => typeof value === "string")
					.filter(isMenuTemplateId),
			]),
		),
		isActive: formData.get("isActive") === "on",
	});
}

export async function createPlanAction(formData: FormData) {
	return actionResult(async () => {
		const admin = await requireSuperAdmin();
		const input = parsePlanFormData(formData);
		const data = {
			...input,
			paystackPlanCode: input.paystackMonthlyPlanCode ?? input.paystackPlanCode,
		};

		await db.plan.create({ data });

		await recordAuditLog({
			adminId: admin.id,
			adminName: admin.name ?? admin.email,
			action: "Plan Created",
			target: input.name,
		});

		revalidatePath("/super-admin/plans");
	});
}

const updatePlanSchema = z.object({ planId: z.string().cuid() });

export async function updatePlanAction(formData: FormData) {
	return actionResult(async () => {
		const admin = await requireSuperAdmin();
		const { planId } = updatePlanSchema.parse({
			planId: formData.get("planId"),
		});
		const input = parsePlanFormData(formData);
		const data = {
			...input,
			paystackPlanCode: input.paystackMonthlyPlanCode ?? input.paystackPlanCode,
		};

		await db.plan.update({ where: { id: planId }, data });

		await recordAuditLog({
			adminId: admin.id,
			adminName: admin.name ?? admin.email,
			action: "Plan Updated",
			target: input.name,
		});

		revalidatePath("/super-admin/plans");
		revalidatePath(`/super-admin/plans/${planId}`);
	});
}

const togglePlanActiveSchema = z.object({
	planId: z.string().cuid(),
	isActive: z.coerce.boolean(),
});

export async function togglePlanActiveAction(formData: FormData) {
	return actionResult(async () => {
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
	});
}

const deletePlanSchema = z.object({ planId: z.string().cuid() });

export async function deletePlanAction(formData: FormData) {
	return actionResult(async () => {
		const admin = await requireSuperAdmin();
		const { planId } = deletePlanSchema.parse({
			planId: formData.get("planId"),
		});

		const plan = await db.plan.findUniqueOrThrow({
			where: { id: planId },
			select: { name: true, _count: { select: { subscriptions: true } } },
		});

		if (plan._count.subscriptions > 0) {
			throw new ActionError(
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
	});
}

// ─── Users (restaurant owners) ─────────────────────────

const toggleUserActiveSchema = z.object({
	// User rows are managed by better-auth, which doesn't guarantee a cuid-shaped id.
	userId: z.string().min(1),
	isActive: z.coerce.boolean(),
	reason: optionalString(300),
});

export async function toggleUserActiveAction(formData: FormData) {
	return actionResult(async () => {
		const admin = await requireSuperAdmin();
		const input = toggleUserActiveSchema.parse({
			userId: formData.get("userId"),
			isActive: formData.get("isActive") === "true",
			reason: formData.get("reason"),
		});

		if (!input.isActive && !input.reason) {
			throw new ActionError("A suspension reason is required.");
		}
		await assertNotSuperAdmin(input.userId, admin.id);

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
	});
}

/**
 * The Users page manages restaurant owners. A super admin must not be able to
 * suspend or delete a super admin — least of all themselves, which would lock
 * the platform's only admin out with no way back in.
 */
async function assertNotSuperAdmin(userId: string, actingAdminId: string) {
	if (userId === actingAdminId) {
		throw new ActionError("You can't do that to your own account.");
	}
	const target = await db.user.findUnique({
		where: { id: userId },
		select: { role: true },
	});
	if (target?.role === "SUPER_ADMIN") {
		throw new ActionError("Super admin accounts can't be changed here.");
	}
}

const deleteUserSchema = z.object({ userId: z.string().min(1) });

export async function deleteUserAction(formData: FormData) {
	return actionResult(async () => {
		const admin = await requireSuperAdmin();
		const { userId } = deleteUserSchema.parse({
			userId: formData.get("userId"),
		});

		await assertNotSuperAdmin(userId, admin.id);
		const user = await db.user.findUniqueOrThrow({
			where: { id: userId },
			select: { email: true, _count: { select: { restaurants: true } } },
		});

		if (user._count.restaurants > 0) {
			throw new ActionError(
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
	});
}

// ─── Reviews & Ratings ─────────────────────────────────

const toggleRatingHiddenSchema = z.object({
	ratingId: z.string().cuid(),
	isHidden: z.coerce.boolean(),
});

export async function toggleRatingHiddenAction(formData: FormData) {
	return actionResult(async () => {
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
	});
}

// ─── Platform Settings ─────────────────────────────────

const platformSettingsSchema = z.object({
	platformName: z.string().min(1).max(80),
	logoUrl: optionalString(500).refine(
		(v) => v === undefined || v.startsWith("https://"),
		"The logo must be an uploaded image (https).",
	),
	paystackPublicKey: optionalString(200),
	paystackSecretKey: optionalString(200),
	maintenanceMode: z.boolean(),
	// Capped so a typo can't produce a split that leaves restaurants with
	// almost nothing.
	awamenuPayCommissionPercent: z.coerce
		.number()
		.min(0, "Commission can't be negative.")
		.max(50, "Commission is capped at 50%."),
	// Unchecked boxes send nothing, so an empty array is a legitimate "offer
	// none of these" rather than a malformed submission.
	enabledPaymentChannels: z.array(
		z.enum(["AWAMENU_PAY", "OWN_GATEWAY", "BANK_TRANSFER", "CASH"]),
	),
	awamenuPayProviders: z.array(z.enum(["PAYSTACK", "MONNIFY"])),
	ownGatewayProviders: z.array(z.enum(["PAYSTACK", "FLUTTERWAVE", "MONNIFY"])),
});

export async function updatePlatformSettingsAction(formData: FormData) {
	return actionResult(async () => {
		const admin = await requireSuperAdmin();
		const input = parseInput(platformSettingsSchema, {
			platformName: formData.get("platformName"),
			logoUrl: formData.get("logoUrl"),
			paystackPublicKey: formData.get("paystackPublicKey"),
			paystackSecretKey: formData.get("paystackSecretKey"),
			maintenanceMode: formData.get("maintenanceMode") === "on",
			awamenuPayCommissionPercent:
				formData.get("awamenuPayCommissionPercent") ?? 0,
			enabledPaymentChannels: formData.getAll("enabledPaymentChannels"),
			awamenuPayProviders: formData.getAll("awamenuPayProviders"),
			ownGatewayProviders: formData.getAll("ownGatewayProviders"),
		});

		const existing = await db.platformSetting.findFirst({
			select: { id: true, awamenuPayCommissionPercent: true },
		});
		const previousRate = Number(existing?.awamenuPayCommissionPercent ?? 0);

		const baseData = {
			platformName: input.platformName,
			logoUrl: input.logoUrl ?? null,
			paystackPublicKey: input.paystackPublicKey ?? null,
			maintenanceMode: input.maintenanceMode,
			awamenuPayCommissionPercent: input.awamenuPayCommissionPercent,
			enabledPaymentChannels: input.enabledPaymentChannels,
			awamenuPayProviders: input.awamenuPayProviders,
			ownGatewayProviders: input.ownGatewayProviders,
		};

		if (existing) {
			await db.platformSetting.update({
				where: { id: existing.id },
				data: {
					...baseData,
					// Blank secret key input means "keep the existing value" —
					// the real key is never rendered back into the form.
					// Encrypted at rest like restaurants' gateway keys — the platform
					// key is the most sensitive secret the database holds.
					...(input.paystackSecretKey !== undefined
						? { paystackSecretKey: encryptSecret(input.paystackSecretKey) }
						: {}),
				},
			});
		} else {
			await db.platformSetting.create({
				data: {
					...baseData,
					paystackSecretKey: input.paystackSecretKey
						? encryptSecret(input.paystackSecretKey)
						: null,
				},
			});
		}

		await recordAuditLog({
			adminId: admin.id,
			adminName: admin.name ?? admin.email,
			action: "Platform Settings Updated",
			target: input.platformName,
		});
		// The money setting gets its own entry, with before and after.
		if (previousRate !== input.awamenuPayCommissionPercent) {
			await recordAuditLog({
				adminId: admin.id,
				adminName: admin.name ?? admin.email,
				action: "Commission Changed",
				target: `Platform rate: ${previousRate}% → ${input.awamenuPayCommissionPercent}% (from the next payment; custom and exempt restaurants unaffected)`,
			});
		}

		// Takes effect on this server at once; others pick it up within 30s.
		clearMaintenanceCache();
		revalidatePath("/super-admin", "layout");
	});
}

const sendResetSchema = z.object({ userId: z.string().min(1) });

/**
 * Emails an owner a password-reset code — the "Reset owner password" action.
 *
 * Deliberately not "set a password for them": the admin never sees or chooses
 * the owner's credentials. The owner picks the new password from the code, and
 * completing the reset signs every existing session out.
 */
export async function sendOwnerPasswordResetAction(formData: FormData) {
	return actionResult(async () => {
		const admin = await requireSuperAdmin();
		const input = sendResetSchema.parse({ userId: formData.get("userId") });

		const user = await db.user.findUniqueOrThrow({
			where: { id: input.userId },
			select: { email: true },
		});

		await issueOwnerPasswordReset(user.email);

		await recordAuditLog({
			adminId: admin.id,
			adminName: admin.name ?? admin.email,
			action: "Owner Password Reset Sent",
			target: user.email,
		});

		revalidatePath("/super-admin/users");
	});
}

// ─── Legal pages ───────────────────────────────────────

const optionalEmail = z.preprocess(
	(value) =>
		value === null || (typeof value === "string" && value.trim() === "")
			? undefined
			: value,
	z.string().trim().email("Enter a valid email address.").max(200).optional(),
);

const legalCompanySchema = z.object({
	companyName: optionalString(200),
	rcNumber: optionalString(40),
	registeredAddress: optionalString(300),
	contactEmail: optionalEmail,
	privacyEmail: optionalEmail,
});

/** Company details shown on the legal pages. Blank = shown as a placeholder. */
export async function updateLegalCompanyAction(formData: FormData) {
	return actionResult(async () => {
		const admin = await requireSuperAdmin();
		const input = legalCompanySchema.parse({
			companyName: formData.get("companyName"),
			rcNumber: formData.get("rcNumber"),
			registeredAddress: formData.get("registeredAddress"),
			contactEmail: formData.get("contactEmail"),
			privacyEmail: formData.get("privacyEmail"),
		});

		const data = {
			legalCompanyName: input.companyName ?? null,
			legalRcNumber: input.rcNumber ?? null,
			legalAddress: input.registeredAddress ?? null,
			legalContactEmail: input.contactEmail ?? null,
			legalPrivacyEmail: input.privacyEmail ?? null,
		};
		const existing = await db.platformSetting.findFirst({
			select: { id: true },
		});
		if (existing) {
			await db.platformSetting.update({ where: { id: existing.id }, data });
		} else {
			await db.platformSetting.create({ data });
		}

		await recordAuditLog({
			adminId: admin.id,
			adminName: admin.name ?? admin.email,
			action: "Legal Company Details Updated",
			target: input.companyName ?? "(blank)",
		});

		revalidateLegalPages();
		revalidatePath("/super-admin/legal");
	});
}

const legalDocumentSchema = z.object({
	kind: z.enum(["PRIVACY", "TERMS", "REFUNDS"]),
	intro: z.string().trim().min(1, "The introduction can't be empty.").max(2000),
	body: z.string().trim().min(1, "The page text can't be empty.").max(60_000),
	effectiveDate: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/, "Choose an effective date."),
});

export async function updateLegalDocumentAction(formData: FormData) {
	return actionResult(async () => {
		const admin = await requireSuperAdmin();
		const input = legalDocumentSchema.parse({
			kind: formData.get("kind"),
			intro: formData.get("intro"),
			body: formData.get("body"),
			effectiveDate: formData.get("effectiveDate"),
		});
		const effectiveDate = new Date(`${input.effectiveDate}T00:00:00Z`);
		if (Number.isNaN(effectiveDate.getTime())) {
			throw new ActionError("Choose a valid effective date.");
		}

		const data = {
			intro: input.intro,
			body: input.body,
			effectiveDate,
			updatedById: admin.id,
			updatedByName: admin.name ?? admin.email,
		};
		await db.legalDocument.upsert({
			where: { kind: input.kind },
			create: { kind: input.kind, ...data },
			update: data,
		});

		await recordAuditLog({
			adminId: admin.id,
			adminName: admin.name ?? admin.email,
			action: "Legal Page Updated",
			target: LEGAL_PAGE_META[input.kind].title,
		});

		revalidateLegalPages();
		revalidatePath("/super-admin/legal");
	});
}

/** Drops the edited version, so the page shows the built-in text again. */
export async function resetLegalDocumentAction(formData: FormData) {
	return actionResult(async () => {
		const admin = await requireSuperAdmin();
		const kind = z
			.enum(["PRIVACY", "TERMS", "REFUNDS"])
			.parse(formData.get("kind"));

		await db.legalDocument.deleteMany({ where: { kind } });

		await recordAuditLog({
			adminId: admin.id,
			adminName: admin.name ?? admin.email,
			action: "Legal Page Reset To Default",
			target: LEGAL_PAGE_META[kind].title,
		});

		revalidateLegalPages();
		revalidatePath("/super-admin/legal");
	});
}
