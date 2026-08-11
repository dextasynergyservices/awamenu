"use client";

import { Home, Info, LayoutDashboard, LogIn, Tag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const baseItems = [
	{ label: "Home", href: "/", icon: Home },
	{ label: "Pricing", href: "/pricing", icon: Tag },
	{ label: "About", href: "/about", icon: Info },
];

/**
 * Mobile-only bottom nav for the marketing/auth pages — mirrors the same
 * native-app bottom-bar pattern used by the super-admin and restaurant
 * dashboard shells, so the whole app feels consistent on mobile.
 */
export function MarketingBottomNav() {
	const pathname = usePathname();
	const { data: session, isPending } = authClient.useSession();

	// These pages are statically rendered, so the session can only be resolved
	// on the client — otherwise a signed-in owner is shown "Login" here and is
	// sent back through sign-in they've already completed.
	const items = [
		...baseItems,
		isPending
			? { label: " ", href: "/login", icon: LogIn, placeholder: true }
			: session?.user
				? { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }
				: { label: "Login", href: "/login", icon: LogIn },
	];

	return (
		<nav className="fixed inset-x-2 bottom-2 z-40 rounded-2xl border border-emerald-100 bg-white px-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)] pt-1.5 shadow-[0_12px_34px_rgba(15,23,42,0.08)] min-[390px]:inset-x-3 min-[390px]:px-2 md:hidden">
			<div className="grid grid-cols-4 gap-0.5">
				{items.map((item) => {
					const Icon = item.icon;
					const isActive = pathname === item.href;
					const isPlaceholder = "placeholder" in item && item.placeholder;

					return (
						<Link
							key={item.label}
							href={item.href}
							aria-hidden={isPlaceholder || undefined}
							tabIndex={isPlaceholder ? -1 : undefined}
							className={cn(
								"grid min-h-12 place-items-center gap-0.5 rounded-xl px-0.5 text-[10px] font-black text-slate-600",
								isActive && "text-emerald-700",
								// Holds the slot while the session resolves so the bar
								// doesn't jump or briefly show the wrong action.
								isPlaceholder && "pointer-events-none opacity-0",
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
