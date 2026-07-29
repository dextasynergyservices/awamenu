"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PushSubscriptionConfig = {
	restaurantId: string;
	recipientType: "admin" | "staff";
	recipientId: string;
};

/**
 * Hook to manage VAPID Web Push subscription lifecycle.
 * Handles requesting permission, subscribing with the browser,
 * and saving/removing the subscription via our API.
 */
export function usePushSubscription(config: PushSubscriptionConfig | null) {
	const [permission, setPermission] = useState<NotificationPermission>(
		typeof Notification !== "undefined" ? Notification.permission : "default",
	);
	const [isSubscribed, setIsSubscribed] = useState(false);
	const subscriptionRef = useRef<PushSubscription | null>(null);

	// Check for existing subscription on mount
	useEffect(() => {
		if (!config || typeof navigator === "undefined") return;
		if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

		navigator.serviceWorker.ready
			.then((registration) => registration.pushManager.getSubscription())
			.then((sub) => {
				subscriptionRef.current = sub;
				setIsSubscribed(!!sub);
			})
			.catch(() => {});
	}, [config]);

	const subscribe = useCallback(async () => {
		if (!config) return false;
		if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
			return false;
		}

		const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
		if (!vapidKey) return false;

		try {
			const result = await Notification.requestPermission();
			setPermission(result);

			if (result !== "granted") return false;

			const registration = await navigator.serviceWorker.ready;
			const subscription = await registration.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(vapidKey),
			});

			subscriptionRef.current = subscription;
			const keys = subscription.toJSON().keys;

			await fetch("/api/notifications/push/subscribe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					restaurantId: config.restaurantId,
					endpoint: subscription.endpoint,
					p256dh: keys?.p256dh ?? "",
					auth: keys?.auth ?? "",
					recipientType: config.recipientType,
					recipientId: config.recipientId,
					userAgent: navigator.userAgent,
				}),
			});

			setIsSubscribed(true);
			return true;
		} catch {
			return false;
		}
	}, [config]);

	const unsubscribe = useCallback(async () => {
		try {
			const sub = subscriptionRef.current;
			if (!sub) return;

			await fetch("/api/notifications/push/unsubscribe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ endpoint: sub.endpoint }),
			});

			await sub.unsubscribe();
			subscriptionRef.current = null;
			setIsSubscribed(false);
		} catch {
			// Silent failure
		}
	}, []);

	return { permission, isSubscribed, subscribe, unsubscribe };
}

/**
 * Convert a VAPID public key from base64url to Uint8Array
 * (required by PushManager.subscribe)
 */
function urlBase64ToUint8Array(base64String: string) {
	const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

	const rawData = atob(base64);
	const outputArray = new Uint8Array(rawData.length);

	for (let i = 0; i < rawData.length; ++i) {
		outputArray[i] = rawData.charCodeAt(i);
	}
	return outputArray;
}
