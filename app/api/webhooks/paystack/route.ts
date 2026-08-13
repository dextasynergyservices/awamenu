import {
	NotificationAudience,
	NotificationType,
	OnboardingStatus,
	OrderStatus,
	PaymentStatus,
	ReservationStatus,
	SubscriptionStatus,
} from "@prisma/client";
import { NextResponse } from "next/server";
import { captureServerEvent } from "@/lib/analytics";
import {
	addBillingPeriod,
	getPlanIntervalPrice,
	parseBillingInterval,
} from "@/lib/billing";
import { db } from "@/lib/db";
import { sendSubscriptionConfirmationEmail } from "@/lib/email";
import { dispatchNotification } from "@/lib/notifications";
import { notifyOrderConfirmed, notifyOrderPaid } from "@/lib/order-emails";
import { notifyCustomerOrderStatus } from "@/lib/order-messaging";
import { notifyNewOrder } from "@/lib/order-notifications";
import { creditOrder } from "@/lib/payment-ledger";
import { verifyPaystackWebhook } from "@/lib/payments";
import { scheduleReservationExpiry } from "@/lib/qstash";
import { notifyReservationConfirmed } from "@/lib/reservation-emails";

type PaystackWebhook = {
	event?: string;
	data?: {
		reference?: string;
		/** Kobo. Never assume it equals what the order was owed. */
		amount?: number;
		currency?: string;
		fees?: number;
		subaccount?: { subaccount_code?: string };
		metadata?: {
			type?: string;
			userId?: string;
			planId?: string;
			billingInterval?: string;
			restaurantId?: string;
			orderId?: string;
			reservationId?: string;
		};
		customer?: {
			customer_code?: string;
			email?: string;
		};
		subscription?: {
			subscription_code?: string;
		};
		subscription_code?: string;
	};
};

