"use server";

import { OnboardingStatus, PlanTier, SubscriptionStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/env";
import { captureServerEvent } from "@/lib/analytics";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { sendRestaurantWelcomeEmail } from "@/lib/email";
import { initiateSubscriptionPayment } from "@/lib/payments";

const choosePlanSchema = z.object({
	planId: z.string().cuid(),
});

const setupSchema = z.object({
	planId: z.string().cuid().optional(),
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

export async function choosePlanAction(formData: FormData) {
	const user = await requireUser();
	const input = choosePlanSchema.parse({
		planId: formData.get("planId"),
	});
	const plan = await db.plan.findUniqueOrThrow({ where: { id: input.planId } });

	if (plan.tier === PlanTier.FREE) {
		await db.user.update({
			where: { id: user.id },
			data: { onboardingStatus: OnboardingStatus.PENDING_SETUP },
		});
		redirect(`/onboarding/setup?planId=${plan.id}`);
	}

	await db.user.update({
		where: { id: user.id },
		data: { onboardingStatus: OnboardingStatus.PENDING_PAYMENT },
	});
	redirect(`/onboarding/checkout?planId=${plan.id}`);
}

export async function startSubscriptionCheckoutAction(formData: FormData) {
	const user = await requireUser();
	const input = choosePlanSchema.parse({
		planId: formData.get("planId"),
	});
	const authorizationUrl = await initiateSubscriptionPayment({
		userId: user.id,
		planId: input.planId,
		customerEmail: user.email,
	});

	redirect(authorizationUrl);
}

export async function completeSetupAction(formData: FormData) {
	const user = await requireUser();
	const input = setupSchema.parse({
		planId: formData.get("planId") || undefined,
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
		throw new Error("Restaurant slug is already taken.");
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
			status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
		},
		orderBy: { createdAt: "desc" },
	});

	if (!subscription) {
		const plan = input.planId
			? await db.plan.findUniqueOrThrow({ where: { id: input.planId } })
			: await db.plan.findUniqueOrThrow({ where: { tier: PlanTier.FREE } });
		const now = new Date();
		const periodEnd = new Date(now);
		periodEnd.setMonth(periodEnd.getMonth() + 1);

		subscription = await db.subscription.create({
			data: {
				userId: user.id,
				planId: plan.id,
				restaurantId: restaurant.id,
				status: SubscriptionStatus.ACTIVE,
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
}
