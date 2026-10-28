import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * AwaMenu Pay commission: one platform-wide rate, which a super admin can
 * override per restaurant.
 *
 * `Restaurant.commissionPercentOverride`:
 * - null → the platform rate (follows it when it changes)
 * - 0    → exempt: no commission at all
 * - n    → a custom rate for this restaurant
 *
 * Every charge records the rate it was made at (PaymentAttempt), so changing
 * a rate never rewrites what past payments were charged.
 */

export type CommissionKind = "platform" | "custom" | "exempt";

export type EffectiveCommission = {
	kind: CommissionKind;
	percent: number;
};

export function effectiveCommission(
	override: Prisma.Decimal | number | string | null | undefined,
	platformPercent: number,
): EffectiveCommission {
	if (override === null || override === undefined) {
		return { kind: "platform", percent: platformPercent };
	}
	const percent = Number(override);
	return percent <= 0
		? { kind: "exempt", percent: 0 }
		: { kind: "custom", percent };
}

export async function getPlatformCommissionPercent() {
	const settings = await db.platformSetting.findFirst({
		select: { awamenuPayCommissionPercent: true },
	});
	return Number(settings?.awamenuPayCommissionPercent ?? 0);
}

/** The rate a new charge for this restaurant is made at. */
export async function getRestaurantCommission(
	restaurantId: string,
	platformPercent?: number,
): Promise<EffectiveCommission> {
	const [restaurant, platform] = await Promise.all([
		db.restaurant.findUnique({
			where: { id: restaurantId },
			select: { commissionPercentOverride: true },
		}),
		platformPercent === undefined
			? getPlatformCommissionPercent()
			: Promise.resolve(platformPercent),
	]);
	return effectiveCommission(restaurant?.commissionPercentOverride, platform);
}

export function commissionLabel(c: EffectiveCommission) {
	if (c.kind === "exempt") return "Exempt";
	const rate = `${Number(c.percent.toFixed(2))}%`;
	return c.kind === "custom" ? `${rate} (custom)` : rate;
}
