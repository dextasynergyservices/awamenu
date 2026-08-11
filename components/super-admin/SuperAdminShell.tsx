"use client";

import {
	CalendarClock,
	ClipboardList,
	CreditCard,
	Ellipsis,
	LayoutDashboard,
	LogOut,
	PanelLeftClose,
	PanelLeftOpen,
	Receipt,
	Settings,
	Star,
	Store,
	TrendingUp,
	Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LoadingButton } from "@/components/ui/action-button";
import { MobileModal } from "@/components/ui/MobileModal";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { authClient } from "@/lib/auth-client";
import { LOGO_DESKTOP_URL, LOGO_ICON_URL } from "@/lib/logo";
import { cn } from "@/lib/utils";

const navItems = [
	{ label: "Overview", href: "", icon: LayoutDashboard },
	{ label: "Restaurants", href: "/restaurants", icon: Store },
	{ label: "Plans", href: "/plans", icon: CreditCard },
	{ label: "Subscriptions", href: "/subscriptions", icon: CalendarClock },
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
	{ label: "Subscriptions", href: "/subscriptions", icon: CalendarClock },
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
	const [isCollapsed, setIsCollapsed] = useState(() => {
		if (typeof window === "undefined") return false;
		return (
			window.localStorage.getItem("awamenu_superadmin_sidebar_collapsed") ===
			"true"
		);
	});
	const basePath = "/super-admin";

	function toggleSidebar() {
		setIsCollapsed((prev) => {
			const next = !prev;
			window.localStorage.setItem(
				"awamenu_superadmin_sidebar_collapsed",
				String(next),
			);
			return next;
		});
	}

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

			<aside
				className={cn(
					"fixed top-0 left-0 z-40 hidden h-screen flex-col border-emerald-100 border-r bg-white transition-all duration-300 md:flex",
					isCollapsed ? "w-20" : "w-[264px]",
				)}
			>
				<div
					className={cn(
						"flex items-center pt-8 pb-7",
						isCollapsed ? "justify-center px-2" : "justify-between px-6",
					)}
				>
					<Link href={basePath} className="flex items-center gap-2 min-w-0">
						<Image
							src={isCollapsed ? LOGO_ICON_URL : LOGO_DESKTOP_URL}
							alt="AwaMenu"
							width={isCollapsed ? 28 : 200}
							height={26}
							className={isCollapsed ? "size-7 object-contain" : "h-7 w-auto"}
							priority
						/>
						{!isCollapsed ? (
							<span className="text-sm font-black text-emerald-700">Admin</span>
						) : null}
					</Link>
					<button
						type="button"
						onClick={toggleSidebar}
						className={cn(
							"grid size-8 place-items-center rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors",
							isCollapsed && "mt-2",
						)}
						title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
						aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
					>
						{isCollapsed ? (
							<PanelLeftOpen className="size-4" />
						) : (
							<PanelLeftClose className="size-4" />
						)}
					</button>
				</div>
				<nav className={cn("grid gap-2", isCollapsed ? "px-2" : "px-4")}>
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
								title={item.label}
								className={cn(
									"flex min-h-13 items-center rounded-2xl text-sm font-black text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800",
									isCollapsed ? "justify-center px-0" : "gap-4 px-4",
									isActive &&
										"bg-emerald-100 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-800",
								)}
							>
								<Icon className="size-5 shrink-0" aria-hidden="true" />
								{!isCollapsed ? <span>{item.label}</span> : null}
							</Link>
						);
					})}
				</nav>
				<div className={cn("mt-auto p-4", isCollapsed && "text-center")}>
					{!isCollapsed ? (
						<p className="mb-3 truncate text-xs font-bold text-slate-500">
							{adminName}
						</p>
					) : null}
					<LoadingButton
						type="button"
						onClick={handleLogout}
						loading={isLoggingOut}
						loadingText="Logging out..."
						title="Logout"
						className={cn(
							"inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white text-sm font-black text-red-600 hover:bg-red-50",
							isCollapsed ? "w-11 px-0" : "w-full px-4",
						)}
					>
						<LogOut className="size-4 shrink-0" aria-hidden="true" />
						{!isCollapsed ? <span>Logout</span> : null}
					</LoadingButton>
				</div>
			</aside>

			<div
				className={cn(
					"min-w-0 max-w-full overflow-x-hidden pt-[73px] pb-24 transition-all duration-300 md:pt-8 md:pb-10",
					isCollapsed ? "md:ml-20" : "md:ml-[264px]",
				)}
			>
				<header className="fixed inset-x-0 top-0 z-30 max-w-full overflow-hidden border-emerald-100 border-b bg-white/92 px-3 py-3 backdrop-blur md:hidden">
					<div className="flex min-h-11 items-center justify-between gap-2">
						<Link href={basePath} className="flex items-center gap-1.5">
							<Image
								src={LOGO_ICON_URL}
								alt="AwaMenu"
								width={28}
								height={28}
								className="size-7 shrink-0 rounded-md object-contain"
								priority
							/>
							<span className="text-sm font-black text-emerald-700">Admin</span>
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
