"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
	getRatingContext,
	isOrderRatingEligible,
	RATING_METRICS_BY_CONTEXT,
} from "@/lib/rating";

const optionalRating = z.preprocess(
	(value) =>
		value === null || value === undefined || value === "" ? undefined : value,
	z.coerce.number().int().min(1).max(5).optional(),
);

const optionalString = (max: number) =>
	z.preprocess(
		(value) =>
			value === null || (typeof value === "string" && value.trim() === "")
				? undefined
				: value,
		z.string().trim().max(max).optional(),
	);

const submitRatingSchema = z.object({
	orderId: z.string().cuid(),
	slug: z.string().min(1),
	overallRating: z.coerce.number().int().min(1).max(5),
	foodQuality: optionalRating,
	deliverySpeed: optionalRating,
	packaging: optionalRating,
	serviceQuality: optionalRating,
	ambiance: optionalRating,
	valueForMoney: optionalRating,
	comment: optionalString(1000),
	customerName: optionalString(100),
	customerPhone: optionalString(40),
});

export async function submitRatingAction(formData: FormData) {
	const input = submitRatingSchema.parse({
		orderId: formData.get("orderId"),
		slug: formData.get("slug"),
		overallRating: formData.get("overallRating"),
		foodQuality: formData.get("foodQuality"),
		deliverySpeed: formData.get("deliverySpeed"),
		packaging: formData.get("packaging"),
		serviceQuality: formData.get("serviceQuality"),
		ambiance: formData.get("ambiance"),
		valueForMoney: formData.get("valueForMoney"),
		comment: formData.get("comment"),
		customerName: formData.get("customerName"),
		customerPhone: formData.get("customerPhone"),
	});

	const order = await db.order.findFirstOrThrow({
		where: { id: input.orderId, restaurant: { slug: input.slug } },
		select: {
			id: true,
			type: true,
			status: true,
			dineInPaymentPolicy: true,
			restaurantId: true,
			restaurant: { select: { slug: true } },
			rating: { select: { id: true } },
		},
	});

	// Double-rating prevention
	if (order.rating) {
		throw new Error("This order has already been rated.");
	}

	if (!isOrderRatingEligible(order)) {
		throw new Error("This order is not ready to be rated yet.");
	}

	const context = getRatingContext(order.type);
	const applicableMetrics = new Set(RATING_METRICS_BY_CONTEXT[context]);

	await db.rating.create({
		data: {
			restaurantId: order.restaurantId,
			orderId: order.id,
			context,
			overallRating: input.overallRating,
			foodQuality: applicableMetrics.has("foodQuality")
				? input.foodQuality
				: undefined,
			deliverySpeed: applicableMetrics.has("deliverySpeed")
				? input.deliverySpeed
				: undefined,
			packaging: applicableMetrics.has("packaging")
				? input.packaging
				: undefined,
			serviceQuality: applicableMetrics.has("serviceQuality")
				? input.serviceQuality
				: undefined,
			ambiance: applicableMetrics.has("ambiance") ? input.ambiance : undefined,
			valueForMoney: applicableMetrics.has("valueForMoney")
				? input.valueForMoney
				: undefined,
			comment: input.comment,
			customerName: input.customerName,
			customerPhone: input.customerPhone,
		},
	});

	revalidatePath(`/${order.restaurant.slug}/order/${order.id}`);
	revalidatePath(`/dashboard/${order.restaurant.slug}/analytics`);
	redirect(`/${order.restaurant.slug}/order/${order.id}`);
}
