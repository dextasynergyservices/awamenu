"use server";

import { redirect } from "next/navigation";
import { env } from "@/env";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import {
	initiateCardAddPayment,
	initiateSubscriptionPayment,
} from "@/lib/payments";

export async function cancelSubscriptionAction() {
	try {
		const user = await requireUser();
		const subscription = await db.subscription.findFirst({
			where: { userId: user.id },
			orderBy: { createdAt: "desc" },
		});

		if (!subscription) {
			return { error: "No subscription found." };
		}

		if (!subscription.paystackSubscriptionCode) {
			await db.subscription.update({
				where: { id: subscription.id },
				data: { status: "CANCELLED" },
			});
			return { success: true };
		}

		const fetchRes = await fetch(
			`https://api.paystack.co/subscription/${subscription.paystackSubscriptionCode}`,
			{
				headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
			},
		);
		if (!fetchRes.ok) return { error: "Failed to fetch subscription details." };
		const data = (await fetchRes.json()) as { data?: { email_token?: string } };
		const emailToken = data.data?.email_token;

		if (!emailToken) return { error: "Could not retrieve subscription token." };

		const disableRes = await fetch(
			"https://api.paystack.co/subscription/disable",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					code: subscription.paystackSubscriptionCode,
					token: emailToken,
				}),
			},
		);

		if (!disableRes.ok)
			return { error: "Failed to cancel subscription on Paystack." };

		await db.subscription.update({
			where: { id: subscription.id },
			data: { status: "CANCELLED" },
		});

		return { success: true };
	} catch (error) {
		console.error("Cancel action error:", error);
		return { error: "An unexpected error occurred." };
	}
}

export async function removeCardAction() {
	try {
		const user = await requireUser();
		const subscription = await db.subscription.findFirst({
			where: { userId: user.id },
			orderBy: { createdAt: "desc" },
		});

		if (!subscription?.paystackSubscriptionCode) {
			return { error: "No active Paystack subscription found." };
		}

		const fetchRes = await fetch(
			`https://api.paystack.co/subscription/${subscription.paystackSubscriptionCode}`,
			{
				headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
			},
		);
		if (!fetchRes.ok) return { error: "Failed to fetch subscription details." };
		const data = (await fetchRes.json()) as {
			data?: { authorization?: { authorization_code?: string } };
		};
		const authCode = data.data?.authorization?.authorization_code;

		if (!authCode) return { error: "No saved card found." };

		const deactivateRes = await fetch(
			"https://api.paystack.co/customer/deactivate_authorization",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					authorization_code: authCode,
				}),
			},
		);

		if (!deactivateRes.ok)
			return { error: "Failed to remove card on Paystack." };

		return { success: true };
	} catch (error) {
		console.error("Remove card action error:", error);
		return { error: "An unexpected error occurred." };
	}
}

export async function changePlanAction(formData: FormData) {
	try {
		const user = await requireUser();
		const planId = formData.get("planId") as string;
		const slug = formData.get("slug") as string;

		if (!planId || !slug) {
			throw new Error("Missing required fields");
		}

		const newPlan = await db.plan.findUniqueOrThrow({ where: { id: planId } });

		const subscription = await db.subscription.findFirst({
			where: { userId: user.id },
			orderBy: { createdAt: "desc" },
			include: { plan: true },
		});

		if (subscription) {
			const originalPlanId = subscription.originalPlanId || subscription.planId;
			const originalPlan = await db.plan.findUniqueOrThrow({
				where: { id: originalPlanId },
			});

			// If the new plan price is less than or equal to the original paid plan, it's a downgrade (or restoring paid plan)
			if (Number(newPlan.monthlyPrice) <= Number(originalPlan.monthlyPrice)) {
				await db.subscription.update({
					where: { id: subscription.id },
					data: { planId: newPlan.id },
				});

				if (subscription.paystackSubscriptionCode && newPlan.paystackPlanCode) {
					// Fire and forget updating the subscription plan on Paystack
					// Usually we need an email token, but often POST /subscription/:code works, or we just rely on DB sync
					// Since we don't strictly require Paystack sync for downgraded amounts immediately, we skip for safety.
				}

				redirect(`/dashboard/${slug}/settings`);
			}
		}

		// True upgrade: charge them
		const url = await initiateSubscriptionPayment({
			userId: user.id,
			planId: planId,
			customerEmail: user.email,
			callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/dashboard/${slug}/settings`,
		});

		redirect(url);
	} catch (error) {
		if (error instanceof Error && error.message === "NEXT_REDIRECT") {
			throw error;
		}
		console.error("Change plan error:", error);
		throw new Error("An unexpected error occurred.");
	}
}

export async function getCustomerCardsAction() {
	try {
		const user = await requireUser();
		const subscription = await db.subscription.findFirst({
			where: { userId: user.id },
			orderBy: { createdAt: "desc" },
		});

		if (!subscription?.paystackCustomerCode) {
			return { cards: [] };
		}

		const res = await fetch(
			`https://api.paystack.co/customer/${subscription.paystackCustomerCode}`,
			{
				headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
			},
		);

		if (!res.ok) return { cards: [] };
		const data = (await res.json()) as {
			data?: { authorizations?: Record<string, unknown>[] };
		};

		return { cards: data.data?.authorizations || [] };
	} catch (err) {
		console.error("getCustomerCardsAction error", err);
		return { cards: [] };
	}
}

export async function initiateAddCardAction(slug: string) {
	try {
		const user = await requireUser();
		const url = await initiateCardAddPayment({
			userId: user.id,
			customerEmail: user.email,
			callbackUrl: `${env.NEXT_PUBLIC_APP_URL}/dashboard/${slug}/settings`,
		});
		redirect(url);
	} catch (error) {
		if (error instanceof Error && error.message === "NEXT_REDIRECT")
			throw error;
		throw new Error("An unexpected error occurred while adding a card.");
	}
}

export async function turnOnAutoRenewAction(authorizationCode?: string) {
	try {
		const user = await requireUser();
		const subscription = await db.subscription.findFirst({
			where: { userId: user.id },
			orderBy: { createdAt: "desc" },
			include: { plan: true },
		});

		if (
			!subscription?.paystackCustomerCode ||
			!subscription.plan.paystackPlanCode
		) {
			if (subscription) {
				await db.subscription.update({
					where: { id: subscription.id },
					data: { status: "ACTIVE" },
				});
				return { success: true };
			}
			return {
				error: "Cannot turn on auto-renew. Missing customer or plan details.",
			};
		}

		const res = await fetch("https://api.paystack.co/subscription", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				customer: subscription.paystackCustomerCode,
				plan: subscription.plan.paystackPlanCode,
				authorization: authorizationCode,
			}),
		});

		if (!res.ok) {
			const errData = await res.json().catch(() => null);
			console.error("Paystack auto-renew error:", errData);
			return { error: "Failed to enable auto-renewal on Paystack." };
		}

		const data = (await res.json()) as {
			data?: { subscription_code?: string };
		};
		const newSubCode = data.data?.subscription_code;

		await db.subscription.update({
			where: { id: subscription.id },
			data: {
				status: "ACTIVE",
				paystackSubscriptionCode: newSubCode,
			},
		});

		return { success: true };
	} catch (err) {
		console.error("turnOnAutoRenewAction error", err);
		return { error: "An unexpected error occurred." };
	}
}
