import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-guards";
import { parseBillingInterval } from "@/lib/billing";
import { db } from "@/lib/db";
import { verifySubscriptionPaymentReference } from "@/lib/payments";

/**
 * Paystack's return URL for a post-expiry renew/upgrade. This deliberately
 * lives outside `(dashboard)/dashboard/[slug]/layout.tsx` — that layout
 * gates on the *current* (still-lapsed) subscription state and would render
 * SubscriptionExpiredGate instead of the settings page, so verification
 * logic placed on the settings page itself would never run. A route handler
 * isn't wrapped by any page layout, so it can verify the payment first and
 * only then redirect into a dashboard that's already unlocked.
 */
export async function GET(request: Request) {
	const url = new URL(request.url);
	const reference =
		url.searchParams.get("reference") ?? url.searchParams.get("trxref");
	const planId = url.searchParams.get("planId");
	const billingInterval = parseBillingInterval(url.searchParams.get("billing"));
	const slug = url.searchParams.get("slug");

	if (!reference || !planId || !slug) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	const user = await requireUser();
	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		select: { id: true, slug: true },
	});

	if (!restaurant) {
		return NextResponse.redirect(new URL("/dashboard", request.url));
	}

	await verifySubscriptionPaymentReference({
		reference,
		userId: user.id,
		planId,
		billingInterval,
		restaurantId: restaurant.id,
	});

	return NextResponse.redirect(
		new URL(`/dashboard/${restaurant.slug}/settings`, request.url),
	);
}
