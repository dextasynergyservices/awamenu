"use client";

import { useEffect, useState } from "react";
import {
	getOpenState,
	type OpeningPeriod,
	type OpenState,
} from "@/lib/opening-hours";
import { cn } from "@/lib/utils";

/**
 * The open/closed badge, kept accurate while the page stays open.
 *
 * The server computes the first value so the markup matches on hydration and
 * the badge is correct with JavaScript disabled. After that it re-evaluates on
 * a timer: a customer who leaves the menu open across closing time would
 * otherwise still be told the kitchen is taking orders.
 */
export function OpenStatusBadge({
	initial,
	periods,
	timezone,
	variant,
}: {
	initial: OpenState;
	periods: OpeningPeriod[];
	timezone: string;
	variant: "mobile" | "desktop";
}) {
	const [state, setState] = useState(initial);

	useEffect(() => {
		// Every 30s: fine-grained enough that the flip lands within half a minute
		// of the real closing time, cheap enough to be unnoticeable.
		const tick = () => setState(getOpenState(periods, timezone));
		tick();
		const timer = window.setInterval(tick, 30_000);
		return () => window.clearInterval(timer);
	}, [periods, timezone]);

	if (variant === "mobile") {
		return (
			<p
				className={cn(
					"mt-1 flex items-center gap-2 text-xs font-semibold md:text-base",
					state.isOpen ? "text-emerald-300" : "text-amber-300",
				)}
			>
				<span
					className={cn(
						"size-2.5 rounded-full",
						state.isOpen ? "bg-emerald-400" : "bg-amber-400",
					)}
				/>
				{state.label}
			</p>
		);
	}

	return (
		<p
			className={cn(
				"inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold",
				state.isOpen
					? "bg-emerald-50 text-emerald-700"
					: "bg-amber-50 text-amber-700",
			)}
		>
			<span
				className={cn(
					"size-2.5 rounded-full",
					state.isOpen ? "bg-emerald-500" : "bg-amber-500",
				)}
			/>
			{state.label}
		</p>
	);
}
