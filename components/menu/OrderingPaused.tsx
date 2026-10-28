"use client";

import { createContext, type ReactNode, useContext } from "react";

/**
 * "This restaurant can't take orders right now" (its subscription lapsed), for
 * every menu card, cart and checkout entry point at once. The menu stays
 * browsable; add-to-cart and checkout disappear. The server refuses new
 * orders regardless (lib/restaurant-access.ts) — this is the visible half.
 */
const OrderingPausedContext = createContext(false);

export function OrderingPausedProvider({
	paused,
	children,
}: {
	paused: boolean;
	children: ReactNode;
}) {
	return (
		<OrderingPausedContext.Provider value={paused}>
			{children}
		</OrderingPausedContext.Provider>
	);
}

export function useOrderingPaused() {
	return useContext(OrderingPausedContext);
}
