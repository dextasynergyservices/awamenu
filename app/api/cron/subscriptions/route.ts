import { NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/lib/db";
import { verifyQstashSignature } from "@/lib/qstash";

export async function POST(request: Request) {
	const body = await request.text();
	const isVerified = await verifyQstashSignature({
		signature: request.headers.get("upstash-signature"),
		body,
		url: request.url,
	});

	if (!isVerified) {
		return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
	}

	const now = new Date();
	now.setHours(0, 0, 0, 0);

	const subscriptions = await db.subscription.findMany({
		where: {
			status: { in: ["ACTIVE", "PAST_DUE", "CANCELLED"] },
		},
		select: {
			id: true,
			status: true,
			currentPeriodEnd: true,
			user: { select: { email: true } },
			restaurant: { select: { name: true, slug: true } },
			plan: { select: { monthlyPrice: true } },
		},
	});

	for (const sub of subscriptions) {
		if (!sub.restaurant) continue;
		// Captured in a local const so TS narrowing survives into the
		// `.then()` closures below (property narrowing doesn't persist
		// across closure boundaries).
		const restaurant = sub.restaurant;

		const expiryDate = new Date(sub.currentPeriodEnd);
		expiryDate.setHours(0, 0, 0, 0);

		const gracePeriodEnd = new Date(expiryDate);
		gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3);

		const diffExpiryTime = expiryDate.getTime() - now.getTime();
		const daysToExpiry = Math.ceil(diffExpiryTime / (1000 * 60 * 60 * 24));

		const diffCutOffTime = gracePeriodEnd.getTime() - now.getTime();
		const daysToCutOff = Math.ceil(diffCutOffTime / (1000 * 60 * 60 * 24));

		const manageBillingUrl = `${env.NEXT_PUBLIC_APP_URL}/dashboard/${restaurant.slug}/settings`;
		const amount = `₦${sub.plan.monthlyPrice.toString()}`;

		if (sub.status === "ACTIVE") {
			// Auto-renewing plan: send upcoming charge reminder 7 days before expiry
			if (daysToExpiry === 7) {
				await import("@/lib/email").then((m) =>
					m.sendAutoRenewalUpcomingEmail({
						to: sub.user.email,
						restaurantName: restaurant.name,
						daysLeft: 7,
						amount,
						manageBillingUrl,
					}),
				);
			}
		} else {
			// CANCELLED or PAST_DUE: send manual renewal reminders
			if (daysToExpiry === 7 || daysToExpiry === 3 || daysToExpiry === 1) {
				await import("@/lib/email").then((m) =>
					m.sendUpcomingExpiryEmail({
						to: sub.user.email,
						restaurantName: restaurant.name,
						daysLeft: daysToExpiry,
						manageBillingUrl,
					}),
				);
			} else if (daysToExpiry === 0) {
				// Exact day of expiry - grace period begins
				await import("@/lib/email").then((m) =>
					m.sendGracePeriodEmail({
						to: sub.user.email,
						restaurantName: restaurant.name,
						manageBillingUrl,
					}),
				);
			} else if (daysToCutOff === 0) {
				// Grace period ended - completely offline
				await import("@/lib/email").then((m) =>
					m.sendCutOffEmail({
						to: sub.user.email,
						restaurantName: restaurant.name,
						manageBillingUrl,
					}),
				);
			}
		}
	}

	return NextResponse.json({ ok: true });
}
