import type { SubscriptionStatus } from "@prisma/client";

export function isSubscriptionActive(
	subscription: {
		status: SubscriptionStatus;
		currentPeriodEnd: Date;
	} | null,
) {
	if (!subscription) return false;

	if (subscription.status === "ACTIVE" || subscription.status === "TRIALING") {
		return true;
	}

	// 3-day grace period for PAST_DUE or CANCELLED
	const gracePeriodEnd = new Date(subscription.currentPeriodEnd);
	gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 3);

	if (new Date() <= gracePeriodEnd) {
		return true;
	}

	return false;
}
