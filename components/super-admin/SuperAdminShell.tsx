"use client";

import {
	ClipboardList,
	CreditCard,
	Ellipsis,
	LayoutDashboard,
	LogOut,
	Receipt,
	Settings,
	Star,
	Store,
	TrendingUp,
	Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LoadingButton } from "@/components/ui/action-button";
import { MobileModal } from "@/components/ui/MobileModal";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const navItems = [
	{ label: "Overview", href: "", icon: LayoutDashboard },
	{ label: "Restaurants", href: "/restaurants", icon: Store },
	{ label: "Plans", href: "/plans", icon: CreditCard },
	{ label: "Users", href: "/users", icon: Users },
	{ label: "Payments", href: "/payments", icon: Receipt },
	{ label: "Reviews & Ratings", href: "/reviews", icon: Star },
	{ label: "Analytics", href: "/analytics", icon: TrendingUp },
	{ label: "Audit Logs", href: "/audit-logs", icon: ClipboardList },
	{ label: "Settings", href: "/settings", icon: Settings },
];

const mobileNavItems = [
	{ label: "Overview", href: "", icon: LayoutDashboard },
	{ label: "Restaurants", href: "/restaurants", icon: Store },
	{ label: "Plans", href: "/plans", icon: CreditCard },
	{ label: "Users", href: "/users", icon: Users },
];

const moreNavItems = [
	{ label: "Payments", href: "/payments", icon: Receipt },
	{ label: "Reviews & Ratings", href: "/reviews", icon: Star },
	{ label: "Analytics", href: "/analytics", icon: TrendingUp },
	{ label: "Audit Logs", href: "/audit-logs", icon: ClipboardList },
	{ label: "Settings", href: "/settings", icon: Settings },
];

export function SuperAdminShell({
	adminName,
	children,
}: {
	adminName: string;
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [moreOpen, setMoreOpen] = useState(false);
	const basePath = "/super-admin";

	const isMoreActive = moreNavItems.some((item) => {
		const href = `${basePath}${item.href}`;
		return pathname === href || pathname.startsWith(href);
	});

	async function handleLogout() {
		setIsLoggingOut(true);
		await authClient.signOut();
		router.push("/login");
		router.refresh();
	}

	return (
		<div className="min-h-screen overflow-x-hidden bg-white text-[#10182f]">
			<OfflineBanner />

			<aside className="fixed top-0 left-0 z-40 hidden h-screen w-[264px] flex-col border-emerald-100 border-r bg-white md:flex">
				<div className="px-6 pt-8 pb-7">
					<Link href={basePath} className="text-xl font-black text-slate-950">
						AwaMenu <span className="text-emerald-700">Admin</span>
					</Link>
				</div>
				<nav className="grid gap-2 px-4">
					{navItems.map((item) => {
						const href = `${basePath}${item.href}`;
						const Icon = item.icon;
						const isActive =
							pathname === href ||
							(item.href !== "" && pathname.startsWith(href));

						return (
							<Link
								key={item.label}
								href={href}
								className={cn(
									"flex min-h-13 items-center gap-4 rounded-2xl px-4 text-sm font-black text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800",
									isActive &&
										"bg-emerald-100 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-800",
								)}
							>
								<Icon className="size-5" aria-hidden="true" />
								{item.label}
							</Link>
						);
					})}
				</nav>
				<div className="mt-auto p-5">
					<p className="mb-3 truncate text-xs font-bold text-slate-500">
						{adminName}
					</p>
					<LoadingButton
						type="button"
						onClick={handleLogout}
						loading={isLoggingOut}
						loadingText="Logging out..."
						className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white px-4 text-sm font-black text-red-600 hover:bg-red-50"
					>
						<LogOut className="size-4" aria-hidden="true" />
						Logout
					</LoadingButton>
				</div>
			</aside>

			<div className="min-w-0 max-w-full overflow-x-hidden pt-[73px] pb-24 md:ml-[264px] md:pt-8 md:pb-10">
				<header className="fixed inset-x-0 top-0 z-30 max-w-full overflow-hidden border-emerald-100 border-b bg-white/92 px-3 py-3 backdrop-blur md:hidden">
					<div className="flex min-h-11 items-center justify-between gap-2">
						<Link href={basePath} className="text-sm font-black text-slate-950">
							AwaMenu <span className="text-emerald-700">Admin</span>
						</Link>
						<LoadingButton
							type="button"
							onClick={handleLogout}
							loading={isLoggingOut}
							loadingText="Logging out..."
							className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-red-100 bg-white px-2.5 text-[11px] font-black text-red-600 hover:bg-red-50"
						>
							<LogOut className="size-3.5" aria-hidden="true" />
							Logout
						</LoadingButton>
					</div>
				</header>

				<main className="min-w-0 max-w-full overflow-x-hidden px-3 py-2 min-[390px]:px-4 md:px-8 md:py-6">
					{children}
				</main>

				<nav className="fixed inset-x-2 bottom-2 z-40 rounded-2xl border border-emerald-100 bg-white px-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)] pt-1.5 min-[390px]:inset-x-3 min-[390px]:px-2 md:hidden">
					<div className="grid grid-cols-5 gap-0.5">
						{mobileNavItems.map((item) => {
							const href = `${basePath}${item.href}`;
							const Icon = item.icon;
							const isActive =
								pathname === href ||
								(item.href !== "" && pathname.startsWith(href));

							return (
								<Link
									key={item.label}
									href={href}
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
						<button
							type="button"
							onClick={() => setMoreOpen(true)}
							className={cn(
								"grid min-h-12 place-items-center gap-0.5 rounded-xl px-0.5 text-[10px] font-black text-slate-600",
								isMoreActive && "text-emerald-700",
							)}
						>
							<Ellipsis className="size-4" aria-hidden="true" />
							<span className="max-w-full truncate">More</span>
						</button>
					</div>
				</nav>

				<MobileModal
					open={moreOpen}
					onClose={() => setMoreOpen(false)}
					title="More"
				>
					<div className="grid gap-1.5 pb-2">
						{moreNavItems.map((item) => {
							const href = `${basePath}${item.href}`;
							const Icon = item.icon;
							const isActive =
								pathname === href ||
								(item.href !== "" && pathname.startsWith(href));

							return (
								<Link
									key={item.label}
									href={href}
									onClick={() => setMoreOpen(false)}
									className={cn(
										"flex min-h-11 items-center gap-2.5 rounded-xl px-2.5 text-sm font-black text-slate-700 hover:bg-emerald-50",
										isActive && "bg-emerald-50 text-emerald-700",
									)}
								>
									<Icon className="size-4 text-emerald-700" />
									{item.label}
								</Link>
							);
						})}
					</div>
				</MobileModal>
			</div>
		</div>
	);
}
