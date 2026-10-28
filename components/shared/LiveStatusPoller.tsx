"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Keeps a status page current without re-rendering it on a timer.
 *
 * The status pages used to call `router.refresh()` every 5 seconds — a full
 * server render with its database queries, around the clock for every open
 * tab, which also kept the database from ever going idle. This asks a tiny
 * endpoint for a version number instead and re-renders only when it changes.
 *
 * - Polls only while the tab is visible, and catches up on return.
 * - Every 10s for the first 10 minutes, then every 30s: an order that hasn't
 *   moved in ten minutes rarely moves in the next ten seconds.
 * - Stops once the page reports nothing more can change (`active = false`).
 */
const FAST_MS = 10_000;
const SLOW_MS = 30_000;
const FAST_FOR_MS = 10 * 60_000;

export function LiveStatusPoller({
	url,
	version,
	active = true,
}: {
	/** Returns `{ v: number }`. */
	url: string;
	/** The version the page was rendered at. */
	version: number;
	active?: boolean;
}) {
	const router = useRouter();
	const versionRef = useRef(version);
	const startedRef = useRef(Date.now());

	useEffect(() => {
		versionRef.current = version;
	}, [version]);

	useEffect(() => {
		if (!active) return;

		let cancelled = false;
		let timer: ReturnType<typeof setTimeout> | undefined;

		const schedule = () => {
			if (cancelled) return;
			const elapsed = Date.now() - startedRef.current;
			timer = setTimeout(check, elapsed < FAST_FOR_MS ? FAST_MS : SLOW_MS);
		};

		async function check() {
			if (cancelled) return;
			if (document.visibilityState !== "visible") return;
			try {
				const res = await fetch(url, { cache: "no-store" });
				if (res.ok) {
					const { v } = (await res.json()) as { v?: number };
					if (typeof v === "number" && v !== versionRef.current) {
						versionRef.current = v;
						router.refresh();
					}
				}
			} catch {
				// Offline or a blip — the next tick tries again.
			}
			schedule();
		}

		const onVisible = () => {
			if (document.visibilityState !== "visible") return;
			if (timer) clearTimeout(timer);
			void check();
		};

		schedule();
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			cancelled = true;
			if (timer) clearTimeout(timer);
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, [url, active, router]);

	return null;
}
