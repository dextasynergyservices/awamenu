/**
 * The delivery fee for an order, from the restaurant's own settings.
 *
 * Shared by checkout (to show the customer) and order creation (to charge),
 * so the fee the customer sees is the fee they pay. Pure: safe on the client.
 */
export function deliveryFeeFor(input: {
	orderType: string;
	/** Items total, before delivery. */
	subtotal: number;
	deliveryFee: number;
	/** Free delivery at or above this items total; null = never free. */
	freeDeliveryMinimum: number | null;
}): number {
	if (input.orderType !== "DELIVERY") return 0;
	if (input.deliveryFee <= 0) return 0;
	if (
		input.freeDeliveryMinimum !== null &&
		input.freeDeliveryMinimum > 0 &&
		input.subtotal >= input.freeDeliveryMinimum
	) {
		return 0;
	}
	return input.deliveryFee;
}
