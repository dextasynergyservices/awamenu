import { OnboardingStatus, Prisma, SubscriptionStatus } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/env";
import { captureServerEvent } from "@/lib/analytics";
import {
	addBillingPeriod,
	type BillingIntervalValue,
	getPlanIntervalPrice,
} from "@/lib/billing";
import { billingStateOf } from "@/lib/billing-state";
import { db } from "@/lib/db";
import { formatInTimeZone } from "@/lib/zoned-time";

/**
 * Applies a subscription charge — the one place a billing period is extended.
 *
 * Three paths used to do this independently (the webhook, the billing return
 * route, and the settings/onboarding pages reading `?reference=` from the URL),
 * with two problems:
 *
 * - **Not idempotent.** Every replay started a fresh period from "now".
 *   Paystack retries webhooks for days, and a return link reopened a month
 *   later did the same, so a monthly plan could be stretched indefinitely.
 * - **Amount never checked.** Paystack transactions can be initialised by
 *   anyone with the public key, with any amount and metadata. A ₦1 charge
 *   tagged `type: SUBSCRIPTION, planId: <Pro>` arrived correctly signed and
 *   granted Pro.
 *
 * Now the charge's reference is claimed in the SubscriptionPayment ledger
 * first. The unique (gateway, reference) means exactly one caller applies it,
 * and only that caller sends emails.
 */

export type SubscriptionCharge = {
	reference: string;
	/** Minor units (kobo), as the provider reported them. */
	paidMinorUnits: number;
	currency: string;
	userId: string;
	planId: string;
	billingInterval: BillingIntervalValue;
	restaurantId?: string | null;
	customerCode?: string | null;
	subscriptionCode?: string | null;
	rawPayload?: unknown;
} & (
	| { kind: "INITIAL" }
	/** A Paystack recurring charge for an existing subscription row. */
	| { kind: "RENEWAL"; subscriptionId: string }
);

export type SubscriptionChargeResult =
	| {
			ok: true;
			/** False when this charge had already been applied — a replay. */
			applied: boolean;
	  }
	| {
			ok: false;
			reason: "INVALID" | "PLAN_NOT_FOUND" | "AMOUNT_MISMATCH";
			message: string;
	  };

/**
 * Inserts the ledger row. Returns the existing row's status when this
 * reference was already claimed.
 */
async function claim(
	charge: SubscriptionCharge,
	values: {
		amount: number;
		expectedAmount: number;
		status: "SUCCESS" | "MISMATCH";
		note?: string;
	},
): Promise<{ won: true; id: string } | { won: false; status: string }> {
	// Looked up first only so a replay doesn't make Prisma log an error; the
	// unique index is what settles a genuine race, in the catch below.
	const seen = await db.subscriptionPayment.findUnique({
		where: {
			gateway_reference: { gateway: "PAYSTACK", reference: charge.reference },
		},
		select: { status: true },
	});
	if (seen) return { won: false, status: seen.status };

	try {
		const row = await db.subscriptionPayment.create({
			data: {
				gateway: "PAYSTACK",
				reference: charge.reference,
				userId: charge.userId,
				planId: charge.planId,
				restaurantId: charge.restaurantId ?? null,
				subscriptionId:
					charge.kind === "RENEWAL" ? charge.subscriptionId : null,
				billingInterval: charge.billingInterval,
				kind: charge.kind,
				amount: values.amount,
				expectedAmount: values.expectedAmount,
				currency: charge.currency.toUpperCase(),
				status: values.status,
				note: values.note ?? null,
				rawPayload: (charge.rawPayload ?? Prisma.JsonNull) as never,
			},
			select: { id: true },
		});
		return { won: true, id: row.id };
	} catch (error) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			const existing = await db.subscriptionPayment.findUnique({
				where: {
					gateway_reference: {
						gateway: "PAYSTACK",
						reference: charge.reference,
					},
				},
				select: { status: true },
			});
			return { won: false, status: existing?.status ?? "SUCCESS" };
		}
		throw error;
	}
}

