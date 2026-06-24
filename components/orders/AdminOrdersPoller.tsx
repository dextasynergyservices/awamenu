"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AdminOrdersPoller() {
	const router = useRouter();

	useEffect(() => {
		const intervalId = window.setInterval(() => {
			router.refresh();
		}, 20_000);

		return () => window.clearInterval(intervalId);
	}, [router]);

	return null;
}
