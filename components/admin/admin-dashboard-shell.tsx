"use client";

import {
	BarChart3,
	CalendarDays,
	ClipboardList,
	Ellipsis,
	Grid2X2,
	LayoutDashboard,
	LogOut,
	MonitorSmartphone,
	Settings,
	Users,
	Utensils,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LoadingButton } from "@/components/ui/action-button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type AdminDashboardShellProps = {
	children: React.ReactNode;
	restaurantName: string;
	restaurantLogoUrl: string | null;
	slug: string;
};

const navItems = [
	{ label: "Dashboard", href: "", icon: LayoutDashboard },
	{ label: "Menu", href: "/menu", icon: Utensils },
	{ label: "Tables", href: "/tables", icon: Grid2X2 },
	{ label: "Orders", href: "/orders", icon: ClipboardList },
	{ label: "Reservations", href: "/reservations", icon: CalendarDays },
	{ label: "Staff", href: "/staff", icon: Users },
	{ label: "Settings", href: "/settings", icon: Settings },
	{ label: "Analytics", href: "/analytics", icon: BarChart3 },
];

const mobileNavItems = [
	{ label: "Dashboard", href: "", icon: LayoutDashboard },
	{ label: "Orders", href: "/orders", icon: ClipboardList },
	{ label: "Menu", href: "/menu", icon: Utensils },
	{ label: "Reservations", href: "/reservations", icon: CalendarDays },
];

