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
import { db } from "@/lib/db";
import { sendSubscriptionConfirmationEmail } from "@/lib/email";
import { dispatchNotification } from "@/lib/notifications";
import { notifyNewOrder } from "@/lib/order-notifications";
import { verifyPaystackWebhook } from "@/lib/payments";
import { scheduleReservationExpiry } from "@/lib/qstash";

type PaystackWebhook = {
	event?: string;
	data?: {
		reference?: string;
		metadata?: {
			type?: string;
			userId?: string;
			planId?: string;
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

		const existingOrder = await db.order.findUnique({
			where: { id: metadata.orderId },
			select: { id: true, paymentStatus: true },
		});

		if (!existingOrder) {
			return NextResponse.json({ error: "Order not found" }, { status: 404 });
		}

		if (existingOrder.paymentStatus !== PaymentStatus.PAID) {
			await db.order.update({
				where: { id: metadata.orderId },
				data: {
					status: OrderStatus.CONFIRMED,
					paymentStatus: PaymentStatus.PAID,
					paymentProvider: "paystack",
					paymentRef: payload.data?.reference,
				},
			});
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

			if (reservation.preOrderId) {
				await db.order.update({
					where: { id: reservation.preOrderId },
					data: {
						status: OrderStatus.CONFIRMED,
						paymentStatus: PaymentStatus.PAID,
						paymentProvider: "paystack",
						paymentRef: payload.data?.reference,
					},
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
			const periodEnd = new Date(now);
			periodEnd.setMonth(periodEnd.getMonth() + 1);

			const sub = await db.subscription.findFirst({
				where: { paystackSubscriptionCode: subCode },
				include: {
					user: { select: { email: true } },
					restaurant: { select: { name: true } },
					plan: { select: { name: true, monthlyPrice: true } },
				},
			});

			if (sub) {
				await db.subscription.update({
					where: { id: sub.id },
					data: {
						status: SubscriptionStatus.ACTIVE,
						currentPeriodStart: now,
						currentPeriodEnd: periodEnd,
					},
				});

				if (sub.restaurant) {
					const restaurant = sub.restaurant;
					await import("@/lib/email").then((m) =>
						m.sendRenewalSuccessEmail({
							to: sub.user.email,
							restaurantName: restaurant.name,
							amount: `₦${sub.plan.monthlyPrice.toString()}`,
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
	const periodEnd = new Date(now);
	periodEnd.setMonth(periodEnd.getMonth() + 1);

	const existingSubscription = await db.subscription.findFirst({
		where: {
			userId: metadata.userId,
			planId: metadata.planId,
			restaurantId: null,
		},
		orderBy: { createdAt: "desc" },
	});

	if (existingSubscription) {
		await db.subscription.update({
			where: { id: existingSubscription.id },
			data: {
				status: SubscriptionStatus.ACTIVE,
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
				currentPeriodStart: now,
				currentPeriodEnd: periodEnd,
				paymentRef: payload.data?.reference,
				paystackCustomerCode: payload.data?.customer?.customer_code,
				paystackSubscriptionCode: payload.data?.subscription?.subscription_code,
			},
		});
	}

	const user = await db.user.update({
		where: { id: metadata.userId },
		data: { onboardingStatus: OnboardingStatus.PENDING_SETUP },
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
	});

	return NextResponse.json({ ok: true });
}
