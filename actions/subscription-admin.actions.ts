"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { env } from "@/env";
import { ActionError, actionResult, parseInput } from "@/lib/action-error";
import { recordAuditLog } from "@/lib/audit-log";
import { requireSuperAdmin } from "@/lib/auth-guards";
import {
	addBillingPeriod,
	getPlanIntervalPrice,
	parseBillingInterval,
} from "@/lib/billing";
import {
	billingStateOf,
	daysLeft,
	isAutoRenewing,
	subscriptionPrice,
} from "@/lib/billing-state";
import { db } from "@/lib/db";
import { disablePaystackSubscription } from "@/lib/paystack-subscriptions";
import { revalidatePublicMenu } from "@/lib/public-menu";

/**
 * Billing operations a super admin can run on one subscription: extend it,
 * record an offline payment, change its plan, nudge the owner, or stop
 * auto-renew. Every one is audited with who did it and why.
 */

const DAY = 86_400_000;

const subscriptionSelect = {
	id: true,
	status: true,
	planId: true,
	billingInterval: true,
	currentPeriodStart: true,
	currentPeriodEnd: true,
	paystackSubscriptionCode: true,
	userId: true,
	user: { select: { email: true } },
	restaurant: { select: { id: true, name: true, slug: true } },
	plan: {
		select: {
			name: true,
			monthlyPrice: true,
			quarterlyPrice: true,
			yearlyPrice: true,
		},
	},
} as const;

async function loadSubscription(id: string) {
	const sub = await db.subscription.findUnique({
		where: { id },
		select: subscriptionSelect,
	});
	if (!sub) throw new ActionError("Subscription not found.");
	return sub;
}

function label(sub: Awaited<ReturnType<typeof loadSubscription>>) {
	return sub.restaurant?.name ?? sub.user.email;
}

function refresh(sub: Awaited<ReturnType<typeof loadSubscription>>) {
	revalidatePath("/super-admin/subscriptions");
	revalidatePath("/super-admin/payments");
	revalidatePath("/super-admin");
	if (sub.restaurant) {
		revalidatePath(`/super-admin/restaurants/${sub.restaurant.id}`);
		revalidatePath(`/dashboard/${sub.restaurant.slug}`, "layout");
	}
}

/** Categories hidden by a forced Free downgrade come back with a paid period. */
async function restoreCategories(
	sub: Awaited<ReturnType<typeof loadSubscription>>,
) {
	if (!sub.restaurant) return;
	await db.menuCategory.updateMany({
		where: { restaurantId: sub.restaurant.id, hiddenByDowngrade: true },
		data: { isActive: true, hiddenByDowngrade: false },
	});
	revalidatePublicMenu(sub.restaurant.slug);
}

const day = (d: Date) =>
	new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(d);

// ─── Extend ───────────────────────────────────────────

const extendSchema = z.object({
	subscriptionId: z.string().min(1),
	days: z.coerce
		.number()
		.int()
		.min(1, "At least 1 day.")
		.max(366, "At most a year."),
	reason: z.string().trim().min(3, "Say why, for the audit log.").max(300),
});

/**
 * Free days (goodwill, an outage, a deal). Added to the current end date, or
 * to today if the plan has already ended, so the owner always gets the days.
 */
export async function extendSubscriptionAction(formData: FormData) {
	return actionResult(async () => {
		const admin = await requireSuperAdmin();
		const input = parseInput(extendSchema, Object.fromEntries(formData));
		const sub = await loadSubscription(input.subscriptionId);
		if (subscriptionPrice(sub) <= 0) {
			throw new ActionError(
				"Free plans don't expire, so there's nothing to extend.",
			);
		}

		const from = Math.max(sub.currentPeriodEnd.getTime(), Date.now());
		const end = new Date(from + input.days * DAY);
		await db.subscription.update({
			where: { id: sub.id },
			data: { currentPeriodEnd: end, lastExpiryNoticeStage: null },
		});
		await restoreCategories(sub);
		await recordAuditLog({
			adminId: admin.id,
			adminName: admin.name ?? admin.email,
			action: "Subscription Extended",
			target: `${label(sub)}: +${input.days} day${input.days === 1 ? "" : "s"} to ${day(end)} (${input.reason})`,
		});
		refresh(sub);
	});
}

// ─── Offline payment ──────────────────────────────────

const OFFLINE_METHODS = ["BANK_TRANSFER", "CASH", "COMPLIMENTARY"] as const;

const offlineSchema = z.object({
	subscriptionId: z.string().min(1),
	planId: z.string().min(1),
	interval: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
	method: z.enum(OFFLINE_METHODS),
	amount: z.coerce.number().min(0).max(100_000_000),
	reference: z.string().trim().max(120).optional(),
	note: z.string().trim().max(300).optional(),
});

