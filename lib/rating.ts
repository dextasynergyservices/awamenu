import {
	OrderStatus,
	OrderType,
	PaymentPolicy,
	RatingContext,
} from "@prisma/client";

export type RatingMetric =
	| "foodQuality"
	| "deliverySpeed"
	| "packaging"
	| "serviceQuality"
	| "ambiance"
	| "valueForMoney";

type RatableOrder = {
	type: OrderType;
	status: OrderStatus;
	dineInPaymentPolicy: PaymentPolicy | null;
};

export function getRatingContext(type: OrderType): RatingContext {
	switch (type) {
		case OrderType.PICKUP:
			return RatingContext.PICKUP;
		case OrderType.DELIVERY:
			return RatingContext.DELIVERY;
		case OrderType.TABLE_RESERVATION:
			return RatingContext.RESERVATION;
		default:
			return RatingContext.DINE_IN;
	}
}

/**
 * Trigger rules per §13 of the spec. DINE_IN with PAY_AFTER_SERVICE only
 * becomes ratable once fully COMPLETED (the customer may still be adding
 * items up to that point); everything else is ratable at DELIVERED/READY
 * or COMPLETED, whichever the order type reaches.
 */
export function isOrderRatingEligible(order: RatableOrder): boolean {
	if (order.status === OrderStatus.CANCELLED) return false;

	switch (order.type) {
		case OrderType.DINE_IN:
			if (order.dineInPaymentPolicy === PaymentPolicy.PAY_AFTER_SERVICE) {
				return order.status === OrderStatus.COMPLETED;
			}
			return (
				order.status === OrderStatus.DELIVERED ||
				order.status === OrderStatus.COMPLETED
			);
		case OrderType.PICKUP:
			return (
				order.status === OrderStatus.READY ||
				order.status === OrderStatus.COMPLETED
			);
		case OrderType.DELIVERY:
			return (
				order.status === OrderStatus.DELIVERED ||
				order.status === OrderStatus.COMPLETED
			);
		case OrderType.TABLE_RESERVATION:
			return order.status === OrderStatus.COMPLETED;
		default:
			return false;
	}
}

// Metric applicability by context — mirrors the table in spec §13.
export const RATING_METRICS_BY_CONTEXT: Record<RatingContext, RatingMetric[]> =
	{
		[RatingContext.DINE_IN]: [
			"foodQuality",
			"serviceQuality",
			"ambiance",
			"valueForMoney",
		],
		[RatingContext.DELIVERY]: [
			"foodQuality",
			"deliverySpeed",
			"packaging",
			"valueForMoney",
		],
		[RatingContext.PICKUP]: ["foodQuality", "packaging", "valueForMoney"],
		[RatingContext.RESERVATION]: [
			"foodQuality",
			"serviceQuality",
			"ambiance",
			"valueForMoney",
		],
	};

export const RATING_METRIC_LABELS: Record<RatingMetric, string> = {
	foodQuality: "Food Quality",
	deliverySpeed: "Delivery Speed",
	packaging: "Packaging",
	serviceQuality: "Service Quality",
	ambiance: "Ambiance",
	valueForMoney: "Value for Money",
};
