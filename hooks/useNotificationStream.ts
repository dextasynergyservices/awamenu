"use client";

import { useEffect, useRef } from "react";
import { fetchNotificationsAction } from "@/actions/notification.actions";
import {
	type Notification,
	useNotificationStore,
} from "@/stores/notification.store";

type UseNotificationStreamOptions = {
	recipientType: "admin" | "staff";
	recipientId: string;
	onNotification?: (notification: Notification) => void;
};

/** How often to check for new notifications while the tab is visible. */
const POLL_INTERVAL_MS = 15_000;

/**
 * Keeps the notification store fresh for a restaurant.
 *
 * This used to hold an SSE connection open (`EventSource`) against a route that
 * polled Redis in an infinite loop. On Vercel that meant every open dashboard
 * pinned a serverless function for the full request budget, dying with
 * "Task timed out after 300 seconds" and immediately reconnecting — burning
 * function time continuously and occupying concurrency that other requests
 * needed. Short polling fits the serverless model: each check is a normal,
 * fast request that returns and releases its slot.
 *
 * Polling pauses while the tab is hidden, so background tabs cost nothing, and
 * refreshes immediately on return so nothing is missed.
 */
export function useNotificationStream(
	restaurantId: string | null,
	options: UseNotificationStreamOptions,
) {
	const addNotification = useNotificationStore(
		(state) => state.addNotification,
	);
	const optionsRef = useRef(options);
	// Only notifications newer than this are treated as "new" and announced.
	// Seeded on first run from whatever the server already rendered.
	const lastSeenRef = useRef<number | null>(null);

	useEffect(() => {
		optionsRef.current = options;
	});

	useEffect(() => {
		if (!restaurantId) return;

		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;

		async function check() {
			if (cancelled || !restaurantId) return;
			// Paused while backgrounded; the visibilitychange handler restarts
			// the loop (and catches up immediately) when the tab returns.
			if (document.visibilityState !== "visible") return;

			try {
				const { recipientType, recipientId } = optionsRef.current;
				const { items } = await fetchNotificationsAction({
					restaurantId,
					recipientType,
					recipientId,
					limit: 20,
				});

				if (cancelled) return;

				// First pass only establishes the baseline — the initial list is
				// already on screen from the server render, so replaying it would
				// fire onNotification for notifications the user has seen.
				const previousSeen = lastSeenRef.current;
				const newest = items.reduce(
					(max, item) => Math.max(max, Date.parse(item.createdAt)),
					previousSeen ?? 0,
				);

				if (previousSeen !== null) {
					const fresh = items
						.filter((item) => Date.parse(item.createdAt) > previousSeen)
						.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

					for (const item of fresh) {
						const notification: Notification = {
							...item,
							actionUrl: item.actionUrl ?? undefined,
							metadata: item.metadata ?? undefined,
						};
						addNotification(notification);
						optionsRef.current.onNotification?.(notification);
					}
				}

				lastSeenRef.current = newest;
			} catch {
				// Transient failure (offline, deploy in progress) — the next tick
				// retries. Deliberately swallowed so a failed poll never surfaces
				// as an error boundary on an otherwise working dashboard.
			} finally {
				if (!cancelled) {
					timer = setTimeout(check, POLL_INTERVAL_MS);
				}
			}
		}

		function onVisibilityChange() {
			if (document.visibilityState !== "visible" || cancelled) return;
			// Catch up straight away rather than waiting out the interval.
			clearTimeout(timer);
			void check();
		}

		void check();
		document.addEventListener("visibilitychange", onVisibilityChange);

		return () => {
			cancelled = true;
			clearTimeout(timer);
			document.removeEventListener("visibilitychange", onVisibilityChange);
		};
	}, [restaurantId, addNotification]);
}