/**
 * Records a payment made outside checkout (a bank transfer to AwaMenu, cash,
 * or a complimentary period) and starts the paid period, exactly as an
 * online renewal would: from today after a lapse or plan change, or from the
 * current end when renewing the same plan early. It appears on the owner's
 * invoices like any other payment.
 */
export async function recordOfflinePaymentAction(formData: FormData) {
	return actionResult(async () => {
		const admin = await requireSuperAdmin();
		const input = parseInput(offlineSchema, {
			...Object.fromEntries(formData),
			reference: formData.get("reference") || undefined,
			note: formData.get("note") || undefined,
		});
		const sub = await loadSubscription(input.subscriptionId);
		const plan = await db.plan.findUnique({ where: { id: input.planId } });
		if (!plan) throw new ActionError("Plan not found.");

		const interval = parseBillingInterval(input.interval);
		const listPrice = getPlanIntervalPrice(plan, interval);
		if (listPrice <= 0) {
			throw new ActionError(
				"Choose a paid plan; free plans don't need a payment.",
			);
		}
		if (input.method !== "COMPLIMENTARY" && input.amount <= 0) {
			throw new ActionError("Enter the amount received.");
		}
		const amount = input.method === "COMPLIMENTARY" ? 0 : input.amount;

		const now = new Date();
		const wasLapsed = billingStateOf(sub) === "LAPSED";
		const earlySameRenewal =
			sub.planId === plan.id &&
			sub.billingInterval === interval &&
			sub.currentPeriodEnd.getTime() > now.getTime();
		const start = earlySameRenewal ? sub.currentPeriodEnd : now;
		const end = addBillingPeriod(start, interval);
		const reference = `manual-${input.reference ? `${input.reference}-` : ""}${randomUUID().slice(0, 8)}`;

		await db.$transaction([
			db.subscriptionPayment.create({
				data: {
					reference,
					userId: sub.userId,
					planId: plan.id,
					restaurantId: sub.restaurant?.id ?? null,
					subscriptionId: sub.id,
					billingInterval: interval,
					kind: "RENEWAL",
					amount,
					expectedAmount: listPrice,
					status: "SUCCESS",
					method: input.method,
					recordedById: admin.id,
					note: input.note ?? null,
				},
			}),
			db.subscription.update({
				where: { id: sub.id },
				data: {
					planId: plan.id,
					originalPlanId: plan.id,
					billingInterval: interval,
					currentPeriodStart: start,
					currentPeriodEnd: end,
					paymentRef: reference,
					lastExpiryNoticeStage: null,
				},
			}),
		]);
		await restoreCategories(sub);

		await recordAuditLog({
			adminId: admin.id,
			adminName: admin.name ?? admin.email,
			action: "Offline Payment Recorded",
			target: `${label(sub)}: ${plan.name} ${interval.toLowerCase()}, ₦${amount.toLocaleString()} (${input.method.replace("_", " ").toLowerCase()}) until ${day(end)}`,
		});

		// Receipt to the owner, plus "you're back" after a lapse. Never fails
		// the action: the payment is already recorded.
		if (sub.restaurant) {
			const email = await import("@/lib/email");
			try {
				await email.sendRenewalSuccessEmail({
					to: sub.user.email,
					restaurantName: sub.restaurant.name,
					restaurantSlug: sub.restaurant.slug,
					amount: `₦${amount.toLocaleString()}`,
					planName: plan.name,
					periodEnd: day(end),
				});
				if (wasLapsed) {
					await email.sendReactivationEmail({
						to: sub.user.email,
						restaurantName: sub.restaurant.name,
						dashboardUrl: `${env.NEXT_PUBLIC_APP_URL}/dashboard/${sub.restaurant.slug}`,
					});
				}
			} catch {
				// Logged by the outbox.
			}
		}
		refresh(sub);
	});
}

// ─── Change plan ──────────────────────────────────────

const changeSchema = z.object({
	subscriptionId: z.string().min(1),
	planId: z.string().min(1),
	interval: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
	reason: z.string().trim().min(3, "Say why, for the audit log.").max(300),
});

/**
 * Moves a subscription to another plan or interval without a payment (a
 * correction, or an upgrade granted as part of a deal). The current end date
 * is kept; collect payment with "Record payment" if one is due.
 */
