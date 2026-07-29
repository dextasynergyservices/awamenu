"use client";

import { useEffect, useRef } from "react";
import {
	type Notification,
	useNotificationStore,
} from "@/stores/notification.store";

type UseNotificationStreamOptions = {
	onNotification?: (notification: Notification) => void;
};

/**
 * Hook that connects to the SSE notification stream for a restaurant.
 * Automatically reconnects on disconnection with exponential backoff.
 */
export function useNotificationStream(
	restaurantId: string | null,
	options: UseNotificationStreamOptions = {},
) {
	const addNotification = useNotificationStore(
		(state) => state.addNotification,
	);
	const retryCount = useRef(0);
	const eventSourceRef = useRef<EventSource | null>(null);
	const onNotificationRef = useRef(options.onNotification);

	useEffect(() => {
		onNotificationRef.current = options.onNotification;
	}, [options.onNotification]);

	useEffect(() => {
		if (!restaurantId) return;

		let cancelled = false;

		function connect() {
			if (cancelled) return;

			const eventSource = new EventSource(
				`/api/notifications/stream/${restaurantId}`,
			);
			eventSourceRef.current = eventSource;

			eventSource.addEventListener("connected", () => {
				retryCount.current = 0;
			});

			eventSource.addEventListener("notification", (event) => {
				try {
					const data = JSON.parse(event.data) as Notification;
					addNotification(data);
					onNotificationRef.current?.(data);
				} catch {
					// Ignore malformed events
				}
			});

			eventSource.onerror = () => {
				eventSource.close();
				eventSourceRef.current = null;

				if (cancelled) return;

				// Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
				const delay = Math.min(1000 * 2 ** retryCount.current, 30_000);
				retryCount.current += 1;

				setTimeout(connect, delay);
			};
		}

		connect();

		return () => {
			cancelled = true;
			eventSourceRef.current?.close();
			eventSourceRef.current = null;
		};
	}, [restaurantId, addNotification]);
}