export async function applySubscriptionCharge(
	charge: SubscriptionCharge,
): Promise<SubscriptionChargeResult> {
	if (!charge.reference) {
		return { ok: false, reason: "INVALID", message: "Missing reference." };
	}

	const plan = await db.plan.findUnique({
		where: { id: charge.planId },
		select: {
			id: true,
			name: true,
			monthlyPrice: true,
			quarterlyPrice: true,
			yearlyPrice: true,
		},
	});
	if (!plan) {
		return {
			ok: false,
			reason: "PLAN_NOT_FOUND",
			message: "That plan no longer exists.",
		};
	}

	const expected = getPlanIntervalPrice(plan, charge.billingInterval);
	const paid = charge.paidMinorUnits / 100;
	const wrongCurrency = charge.currency.toUpperCase() !== "NGN";
	// Compared in kobo so float rounding can't refuse an exact payment.
	const short = charge.paidMinorUnits < Math.round(expected * 100);

	if (wrongCurrency || short) {
		const note = wrongCurrency
			? `Paid in ${charge.currency}, expected NGN`
			: `Paid ₦${paid} against ₦${expected} for ${plan.name} (${charge.billingInterval})`;
		const claimed = await claim(charge, {
			amount: paid,
			expectedAmount: expected,
			status: "MISMATCH",
			note,
		});
		if (claimed.won) {
			// Real money, refused access. Someone must look: either a tampered
			// checkout, or a Paystack plan whose price drifted from the database.
			Sentry.captureMessage("Subscription charge refused: amount mismatch", {
				level: "error",
				extra: { reference: charge.reference, userId: charge.userId, note },
			});
			console.error(
				`[subscription-payment] refused ${charge.reference}: ${note}`,
			);
		}
		return { ok: false, reason: "AMOUNT_MISMATCH", message: note };
	}

	const claimed = await claim(charge, {
		amount: paid,
		expectedAmount: expected,
		status: "SUCCESS",
	});
	if (!claimed.won) {
		return claimed.status === "SUCCESS"
			? { ok: true, applied: false }
			: {
					ok: false,
					reason: "AMOUNT_MISMATCH",
					message: "This payment was refused earlier.",
				};
	}

	// Was the restaurant read-only before this payment? Then it's a
	// reactivation, and the owner gets a "you're back" email too.
	const wasLapsed = await isRestaurantLapsed(charge.restaurantId);

	const subscriptionId =
		charge.kind === "RENEWAL"
			? await applyRenewal(charge)
			: await applyInitial(charge);

	if (subscriptionId) {
		await db.subscriptionPayment.update({
			where: { id: claimed.id },
			data: { subscriptionId },
		});
	}

	await notifyApplied(charge, plan.name);
	if (wasLapsed && charge.restaurantId) {
		await notifyReactivated(charge.userId, charge.restaurantId);
	}
	return { ok: true, applied: true };
}

async function isRestaurantLapsed(restaurantId: string | null | undefined) {
	if (!restaurantId) return false;
	const subscription = await db.subscription.findUnique({
		where: { restaurantId },
		select: {
			currentPeriodEnd: true,
			billingInterval: true,
			plan: {
				select: { monthlyPrice: true, quarterlyPrice: true, yearlyPrice: true },
			},
		},
	});
	return billingStateOf(subscription) === "LAPSED";
}

/** Never throws: the payment is already applied. */
async function notifyReactivated(userId: string, restaurantId: string) {
	try {
		const [user, restaurant] = await Promise.all([
			db.user.findUnique({ where: { id: userId }, select: { email: true } }),
			db.restaurant.findUnique({
				where: { id: restaurantId },
				select: { name: true, slug: true },
			}),
		]);
		if (!user || !restaurant) return;
		const email = await import("@/lib/email");
		await email.sendReactivationEmail({
			to: user.email,
			restaurantName: restaurant.name,
			dashboardUrl: `${env.NEXT_PUBLIC_APP_URL}/dashboard/${restaurant.slug}`,
		});
	} catch (error) {
		Sentry.captureException(error, {
			tags: { component: "subscription-reactivation-email" },
		});
	}
}