export function AdminDashboardShell({
	children,
	restaurantName,
	restaurantLogoUrl,
	slug,
}: AdminDashboardShellProps) {
	const pathname = usePathname();
	const router = useRouter();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const [logoutSuccess, setLogoutSuccess] = useState(false);
	const [moreOpen, setMoreOpen] = useState(false);
	const basePath = `/dashboard/${slug}`;
	const mobileSubtitle =
		pathname === `${basePath}/menu` ? "Menu Builder" : "Restaurant Management";

	async function handleLogout() {
		setIsLoggingOut(true);
		setLogoutSuccess(false);
		await authClient.signOut();
		setLogoutSuccess(true);
		router.push("/login");
		router.refresh();
	}

	return (
		<div className="min-h-screen overflow-x-hidden bg-white text-[#10182f]">
			<aside className="fixed top-0 left-0 z-40 hidden h-screen w-[264px] overflow-y-auto border-emerald-100 border-r bg-white md:flex md:flex-col">
				<div className="px-6 pb-7 pt-8">
					<Link href={basePath} className="flex items-center gap-3">
						<RestaurantLogo
							name={restaurantName}
							logoUrl={restaurantLogoUrl}
							className="size-10 rounded-xl"
							fallbackClassName="size-10 rounded-xl text-lg"
						/>
						<span className="truncate text-xl font-black text-slate-950">
							{restaurantName}
						</span>
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
									"flex min-h-[3.25rem] items-center gap-4 rounded-2xl px-4 text-sm font-black text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800",
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
					<div className="rounded-2xl border border-lime-100 bg-lime-50 p-5">
						<div>
							<p className="text-sm font-black text-emerald-800">
								Upgrade to Premium
							</p>
							<p className="mt-3 text-sm font-medium leading-6 text-slate-600">
								Unlock advanced features and boost your business.
							</p>
						</div>
						<Link
							href={`${basePath}/settings`}
							className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white"
						>
							Upgrade Now
						</Link>
					</div>
					<p className="mt-6 text-center text-xs font-medium text-slate-400">
						© 2026 AwaMenu
					</p>
				</div>
			</aside>

			<div className="min-w-0 max-w-full overflow-x-hidden pt-[73px] pb-24 md:ml-[264px] md:pt-[106px] md:pb-0">
				<header className="fixed top-0 inset-x-0 z-30 max-w-full overflow-hidden border-emerald-100 border-b bg-white/92 px-3 py-3 backdrop-blur md:left-[264px] md:px-8 md:py-5">
					<div className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
						<div className="flex min-w-0 items-center gap-2 sm:gap-4">
							<div className="min-w-0 md:hidden">
								<div className="flex items-center gap-2">
									<RestaurantLogo
										name={restaurantName}
										logoUrl={restaurantLogoUrl}
										className="size-10 rounded-2xl"
										fallbackClassName="size-10 rounded-2xl text-sm"
									/>
									<div className="min-w-0">
										<p className="truncate text-xl font-black text-slate-950">
											{restaurantName}
										</p>
										<p className="truncate text-sm font-bold text-slate-500">
											{mobileSubtitle}
										</p>
									</div>
								</div>
							</div>
							<div className="hidden min-w-0 md:block">
								<p className="text-sm font-medium text-slate-600">
									Welcome back,
								</p>
								<h1 className="truncate text-[2rem] font-black leading-tight text-slate-950">
									{restaurantName}
								</h1>
							</div>
						</div>
						<div className="flex shrink-0 items-center gap-1.5 sm:gap-3 md:gap-4">
							<NotificationBell unreadCount={3} />
							<div className="hidden items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2 md:flex">
								<RestaurantLogo
									name={restaurantName}
									logoUrl={restaurantLogoUrl}
									className="size-10 rounded-full"
									fallbackClassName="size-10 rounded-full text-sm"
								/>
								<div>
									<p className="text-sm font-black text-slate-950">
										{restaurantName}
									</p>
									<p className="text-xs font-medium text-slate-500">
										Administrator
									</p>
								</div>
							</div>
							<LoadingButton
								type="button"
								onClick={handleLogout}
								loading={isLoggingOut}
								success={logoutSuccess}
								loadingText="Logging out..."
								successText="Logged out"
								className="inline-flex min-h-10 items-center justify-center gap-1 rounded-2xl border border-red-100 bg-white px-2.5 text-xs font-black text-red-600 transition-colors hover:bg-red-50 min-[390px]:px-3 min-[390px]:text-sm sm:min-h-11 sm:gap-2 sm:px-4"
							>
								<LogOut className="size-4 sm:size-5" aria-hidden="true" />
								<span>Logout</span>
							</LoadingButton>
						</div>
					</div>
				</header>

				<main className="min-w-0 max-w-full overflow-x-hidden px-3 py-2 min-[390px]:px-4 md:px-8 md:py-6">
					{children}
				</main>

				<nav className="fixed inset-x-2 bottom-2 z-40 rounded-[1.5rem] border border-emerald-100 bg-white px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 min-[390px]:inset-x-4 min-[390px]:bottom-3 min-[390px]:rounded-[1.75rem] min-[390px]:px-3 md:hidden">
					<div className="grid grid-cols-5 gap-1">
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
										"grid min-h-14 place-items-center rounded-2xl px-0.5 text-xs font-black text-slate-600 min-[390px]:min-h-16 min-[390px]:px-1",
										isActive && "text-emerald-700",
									)}
								>
									<Icon className="size-5" aria-hidden="true" />
									{isActive ? (
										<span className="h-1 w-8 rounded-full bg-emerald-700 min-[390px]:w-12" />
									) : null}
									<span className="max-w-full truncate">{item.label}</span>
								</Link>
							);
						})}
						<button
							type="button"
							onClick={() => setMoreOpen(true)}
							className={cn(
								"grid min-h-14 place-items-center rounded-2xl px-0.5 text-xs font-black text-slate-600 min-[390px]:min-h-16 min-[390px]:px-1",
								(pathname === `${basePath}/settings` ||
									pathname.startsWith(`${basePath}/settings`) ||
									pathname === `${basePath}/tables` ||
									pathname.startsWith(`${basePath}/tables`) ||
									pathname === `${basePath}/staff` ||
									pathname.startsWith(`${basePath}/staff`) ||
									pathname === `${basePath}/analytics` ||
									pathname.startsWith(`${basePath}/analytics`)) &&
									"text-emerald-700",
							)}
						>
							<Ellipsis className="size-5" aria-hidden="true" />
							<span className="max-w-full truncate">More</span>
						</button>
					</div>
				</nav>

				{moreOpen ? (
					<div className="fixed inset-0 z-[90] bg-slate-950/40 md:hidden">
						<button
							type="button"
							className="absolute inset-0 cursor-default"
							aria-label="Close more menu"
							onClick={() => setMoreOpen(false)}
						/>
						<div className="absolute right-3 bottom-24 left-3 rounded-3xl border border-slate-100 bg-white p-3 shadow-2xl">
							<div className="grid gap-2">
								<Link
									href={`${basePath}/tables`}
									onClick={() => setMoreOpen(false)}
									className={cn(
										"flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-black text-slate-700 hover:bg-emerald-50",
										(pathname === `${basePath}/tables` ||
											pathname.startsWith(`${basePath}/tables`)) &&
											"bg-emerald-50 text-emerald-700",
									)}
								>
									<Grid2X2 className="size-5 text-emerald-700" />
									Tables
								</Link>
								<Link
									href={`${basePath}/staff`}
									onClick={() => setMoreOpen(false)}
									className={cn(
										"flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-black text-slate-700 hover:bg-emerald-50",
										(pathname === `${basePath}/staff` ||
											pathname.startsWith(`${basePath}/staff`)) &&
											"bg-emerald-50 text-emerald-700",
									)}
								>
									<Users className="size-5 text-emerald-700" />
									Staff
								</Link>
								<Link
									href={`${basePath}/analytics`}
									onClick={() => setMoreOpen(false)}
									className={cn(
										"flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-black text-slate-700 hover:bg-emerald-50",
										(pathname === `${basePath}/analytics` ||
											pathname.startsWith(`${basePath}/analytics`)) &&
											"bg-emerald-50 text-emerald-700",
									)}
								>
									<BarChart3 className="size-5 text-emerald-700" />
									Analytics
								</Link>
								<div className="my-1 border-t border-slate-100" />
								<Link
									href={`/${slug}`}
									onClick={() => setMoreOpen(false)}
									className="flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-black text-slate-700 hover:bg-emerald-50"
								>
									<MonitorSmartphone className="size-5 text-emerald-700" />
									Preview menu
								</Link>
								<Link
									href={`${basePath}/settings`}
									onClick={() => setMoreOpen(false)}
									className={cn(
										"flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-black text-slate-700 hover:bg-emerald-50",
										(pathname === `${basePath}/settings` ||
											pathname.startsWith(`${basePath}/settings`)) &&
											"bg-emerald-50 text-emerald-700",
									)}
								>
									<Settings className="size-5 text-emerald-700" />
									Settings
								</Link>
							</div>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}

function RestaurantLogo({
	name,
	logoUrl,
	className,
	fallbackClassName,
}: {
	name: string;
	logoUrl: string | null;
	className: string;
	fallbackClassName: string;
}) {
	if (logoUrl) {
		return (
			<Image
				src={logoUrl}
				alt={`${name} logo`}
				width={96}
				height={96}
				className={`${className} object-cover`}
				unoptimized
			/>
		);
	}

	return (
		<span
			className={`${fallbackClassName} grid place-items-center bg-emerald-700 font-black text-white`}
		>
			{name.charAt(0).toUpperCase()}
		</span>
	);
}
