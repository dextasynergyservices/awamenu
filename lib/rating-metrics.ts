export type RatingMetric =
	| "foodQuality"
	| "deliverySpeed"
	| "packaging"
	| "serviceQuality"
	| "ambiance"
	| "valueForMoney";

export const RATING_METRIC_LABELS: Record<RatingMetric, string> = {
	foodQuality: "Food Quality",
	deliverySpeed: "Delivery Speed",
	packaging: "Packaging",
	serviceQuality: "Service Quality",
	ambiance: "Ambiance",
	valueForMoney: "Value for Money",
};