export async function changeSubscriptionPlanAction(formData: FormData) {
	return actionResult(async () => {
		const admin = await requireSuperAdmin();
		const input = parseInput(changeSchema, Object.fromEntries(formData));
		const sub = await loadSubscription(input.subscriptionId);
		const plan = await db.plan.findUnique({ where: { id: input.planId } });
		if (!plan) throw new ActionError("Plan not found.");
		if (plan.id === sub.planId && input.interval === sub.billingInterval) {
			throw new ActionError("That's already the current plan and interval.");
		}
		if (isAutoRenewing(sub)) {
			throw new ActionError(
				"This subscription auto-renews on Paystack at its old price. Cancel auto-renew first so the owner isn't charged for the wrong plan.",
			);
		}

		const toFree =
			getPlanIntervalPrice(plan, parseBillingInterval(input.interval)) <= 0;
		await db.subscription.update({
			where: { id: sub.id },
			data: {
				planId: plan.id,
				originalPlanId: plan.id,
				billingInterval: input.interval,
				// Free never expires.
				...(toFree
					? { currentPeriodEnd: new Date(Date.now() + 100 * 365 * DAY) }
					: {}),
				lastExpiryNoticeStage: null,
			},
		});
		if (!toFree) await restoreCategories(sub);
		await recordAuditLog({
			adminId: admin.id,
			adminName: admin.name ?? admin.email,
			action: "Plan Changed",
			target: `${label(sub)}: ${sub.plan.name} → ${plan.name} ${input.interval.toLowerCase()} (${input.reason})`,
		});
		refresh(sub);
	});
}

// ─── Reminder ─────────────────────────────────────────

const idSchema = z.object({ subscriptionId: z.string().min(1) });

/** Sends the owner the billing email that fits right now. */
export async function sendBillingReminderAction(formData: FormData) {
	return actionResult(async () => {
		const admin = await requireSuperAdmin();
		const { subscriptionId } = parseInput(
			idSchema,
			Object.fromEntries(formData),
		);
		const sub = await loadSubscription(subscriptionId);
		if (!sub.restaurant)
			throw new ActionError("This subscription has no restaurant yet.");
		const state = billingStateOf(sub);
		const email = await import("@/lib/email");
		const renewUrl = `${env.NEXT_PUBLIC_APP_URL}/dashboard/${sub.restaurant.slug}/renew`;
		const base = { to: sub.user.email, restaurantName: sub.restaurant.name };

		let sent: string;
		if (state === "FREE")
			throw new ActionError("Free plans have nothing to renew.");
		if (state === "LAPSED") {
			await email.sendSuspensionEmail({ ...base, manageBillingUrl: renewUrl });
			sent = "lapsed notice";
		} else if (state === "GRACE") {
			await email.sendGracePeriodEmail({ ...base, manageBillingUrl: renewUrl });
			sent = "grace-period notice";
		} else if (isAutoRenewing(sub)) {
			await email.sendAutoRenewalUpcomingEmail({
				...base,
				daysLeft: Math.max(0, daysLeft(sub.currentPeriodEnd)),
				amount: `₦${subscriptionPrice(sub).toLocaleString()}`,
				manageBillingUrl: `${env.NEXT_PUBLIC_APP_URL}/dashboard/${sub.restaurant.slug}/billing`,
			});
			sent = "auto-renewal notice";
		} else {
			await email.sendUpcomingExpiryEmail({
				...base,
				daysLeft: Math.max(0, daysLeft(sub.currentPeriodEnd)),
				manageBillingUrl: renewUrl,
			});
			sent = "renewal reminder";
		}

		await recordAuditLog({
			adminId: admin.id,
			adminName: admin.name ?? admin.email,
			action: "Billing Reminder Sent",
			target: `${label(sub)}: ${sent} to ${sub.user.email}`,
		});
		refresh(sub);
	});
}

// ─── Cancel auto-renew ────────────────────────────────

const cancelSchema = idSchema.extend({
	reason: z.string().trim().min(3, "Say why, for the audit log.").max(300),
});

/**
 * Stops the card being charged again. The plan keeps working until its end
 * date; then the normal expiry emails and grace period apply.
 */
export async function cancelAutoRenewAction(formData: FormData) {
	return actionResult(async () => {
		const admin = await requireSuperAdmin();
		const input = parseInput(cancelSchema, Object.fromEntries(formData));
		const sub = await loadSubscription(input.subscriptionId);
		if (!isAutoRenewing(sub) || !sub.paystackSubscriptionCode) {
			throw new ActionError("Auto-renew is already off.");
		}
		const result = await disablePaystackSubscription(
			sub.paystackSubscriptionCode,
		);
		if (!result.ok) throw new ActionError(result.error);

		await db.subscription.update({
			where: { id: sub.id },
			data: { status: "CANCELLED" },
		});
		await recordAuditLog({
			adminId: admin.id,
			adminName: admin.name ?? admin.email,
			action: "Auto-renew Cancelled",
			target: `${label(sub)}: ends ${day(sub.currentPeriodEnd)} (${input.reason})`,
		});
		refresh(sub);
	});
}
