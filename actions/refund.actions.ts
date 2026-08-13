"use server";

import { AuditActorType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recordAuditEvent } from "@/lib/audit";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { refundPayment } from "@/lib/payment-ledger";

const refundSchema = z.object({
	slug: z.string().min(1),
	paymentId: z.string().cuid(),
	amount: z.number().positive().optional(),
	reason: z.string().trim().max(200).optional(),
	offline: z.boolean().optional(),
});

/**
 * Refunds a payment.
 *
 * Owner-only and deliberately not delegable to staff: returning money is not
 * the same permission as taking it, and a till should not be able to move funds
 * out of the business.
 */
export async function refundPaymentAction(input: {
	slug: string;
	paymentId: string;
	amount?: number;
	reason?: string;
	offline?: boolean;
}): Promise<{ ok: true; message: string } | { error: string }> {
	const parsed = refundSchema.safeParse(input);
	if (!parsed.success) {
		return { error: parsed.error.issues[0]?.message ?? "Invalid refund." };
	}

	const user = await requireUser();
	const restaurant = await db.restaurant.findFirst({
		where: { slug: parsed.data.slug, ownerId: user.id },
		select: { id: true, slug: true },
	});

	if (!restaurant) return { error: "Restaurant not found." };

	const result = await refundPayment({
		paymentId: parsed.data.paymentId,
		restaurantId: restaurant.id,
		amount: parsed.data.amount,
		reason: parsed.data.reason,
		offline: parsed.data.offline,
		recordedById: user.id,
	});

	if (!result.ok) return { error: result.message };

	await recordAuditEvent({
		restaurantId: restaurant.id,
		actorType: AuditActorType.OWNER,
		actorId: user.id,
		actorName: user.name ?? user.email ?? "Owner",
		action: "payment.refunded",
		target: `Payment ${parsed.data.paymentId.slice(-6).toUpperCase()}`,
		newValue: `₦${result.refunded.toLocaleString()}${result.viaGateway ? "" : " (offline)"}${
			parsed.data.reason ? ` — ${parsed.data.reason}` : ""
		}`,
	});

	revalidatePath(`/dashboard/${restaurant.slug}/financials`);
	revalidatePath(`/dashboard/${restaurant.slug}/orders`);

	return {
		ok: true,
		message: result.viaGateway
			? `₦${result.refunded.toLocaleString()} sent back to the customer.`
			: `₦${result.refunded.toLocaleString()} recorded as refunded. Pay the customer directly if you haven't already.`,
	};
}
