"use client";

import { Home, Info, LogIn, Tag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
	{ label: "Home", href: "/", icon: Home },
	{ label: "Pricing", href: "/pricing", icon: Tag },
	{ label: "About", href: "/about", icon: Info },
	{ label: "Login", href: "/login", icon: LogIn },
];

/**
 * Mobile-only bottom nav for the marketing/auth pages — mirrors the same
 * native-app bottom-bar pattern used by the super-admin and restaurant
 * dashboard shells, so the whole app feels consistent on mobile.
 */
export function MarketingBottomNav() {
	const pathname = usePathname();

	return (
		<nav className="fixed inset-x-2 bottom-2 z-40 rounded-2xl border border-emerald-100 bg-white px-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)] pt-1.5 shadow-[0_12px_34px_rgba(15,23,42,0.08)] min-[390px]:inset-x-3 min-[390px]:px-2 md:hidden">
			<div className="grid grid-cols-4 gap-0.5">
				{items.map((item) => {
					const Icon = item.icon;
					const isActive = pathname === item.href;

					return (
						<Link
							key={item.href}
							href={item.href}
							className={cn(
								"grid min-h-12 place-items-center gap-0.5 rounded-xl px-0.5 text-[10px] font-black text-slate-600",
								isActive && "text-emerald-700",
							)}
						>
							<Icon className="size-4" aria-hidden="true" />
							<span className="max-w-full truncate">{item.label}</span>
						</Link>
					);
				})}
			</div>
		</nav>
	);
}