export async function POST(request: Request) {
	const body = await request.text();
	const signature = request.headers.get("x-paystack-signature");

	if (!signature || !verifyPaystackWebhook(body, signature)) {
		return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
	}

	const payload = JSON.parse(body) as PaystackWebhook;

	if (payload.event === "invoice.payment_failed") {
		const subCode = payload.data?.subscription?.subscription_code;
		if (subCode) {
			await db.subscription.updateMany({
				where: { paystackSubscriptionCode: subCode },
				data: { status: SubscriptionStatus.PAST_DUE },
			});
		}
		return NextResponse.json({ ok: true });
	}

	if (payload.event === "subscription.disable") {
		const subCode = payload.data?.subscription_code;
		if (subCode) {
			await db.subscription.updateMany({
				where: { paystackSubscriptionCode: subCode },
				data: { status: SubscriptionStatus.CANCELLED },
			});
		}
		return NextResponse.json({ ok: true });
	}

	if (payload.event !== "charge.success") {
		return NextResponse.json({ ok: true });
	}

	const metadata = payload.data?.metadata;

	if (metadata?.type === "ORDER") {
		if (!metadata.orderId) {
			return NextResponse.json(
				{ error: "Missing order metadata" },
				{ status: 400 },
			);
		}

		const credit = await creditOrder(metadata.orderId, {
			kind: "GATEWAY",
			gateway: "PAYSTACK",
			reference: payload.data?.reference ?? "",
			paidMinorUnits: payload.data?.amount ?? 0,
			currency: payload.data?.currency ?? "NGN",
			gatewayFeeMinorUnits: payload.data?.fees ?? null,
			subaccountCode: payload.data?.subaccount?.subaccount_code ?? null,
			rawPayload: payload.data,
		});

		if (!credit.ok) {
			if (credit.reason === "ORDER_NOT_FOUND") {
				return NextResponse.json({ error: "Order not found" }, { status: 404 });
			}
			// 200 on purpose. The mismatch is already in the ledger, and asking
			// Paystack to retry cannot make a wrong amount right — it would just
			// replay the same disagreement every few minutes.
			console.error(
				`[paystack] refused credit for order ${metadata.orderId}: ${credit.message}`,
			);
			return NextResponse.json({ ok: true, recorded: "mismatch" });
		}

		// Only the caller that actually settled the order notifies, so a replayed
		// webhook cannot send a second receipt.
		if (credit.newlyPaid) {
			await notifyOrderPaid(metadata.orderId, {
				method: "Card or bank transfer",
			});
			await notifyOrderConfirmed(metadata.orderId);
			await notifyCustomerOrderStatus(metadata.orderId, OrderStatus.CONFIRMED);
			await notifyNewOrder(metadata.orderId);
		}

		return NextResponse.json({ ok: true });
	}

	if (metadata?.type === "RESERVATION_PAYMENT") {
		if (!metadata.reservationId) {
			return NextResponse.json(
				{ error: "Missing reservation metadata" },
				{ status: 400 },
			);
		}

		const reservation = await db.reservation.findUnique({
			where: { id: metadata.reservationId },
			select: {
				id: true,
				restaurantId: true,
				preOrderId: true,
				expiresAt: true,
				reservationPaymentStatus: true,
				customerName: true,
				restaurant: { select: { slug: true } },
			},
		});

		if (!reservation) {
			return NextResponse.json(
				{ error: "Reservation not found" },
				{ status: 404 },
			);
		}

		if (reservation.reservationPaymentStatus !== PaymentStatus.PAID) {
			const qstashMessageId = await scheduleReservationExpiry({
				reservationId: reservation.id,
				expiresAt: reservation.expiresAt,
			});

			await db.reservation.update({
				where: { id: reservation.id },
				data: {
					status: ReservationStatus.ACTIVE,
					reservationPaymentStatus: PaymentStatus.PAID,
					reservationPaymentRef: payload.data?.reference,
					qstashMessageId,
				},
			});

			// Claim-guarded, so whichever of this and the customer's return from
			// Paystack arrives first is the only one that emails.
			await notifyReservationConfirmed(reservation.id);

			if (reservation.preOrderId) {
				// The deposit is a percentage of the food total, so this charge is
				// expected to be a part payment. Passing it as the expected amount
				// keeps it out of the mismatch path while leaving the balance owing
				// — the restaurant should not read "paid" for food only 30% covered.
				await creditOrder(reservation.preOrderId, {
					kind: "GATEWAY",
					gateway: "PAYSTACK",
					reference: payload.data?.reference ?? "",
					paidMinorUnits: payload.data?.amount ?? 0,
					expectedMinorUnits: payload.data?.amount ?? 0,
					currency: payload.data?.currency ?? "NGN",
					gatewayFeeMinorUnits: payload.data?.fees ?? null,
					subaccountCode: payload.data?.subaccount?.subaccount_code ?? null,
					rawPayload: payload.data,
				});
			}

			await dispatchNotification({
				restaurantId: reservation.restaurantId,
				type: NotificationType.NEW_RESERVATION,
				audience: NotificationAudience.BOTH,
				title: "Reservation paid",
				body: `${reservation.customerName} completed a table reservation payment`,
				actionUrl: `/dashboard/${reservation.restaurant.slug}/reservations?reservationId=${reservation.id}`,
				metadata: { reservationId: reservation.id },
			});
		}

		return NextResponse.json({ ok: true });
	}

	if (metadata?.type !== "SUBSCRIPTION") {
		// If it's a renewal without metadata but has a subscription_code
		const subCode = payload.data?.subscription?.subscription_code;
		if (subCode) {
			const now = new Date();

			const sub = await db.subscription.findFirst({
				where: { paystackSubscriptionCode: subCode },
				include: {
					user: { select: { email: true } },
					restaurant: { select: { name: true } },
					plan: {
						select: {
							name: true,
							monthlyPrice: true,
							quarterlyPrice: true,
							yearlyPrice: true,
						},
					},
				},
			});

			if (sub) {
				const billingInterval = parseBillingInterval(sub.billingInterval);
				const periodEnd = addBillingPeriod(now, billingInterval);
				await db.subscription.update({
					where: { id: sub.id },
					data: {
						status: SubscriptionStatus.ACTIVE,
						currentPeriodStart: now,
						currentPeriodEnd: periodEnd,
						// Fresh period — reset the expiry notice ladder so the next
						// cycle's warnings are sent again.
						lastExpiryNoticeStage: null,
					},
				});

				if (sub.restaurantId) {
					await db.menuCategory.updateMany({
						where: {
							restaurantId: sub.restaurantId,
							hiddenByDowngrade: true,
						},
						data: { isActive: true, hiddenByDowngrade: false },
					});

					// Lift an automatic non-payment suspension. Scoped to our own
					// suspension marker so a super-admin's manual suspension isn't
					// silently reversed by a renewal charge.
					if (sub.lastExpiryNoticeStage === "SUSPENDED") {
						await db.restaurant.update({
							where: { id: sub.restaurantId },
							data: { isActive: true },
						});
					}
				}

				if (sub.restaurant) {
					const restaurant = sub.restaurant;
					await import("@/lib/email").then((m) =>
						m.sendRenewalSuccessEmail({
							to: sub.user.email,
							restaurantName: restaurant.name,
							amount: `₦${getPlanIntervalPrice(sub.plan, billingInterval).toLocaleString()}`,
							planName: sub.plan.name,
							receiptUrl: (payload.data as { receipt_url?: string })
								?.receipt_url,
						}),
					);
				}
			}
		}
		return NextResponse.json({ ok: true });
	}

	if (!metadata.userId || !metadata.planId) {
		return NextResponse.json(
			{ error: "Missing subscription metadata" },
			{ status: 400 },
		);
	}

	const now = new Date();
	const billingInterval = parseBillingInterval(metadata.billingInterval);
	const periodEnd = addBillingPeriod(now, billingInterval);

	// Deliberately not filtered by planId — that's what's changing on an
	// upgrade/downgrade, so filtering on it would never match the existing
	// row and would silently create an orphaned duplicate instead of
	// updating the restaurant's actual subscription.
	const existingSubscription = await db.subscription.findFirst({
		where: metadata.restaurantId
			? { restaurantId: metadata.restaurantId }
			: { userId: metadata.userId, restaurantId: null },
		orderBy: { createdAt: "desc" },
	});

	if (existingSubscription) {
		await db.subscription.update({
			where: { id: existingSubscription.id },
			data: {
				planId: metadata.planId,
				status: SubscriptionStatus.ACTIVE,
				billingInterval,
				currentPeriodStart: now,
				currentPeriodEnd: periodEnd,
				paymentRef: payload.data?.reference,
				paystackCustomerCode: payload.data?.customer?.customer_code,
				paystackSubscriptionCode: payload.data?.subscription?.subscription_code,
			},
		});
	} else if (metadata.restaurantId) {
		// Shouldn't normally happen — a restaurant gets a subscription row at
		// creation — but create one tied to this restaurant defensively
		// rather than falling into the onboarding cleanup path below, which
		// would incorrectly cancel this same user's OTHER restaurants.
		await db.subscription.create({
			data: {
				userId: metadata.userId,
				restaurantId: metadata.restaurantId,
				planId: metadata.planId,
				status: SubscriptionStatus.ACTIVE,
				billingInterval,
				currentPeriodStart: now,
				currentPeriodEnd: periodEnd,
				paymentRef: payload.data?.reference,
				paystackCustomerCode: payload.data?.customer?.customer_code,
				paystackSubscriptionCode: payload.data?.subscription?.subscription_code,
			},
		});
	} else {
		// Before creating a new subscription, find and cancel any active ones
		const oldSubscriptions = await db.subscription.findMany({
			where: {
				userId: metadata.userId,
				status: {
					in: [
						SubscriptionStatus.ACTIVE,
						SubscriptionStatus.TRIALING,
						SubscriptionStatus.PAST_DUE,
					],
				},
			},
		});

		for (const oldSub of oldSubscriptions) {
			if (oldSub.paystackSubscriptionCode) {
				// Fetch email token
				const fetchRes = await fetch(
					`https://api.paystack.co/subscription/${oldSub.paystackSubscriptionCode}`,
					{
						headers: {
							Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
						},
					},
				);
				if (fetchRes.ok) {
					const data = (await fetchRes.json()) as {
						data?: { email_token?: string };
					};
					const emailToken = data.data?.email_token;
					if (emailToken) {
						// Disable on Paystack
						await fetch("https://api.paystack.co/subscription/disable", {
							method: "POST",
							headers: {
								Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
								"Content-Type": "application/json",
							},
							body: JSON.stringify({
								code: oldSub.paystackSubscriptionCode,
								token: emailToken,
							}),
						});
					}
				}
			}

			// Mark cancelled in DB
			await db.subscription.update({
				where: { id: oldSub.id },
				data: { status: SubscriptionStatus.CANCELLED },
			});
		}

		await db.subscription.create({
			data: {
				userId: metadata.userId,
				planId: metadata.planId,
				status: SubscriptionStatus.ACTIVE,
				billingInterval,
				currentPeriodStart: now,
				currentPeriodEnd: periodEnd,
				paymentRef: payload.data?.reference,
				paystackCustomerCode: payload.data?.customer?.customer_code,
				paystackSubscriptionCode: payload.data?.subscription?.subscription_code,
			},
		});
	}

	// Only the onboarding flow (no restaurantId yet) needs this — an existing
	// restaurant owner upgrading their plan has already finished onboarding.
	if (!metadata.restaurantId) {
		await db.user.update({
			where: { id: metadata.userId },
			data: { onboardingStatus: OnboardingStatus.PENDING_SETUP },
		});
	} else {
		// A confirmed payment means they're renewing/upgrading out of a forced
		// Free downgrade — restore exactly the categories the system hid.
		await db.menuCategory.updateMany({
			where: { restaurantId: metadata.restaurantId, hiddenByDowngrade: true },
			data: { isActive: true, hiddenByDowngrade: false },
		});
	}
	const user = await db.user.findUniqueOrThrow({
		where: { id: metadata.userId },
		select: { email: true },
	});
	const plan = await db.plan.findUniqueOrThrow({
		where: { id: metadata.planId },
		select: { name: true },
	});

	await sendSubscriptionConfirmationEmail({
		to: payload.data?.customer?.email ?? user.email,
		planName: plan.name,
	});

	captureServerEvent("subscription_completed", metadata.userId, {
		planId: metadata.planId,
		planName: plan.name,
		billingInterval,
	});

	return NextResponse.json({ ok: true });
}