/** Starts a period for a checkout: new plan, upgrade, or renewing after lapse. */
async function applyInitial(
	charge: SubscriptionCharge & { kind: "INITIAL" },
): Promise<string> {
	const now = new Date();

	// Deliberately not filtered by planId — that is what changes on an upgrade.
	// Scoped to this restaurant, or to the owner's not-yet-attached onboarding
	// subscription. (The webhook used to cancel *every* active subscription of
	// the user here, which cancelled an owner's other restaurants when they
	// onboarded a second one.)
	const existing = await db.subscription.findFirst({
		where: charge.restaurantId
			? { restaurantId: charge.restaurantId }
			: { userId: charge.userId, restaurantId: null },
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			restaurantId: true,
			planId: true,
			billingInterval: true,
			currentPeriodEnd: true,
		},
	});

	// When the new period starts:
	// - Renewing the same plan and interval early (still in date): from the
	//   current end, so the days already paid for aren't lost.
	// - After a lapse, or changing plan: from today (the payment date). A
	//   lapsed owner doesn't pay for the weeks they couldn't trade.
	const isEarlySameRenewal =
		existing !== null &&
		existing.planId === charge.planId &&
		existing.billingInterval === charge.billingInterval &&
		existing.currentPeriodEnd.getTime() > now.getTime();
	const periodStart = isEarlySameRenewal ? existing.currentPeriodEnd : now;
	const periodData = {
		planId: charge.planId,
		originalPlanId: charge.planId,
		status: SubscriptionStatus.ACTIVE,
		billingInterval: charge.billingInterval,
		currentPeriodStart: periodStart,
		currentPeriodEnd: addBillingPeriod(periodStart, charge.billingInterval),
		paymentRef: charge.reference,
		paystackCustomerCode: charge.customerCode ?? undefined,
		paystackSubscriptionCode: charge.subscriptionCode ?? undefined,
		// A new period, so the previous period's expiry-notice ladder resets.
		lastExpiryNoticeStage: null,
	};

	let subscriptionId: string;
	if (existing) {
		await db.subscription.update({
			where: { id: existing.id },
			data: periodData,
		});
		subscriptionId = existing.id;
	} else {
		const created = await db.subscription.create({
			data: {
				...periodData,
				userId: charge.userId,
				restaurantId: charge.restaurantId ?? null,
			},
			select: { id: true },
		});
		subscriptionId = created.id;
	}

	if (charge.restaurantId) {
		await restoreDowngradedCategories(charge.restaurantId);
	} else {
		// Only onboarding has no restaurant yet. An owner upgrading has already
		// finished onboarding, and resetting their status would bounce them back
		// into the setup wizard.
		await db.user.update({
			where: { id: charge.userId },
			data: { onboardingStatus: OnboardingStatus.PENDING_SETUP },
		});
	}

	return subscriptionId;
}

async function applyRenewal(
	charge: SubscriptionCharge & { kind: "RENEWAL" },
): Promise<string> {
	const now = new Date();
	const before = await db.subscription.findUniqueOrThrow({
		where: { id: charge.subscriptionId },
		select: { id: true, restaurantId: true, lastExpiryNoticeStage: true },
	});

	await db.subscription.update({
		where: { id: before.id },
		data: {
			status: SubscriptionStatus.ACTIVE,
			currentPeriodStart: now,
			currentPeriodEnd: addBillingPeriod(now, charge.billingInterval),
			paymentRef: charge.reference,
			lastExpiryNoticeStage: null,
		},
	});

	if (before.restaurantId) {
		await restoreDowngradedCategories(before.restaurantId);
	}
	return before.id;
}

/** Restores exactly the categories a forced Free downgrade hid. */
async function restoreDowngradedCategories(restaurantId: string) {
	await db.menuCategory.updateMany({
		where: { restaurantId, hiddenByDowngrade: true },
		data: { isActive: true, hiddenByDowngrade: false },
	});
}

/** Sent once, by the caller that applied the charge. Never throws. */
async function notifyApplied(charge: SubscriptionCharge, planName: string) {
	try {
		const user = await db.user.findUnique({
			where: { id: charge.userId },
			select: { email: true },
		});
		if (!user) return;

		const email = await import("@/lib/email");
		if (charge.kind === "RENEWAL") {
			captureServerEvent("subscription_renewed", charge.userId, {
				planId: charge.planId,
				planName,
				billingInterval: charge.billingInterval,
				amount: charge.paidMinorUnits / 100,
			});
			const restaurant = charge.restaurantId
				? await db.restaurant.findUnique({
						where: { id: charge.restaurantId },
						select: {
							name: true,
							slug: true,
							timezone: true,
							subscription: { select: { currentPeriodEnd: true } },
						},
					})
				: null;
			if (restaurant) {
				await email.sendRenewalSuccessEmail({
					to: user.email,
					restaurantName: restaurant.name,
					amount: `₦${(charge.paidMinorUnits / 100).toLocaleString()}`,
					planName,
					restaurantSlug: restaurant.slug,
					periodEnd: restaurant.subscription?.currentPeriodEnd
						? formatInTimeZone(
								restaurant.subscription.currentPeriodEnd,
								restaurant.timezone,
								{ day: "numeric", month: "long", year: "numeric" },
								"en-GB",
							)
						: null,
				});
			}
		} else {
			await email.sendSubscriptionConfirmationEmail({
				to: user.email,
				planName,
			});
			captureServerEvent("subscription_completed", charge.userId, {
				planId: charge.planId,
				planName,
				billingInterval: charge.billingInterval,
			});
		}
	} catch (error) {
		Sentry.captureException(error, {
			tags: { component: "subscription-payment-email" },
		});
	}
}
