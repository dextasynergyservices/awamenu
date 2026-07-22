"use client";

import { useEffect, useId, useRef } from "react";
import { env } from "@/env";

declare global {
	interface Window {
		turnstile?: {
			render: (
				container: string | HTMLElement,
				options: {
					sitekey: string;
					callback: (token: string) => void;
					"expired-callback"?: () => void;
					"error-callback"?: () => void;
				},
			) => string;
			remove: (widgetId: string) => void;
		};
	}
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
let scriptLoadPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
	if (typeof window === "undefined") return Promise.resolve();
	if (window.turnstile) return Promise.resolve();
	if (scriptLoadPromise) return scriptLoadPromise;

	scriptLoadPromise = new Promise((resolve, reject) => {
		const script = document.createElement("script");
		script.src = SCRIPT_SRC;
		script.async = true;
		script.defer = true;
		script.onload = () => resolve();
		script.onerror = () => reject(new Error("Failed to load Turnstile script"));
		document.head.appendChild(script);
	});
	return scriptLoadPromise;
}

type TurnstileWidgetProps = {
	onToken?: (token: string) => void;
	className?: string;
};

/**
 * Renders the Cloudflare Turnstile widget and mirrors its token into a
 * hidden `cf-turnstile-response` input, so it flows through existing
 * FormData-based server actions with no change to their calling convention.
 * Renders nothing if `NEXT_PUBLIC_TURNSTILE_SITE_KEY` isn't configured.
 */
export function TurnstileWidget({ onToken, className }: TurnstileWidgetProps) {
	const containerId = useId().replace(/:/g, "");
	const inputRef = useRef<HTMLInputElement>(null);
	const widgetIdRef = useRef<string | null>(null);
	const siteKey = env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
	// Latest-ref pattern: keeps the effect below stable across re-renders
	// even when callers pass a fresh `onToken` closure every render.
	const onTokenRef = useRef(onToken);
	onTokenRef.current = onToken;

	useEffect(() => {
		if (!siteKey) return;
		let cancelled = false;

		loadTurnstileScript().then(() => {
			if (cancelled || !window.turnstile) return;
			widgetIdRef.current = window.turnstile.render(`#${containerId}`, {
				sitekey: siteKey,
				callback: (token) => {
					if (inputRef.current) inputRef.current.value = token;
					onTokenRef.current?.(token);
				},
				"expired-callback": () => {
					if (inputRef.current) inputRef.current.value = "";
				},
			});
		});

		return () => {
			cancelled = true;
			if (widgetIdRef.current && window.turnstile) {
				window.turnstile.remove(widgetIdRef.current);
			}
		};
	}, [containerId]);

	if (!siteKey) return null;

	return (
		<div className={className}>
			<div id={containerId} />
			<input ref={inputRef} type="hidden" name="cf-turnstile-response" />
		</div>
	);
}
