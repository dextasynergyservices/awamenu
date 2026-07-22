"use client";

import { useEffect } from "react";
import { useCart } from "@/hooks/useCart";

type OrderCartFinalizerProps = {
	restaurantSlug: string;
	orderId: string;
};

export function OrderCartFinalizer({
	restaurantSlug,
	orderId,
}: OrderCartFinalizerProps) {
	const cartRestaurantSlug = useCart((state) => state.restaurantSlug);
	const appendOrderId = useCart((state) => state.appendOrderId);
	const clearCart = useCart((state) => state.clearCart);

	useEffect(() => {
		if (cartRestaurantSlug === restaurantSlug || appendOrderId === orderId) {
			clearCart();
		}
	}, [appendOrderId, cartRestaurantSlug, clearCart, orderId, restaurantSlug]);

	return null;
}
