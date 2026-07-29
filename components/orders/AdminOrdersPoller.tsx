"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AdminOrdersPoller() {
	const router = useRouter();

	useEffect(() => {
		const refresh = () => {
			router.refresh();
		};
		const intervalId = window.setInterval(refresh, 5_000);

		window.addEventListener("focus", refresh);
		document.addEventListener("visibilitychange", refresh);

		return () => {
			window.clearInterval(intervalId);
			window.removeEventListener("focus", refresh);
			document.removeEventListener("visibilitychange", refresh);
		};
	}, [router]);

	return null;
}
