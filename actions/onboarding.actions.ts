"use server";

import { OnboardingStatus, PlanTier, SubscriptionStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/env";
import { ActionError, actionResult } from "@/lib/action-error";
import { captureServerEvent } from "@/lib/analytics";
import { requireUser } from "@/lib/auth-guards";
import { addBillingPeriod, parseBillingInterval } from "@/lib/billing";
import { db } from "@/lib/db";
import { sendRestaurantWelcomeEmail } from "@/lib/email";
import { initiateSubscriptionPayment } from "@/lib/payments";

const choosePlanSchema = z.object({
	planId: z.string().cuid(),
	billingInterval: z
		.enum(["MONTHLY", "QUARTERLY", "YEARLY"])
		.default("MONTHLY"),
});

const setupSchema = z.object({
	planId: z.string().cuid().optional(),
	billingInterval: z
		.enum(["MONTHLY", "QUARTERLY", "YEARLY"])
		.default("MONTHLY"),
	name: z.string().min(1).max(100),
	slug: z
		.string()
		.min(3)
		.max(60)
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
	phone: z.string().min(3).max(40).optional(),
	address: z.string().max(200).optional(),
	whatsappNumber: z.string().max(40).optional(),
});

async function continueToPlanDestination(
	userId: string,
	plan: { id: string; tier: PlanTier },
	billingInterval = "MONTHLY",
) {
	if (plan.tier === PlanTier.FREE) {
		await db.user.update({
			where: { id: userId },
			data: { onboardingStatus: OnboardingStatus.PENDING_SETUP },
		});
		redirect(`/onboarding/setup?planId=${plan.id}&billing=${billingInterval}`);
	}

	await db.user.update({
		where: { id: userId },
		data: { onboardingStatus: OnboardingStatus.PENDING_PAYMENT },
	});
	redirect(`/onboarding/checkout?planId=${plan.id}&billing=${billingInterval}`);
}

export async function choosePlanAction(formData: FormData) {
	const user = await requireUser();
	const input = choosePlanSchema.parse({
		planId: formData.get("planId"),
		billingInterval: parseBillingInterval(formData.get("billingInterval")),
	});
	const plan = await db.plan.findUniqueOrThrow({ where: { id: input.planId } });

	await continueToPlanDestination(user.id, plan, input.billingInterval);
}

/**
 * Resumes the flow for a user who already picked a plan on the pricing page
 * before signing up — skips the "choose a plan" picker entirely and sends
 * them straight to checkout (paid tiers) or setup (free tier), instead of
 * making them re-select the same plan a second time.
 */
export async function continueWithPreselectedPlan(
	tierParam: string,
	billingParam?: string,
) {
	const tier = tierParam.toUpperCase();
	if (!(Object.values(PlanTier) as string[]).includes(tier)) return;

	const plan = await db.plan.findFirst({
		where: { tier: tier as PlanTier, isActive: true },
	});
	if (!plan) return;

	const user = await requireUser();
	await continueToPlanDestination(
		user.id,
		plan,
		parseBillingInterval(billingParam),
	);
}

export async function startSubscriptionCheckoutAction(formData: FormData) {
	const user = await requireUser();
	const input = choosePlanSchema.parse({
		planId: formData.get("planId"),
		billingInterval: parseBillingInterval(formData.get("billingInterval")),
	});
	const authorizationUrl = await initiateSubscriptionPayment({
		userId: user.id,
		planId: input.planId,
		billingInterval: input.billingInterval,
		customerEmail: user.email,
	});

	redirect(authorizationUrl);
}

export async function completeSetupAction(formData: FormData) {
	return actionResult(async () => {
		const user = await requireUser();
		const input = setupSchema.parse({
			planId: formData.get("planId") || undefined,
			billingInterval: parseBillingInterval(formData.get("billingInterval")),
			name: formData.get("name"),
			slug: formData.get("slug"),
			phone: formData.get("phone") || undefined,
			address: formData.get("address") || undefined,
			whatsappNumber: formData.get("whatsappNumber") || undefined,
		});

		const existing = await db.restaurant.findUnique({
			where: { slug: input.slug },
		});
		if (existing) {
			throw new ActionError("Restaurant slug is already taken.");
		}

		const restaurant = await db.restaurant.create({
			data: {
				ownerId: user.id,
				name: input.name,
				slug: input.slug,
				phone: input.phone,
				address: input.address,
				whatsappNumber: input.whatsappNumber,
			},
		});

		let subscription = await db.subscription.findFirst({
			where: {
				userId: user.id,
				restaurantId: null,
				status: {
					in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
				},
			},
			orderBy: { createdAt: "desc" },
		});

		if (!subscription) {
			const plan = input.planId
				? await db.plan.findUniqueOrThrow({ where: { id: input.planId } })
				: await db.plan.findUniqueOrThrow({ where: { tier: PlanTier.FREE } });
			const now = new Date();
			const periodEnd = addBillingPeriod(now, input.billingInterval);

			subscription = await db.subscription.create({
				data: {
					userId: user.id,
					planId: plan.id,
					restaurantId: restaurant.id,
					status: SubscriptionStatus.ACTIVE,
					billingInterval: input.billingInterval,
					currentPeriodStart: now,
					currentPeriodEnd: periodEnd,
				},
			});
		} else {
			await db.subscription.update({
				where: { id: subscription.id },
				data: { restaurantId: restaurant.id },
			});
		}

		await db.user.update({
			where: { id: user.id },
			data: { onboardingStatus: OnboardingStatus.COMPLETE },
		});

		await sendRestaurantWelcomeEmail({
			to: user.email,
			restaurantName: restaurant.name,
			dashboardUrl: `${env.NEXT_PUBLIC_APP_URL}/dashboard/${restaurant.slug}`,
		});

		captureServerEvent("restaurant_signup_completed", user.id, {
			restaurantId: restaurant.id,
			slug: restaurant.slug,
		});

		redirect(`/dashboard/${restaurant.slug}`);
	});
}
