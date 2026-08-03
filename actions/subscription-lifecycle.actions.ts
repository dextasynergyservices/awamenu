"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { env } from "@/env";
import { requireUser } from "@/lib/auth-guards";
import { parseBillingInterval } from "@/lib/billing";
import { db } from "@/lib/db";
import { initiateSubscriptionPayment } from "@/lib/payments";

const downgradeSchema = z.object({
	restaurantId: z.string().min(1),
	keepCategoryIds: z.array(z.string().min(1)),
});

/**
 * The Free plan doesn't need a real billing cycle, so it's given a period
 * end far in the future rather than forcing the owner back through this
 * flow every month.
 */
function freeTierPeriodEnd(from: Date) {
	const end = new Date(from);
	end.setFullYear(end.getFullYear() + 100);
	return end;
}

/**
 * A restaurant owner's subscription lapsed and they chose to continue on
 * the Free plan instead of renewing/upgrading. They pick up to the Free
 * plan's actual category limit to keep visible; every other currently-active
 * category is hidden (marked `hiddenByDowngrade` so a later renewal knows to
 * restore exactly these, not categories the owner had already hidden
 * themselves for unrelated reasons).
 */
export async function downgradeToFreeAction(formData: FormData) {
	const user = await requireUser();
	const input = downgradeSchema.parse({
		restaurantId: formData.get("restaurantId"),
		keepCategoryIds: formData.getAll("keepCategoryIds"),
	});

	const restaurant = await db.restaurant.findFirst({
		where: { id: input.restaurantId, ownerId: user.id },
		select: { id: true, slug: true, subscription: { select: { id: true } } },
	});
	if (!restaurant) throw new Error("Restaurant not found.");

	const freePlan = await db.plan.findUniqueOrThrow({ where: { tier: "FREE" } });

	if (
		freePlan.maxCategories >= 0 &&
		input.keepCategoryIds.length > freePlan.maxCategories
	) {
		throw new Error(
			`The Free plan only allows ${freePlan.maxCategories} categories.`,
		);
	}

	if (input.keepCategoryIds.length > 0) {
		const ownedCount = await db.menuCategory.count({
			where: {
				id: { in: input.keepCategoryIds },
				restaurantId: input.restaurantId,
			},
		});
		if (ownedCount !== input.keepCategoryIds.length) {
			throw new Error("Please choose only your own categories.");
		}
	}

	const now = new Date();

	await db.$transaction([
		db.menuCategory.updateMany({
			where: {
				restaurantId: input.restaurantId,
				id: { notIn: input.keepCategoryIds },
				isActive: true,
			},
			data: { isActive: false, hiddenByDowngrade: true },
		}),
		...(input.keepCategoryIds.length > 0
			? [
					db.menuCategory.updateMany({
						where: { id: { in: input.keepCategoryIds } },
						data: { isActive: true, hiddenByDowngrade: false },
					}),
				]
			: []),
		restaurant.subscription
			? db.subscription.update({
					where: { id: restaurant.subscription.id },
					data: {
						planId: freePlan.id,
						status: "ACTIVE",
						billingInterval: "MONTHLY",
						currentPeriodStart: now,
						currentPeriodEnd: freeTierPeriodEnd(now),
						paystackSubscriptionCode: null,
					},
				})
			: db.subscription.create({
					data: {
						userId: user.id,
						restaurantId: input.restaurantId,
						planId: freePlan.id,
						status: "ACTIVE",
						billingInterval: "MONTHLY",
						currentPeriodStart: now,
						currentPeriodEnd: freeTierPeriodEnd(now),
					},
				}),
	]);

	revalidatePath(`/dashboard/${restaurant.slug}`);
	revalidatePath(`/${restaurant.slug}`);
	redirect(`/dashboard/${restaurant.slug}`);
}

const renewSchema = z.object({
	restaurantId: z.string().min(1),
	planId: z.string().min(1),
	billingInterval: z
		.enum(["MONTHLY", "QUARTERLY", "YEARLY"])
		.default("MONTHLY"),
	slug: z.string().min(1),
});

/**
 * Charges the owner to renew (same plan) or upgrade (different plan) after
 * a lapse. Always goes through Paystack checkout — unlike a normal in-cycle
 * plan change, a lapsed subscription always needs a fresh charge, so this
 * doesn't reuse `changePlanAction`'s "downgrade updates in place, upgrade
 * charges" branching.
 *
 * The callback points at a dedicated route handler (not the settings page
 * directly) because the settings page sits behind the dashboard layout's
 * subscription gate — which, at the moment Paystack redirects back, still
 * sees the *old*, lapsed subscription and would never let the page's own
 * verification code run. See app/api/billing/verify-return/route.ts.
 */
export async function renewOrUpgradeAction(formData: FormData) {
	const user = await requireUser();
	const input = renewSchema.parse({
		restaurantId: formData.get("restaurantId"),
		planId: formData.get("planId"),
		billingInterval: parseBillingInterval(formData.get("billingInterval")),
		slug: formData.get("slug"),
	});

	const restaurant = await db.restaurant.findFirst({
		where: { id: input.restaurantId, ownerId: user.id },
		select: { id: true },
	});
	if (!restaurant) throw new Error("Restaurant not found.");

	const url = await initiateSubscriptionPayment({
		userId: user.id,
		planId: input.planId,
		billingInterval: input.billingInterval,
		customerEmail: user.email,
		restaurantId: input.restaurantId,
		callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/api/billing/verify-return?planId=${input.planId}&billing=${input.billingInterval}&slug=${input.slug}`,
	});

	redirect(url);
}
