"use client";

import { CalendarDays, Grid2X2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Tabs across the reservation surfaces.
 *
 * Tables and bookings used to be separate top-level pages, which meant editing
 * the rules in one place and watching their effect in another. Tables only
 * exist in order to be reserved, so they belong to the same section.
 *
 * Two tabs rather than three: the reservation settings are already a
 * collapsible section inside the tables page, and prising them out of a
 * 1300-line file would be a rewrite rather than a move.
 */
export function ReservationTabs({ slug }: { slug: string }) {
	const pathname = usePathname();
	const base = `/dashboard/${slug}/reservations`;

	const tabs = [
		{ href: base, label: "Bookings", icon: CalendarDays },
		{ href: `${base}/tables`, label: "Tables & Settings", icon: Grid2X2 },
	];

	return (
		<nav
			aria-label="Reservations"
			className="mb-5 flex min-w-0 gap-1 overflow-x-auto rounded-2xl bg-slate-100 p-1"
		>
			{tabs.map((tab) => {
				// Exact match for the index tab, prefix for the rest, so /tables
				// doesn't also light up "Bookings".
				const active =
					tab.href === base ? pathname === base : pathname.startsWith(tab.href);

				return (
					<Link
						key={tab.href}
						href={tab.href}
						aria-current={active ? "page" : undefined}
						className={cn(
							"inline-flex min-h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-black transition-colors",
							active
								? "bg-white text-emerald-700 shadow-sm"
								: "text-slate-600 hover:text-slate-900",
						)}
					>
						<tab.icon className="size-4" aria-hidden="true" />
						{tab.label}
					</Link>
				);
			})}
		</nav>
	);
}
