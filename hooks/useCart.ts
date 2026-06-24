"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type CartMenuItem = {
	id: string;
	restaurantSlug: string;
	name: string;
	price: number;
	imageUrl?: string | null;
};

export type CartLine = CartMenuItem & {
	quantity: number;
	notes: string;
};

type CartState = {
	restaurantSlug: string | null;
	appendOrderId: string | null;
	items: CartLine[];
	isOpen: boolean;
	addItem: (item: CartMenuItem) => void;
	removeItem: (itemId: string) => void;
	setQuantity: (itemId: string, quantity: number) => void;
	setNotes: (itemId: string, notes: string) => void;
	openCart: () => void;
	closeCart: () => void;
	setAppendOrderId: (orderId: string | null) => void;
	clearCart: () => void;
};

export const useCart = create<CartState>()(
	persist(
		(set) => ({
			restaurantSlug: null,
			appendOrderId: null,
			items: [],
			isOpen: false,
			addItem: (item) =>
				set((state) => {
					const items =
						state.restaurantSlug && state.restaurantSlug !== item.restaurantSlug
							? []
							: state.items;
					const existing = items.find((line) => line.id === item.id);

					return {
						restaurantSlug: item.restaurantSlug,
						items: existing
							? items.map((line) =>
									line.id === item.id
										? { ...line, quantity: line.quantity + 1 }
										: line,
								)
							: [...items, { ...item, quantity: 1, notes: "" }],
					};
				}),
			removeItem: (itemId) =>
				set((state) => ({
					items: state.items.filter((line) => line.id !== itemId),
				})),
			setQuantity: (itemId, quantity) =>
				set((state) => ({
					items:
						quantity < 1
							? state.items.filter((line) => line.id !== itemId)
							: state.items.map((line) =>
									line.id === itemId ? { ...line, quantity } : line,
								),
				})),
			setNotes: (itemId, notes) =>
				set((state) => ({
					items: state.items.map((line) =>
						line.id === itemId ? { ...line, notes } : line,
					),
				})),
			openCart: () => set({ isOpen: true }),
			closeCart: () => set({ isOpen: false }),
			setAppendOrderId: (orderId) => set({ appendOrderId: orderId }),
			clearCart: () =>
				set({
					items: [],
					restaurantSlug: null,
					appendOrderId: null,
					isOpen: false,
				}),
		}),
		{
			name: "awamenu-cart",
			partialize: (state) => ({
				restaurantSlug: state.restaurantSlug,
				appendOrderId: state.appendOrderId,
				items: state.items,
			}),
			storage: createJSONStorage(() => localStorage),
		},
	),
);

export function getCartSubtotal(items: CartLine[]) {
	return items.reduce((total, item) => total + item.price * item.quantity, 0);
}
