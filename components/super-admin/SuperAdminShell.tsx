"use client";

import {
	CalendarClock,
	ClipboardList,
	CreditCard,
	ExternalLink,
	LayoutDashboard,
	Mail,
	Percent,
	Receipt,
	Scale,
	Settings,
	Star,
	Store,
	TrendingUp,
	Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
	DashboardTopBar,
	isNavActive,
	MobileTabBar,
	type NavItem,
	TAB_BAR_PADDING,
	useActiveNav,
} from "@/components/dashboard/DashboardChrome";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { authClient } from "@/lib/auth-client";
import { LOGO_DESKTOP_URL, LOGO_ICON_URL } from "@/lib/logo";
import { cn } from "@/lib/utils";

const basePath = "/super-admin";

const navItems: NavItem[] = [
	{ label: "Overview", href: "", icon: LayoutDashboard },
	{ label: "Restaurants", href: "/restaurants", icon: Store },
	{
		label: "Subscriptions",
		shortLabel: "Billing",
		href: "/subscriptions",
		icon: CalendarClock,
	},
	{ label: "Payments", href: "/payments", icon: Receipt },
	{ label: "Commission", href: "/commission", icon: Percent },
	{ label: "Plans", href: "/plans", icon: CreditCard },
	{ label: "Accounts", href: "/users", icon: Users },
	{ label: "Reviews", href: "/reviews", icon: Star },
	{ label: "Analytics", href: "/analytics", icon: TrendingUp },
	{ label: "Audit log", href: "/audit-logs", icon: ClipboardList },
	{ label: "Emails", href: "/emails", icon: Mail },
	{ label: "Legal", href: "/legal", icon: Scale },
	{ label: "Settings", href: "/settings", icon: Settings },
];
const tabItems = navItems.slice(0, 4);
const moreItems = navItems.slice(4);

const SIDEBAR_KEY = "awamenu_superadmin_sidebar_collapsed";

export function SuperAdminShell({
	adminName,
	adminEmail,
	logoUrl,
	children,
}: {
	adminName: string;
	adminEmail: string;
	/** Uploaded in Settings; replaces the built-in wordmark. */
	logoUrl?: string | null;
	children: React.ReactNode;
}) {
	const router = useRouter();
	const { active, pathname, backHref } = useActiveNav(navItems, basePath);
	// Read after mount: the server can't see localStorage, and reading it during
	// the first render made server and client HTML differ (a hydration error).
	const [isCollapsed, setIsCollapsed] = useState(false);
	useEffect(() => {
		try {
			setIsCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "true");
		} catch {
			// Storage blocked: stay expanded.
		}
	}, []);

	function toggleSidebar() {
		setIsCollapsed((prev) => {
			try {
				window.localStorage.setItem(SIDEBAR_KEY, String(!prev));
			} catch {
				// Storage blocked: the choice just won't persist.
			}
			return !prev;
		});
	}

	async function handleLogout() {
		await authClient.signOut();
		router.push("/login");
		router.refresh();
	}

	return (
		<div className="min-h-screen bg-slate-50/60 text-[#10182f]">
			<OfflineBanner />

			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-40 hidden flex-col border-slate-200/70 border-r bg-white transition-[width] duration-300 md:flex",
					isCollapsed ? "w-20" : "w-[248px]",
				)}
			>
				<Link
					href={basePath}
					className={cn(
						"flex h-16 shrink-0 items-center gap-2 border-slate-200/70 border-b",
						isCollapsed ? "justify-center" : "px-6",
					)}
				>
					<Image
						src={isCollapsed ? LOGO_ICON_URL : (logoUrl ?? LOGO_DESKTOP_URL)}
						unoptimized={Boolean(logoUrl) && !isCollapsed}
						alt="AwaMenu"
						width={isCollapsed ? 28 : 180}
						height={26}
						className={isCollapsed ? "size-7 object-contain" : "h-7 w-auto"}
						priority
					/>
					{!isCollapsed ? (
						<span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-emerald-700">
							Admin
						</span>
					) : null}
				</Link>
				{/* Scrolls on short screens, so nothing is ever cut off. */}
				<nav
					aria-label="Super Admin"
					className={cn(
						"grid min-h-0 flex-1 content-start gap-1 overflow-y-auto py-4",
						isCollapsed ? "px-3" : "px-3",
					)}
				>
					{navItems.map((item) => {
						const Icon = item.icon;
						const isActive = isNavActive(pathname, basePath, item);
						return (
							<Link
								key={item.label}
								href={`${basePath}${item.href}`}
								title={isCollapsed ? item.label : undefined}
								aria-current={isActive ? "page" : undefined}
								className={cn(
									"flex min-h-11 items-center rounded-xl text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950",
									isCollapsed ? "justify-center" : "gap-3 px-3",
									isActive &&
										"bg-emerald-50 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-800",
								)}
							>
								<Icon className="size-5 shrink-0" aria-hidden="true" />
								{!isCollapsed ? <span>{item.label}</span> : null}
							</Link>
						);
					})}
				</nav>
			</aside>

			<div
				className={cn(
					"min-w-0 transition-[margin] duration-300",
					isCollapsed ? "md:ml-20" : "md:ml-[248px]",
				)}
			>
				<DashboardTopBar
					title={active?.label ?? "Overview"}
					subtitle="AwaMenu Admin"
					brand={
						<Image
							src={LOGO_ICON_URL}
							alt="AwaMenu"
							width={32}
							height={32}
							className="size-8 rounded-lg object-contain"
						/>
					}
					backHref={backHref}
					sidebarCollapsed={isCollapsed}
					onToggleSidebar={toggleSidebar}
					account={{
						name: adminName,
						detail: adminEmail,
						role: "Super Admin",
						links: [
							{
								label: "Platform settings",
								href: `${basePath}/settings`,
								icon: Settings,
							},
							{ label: "Open website", href: "/", icon: ExternalLink },
						],
						onLogout: handleLogout,
					}}
				/>

				<main
					className={cn(
						"min-w-0 px-3 pt-3 min-[390px]:px-4 md:px-8 md:pt-6",
						TAB_BAR_PADDING,
					)}
				>
					{children}
				</main>
			</div>

			<MobileTabBar
				items={tabItems}
				moreItems={moreItems}
				basePath={basePath}
			/>
		</div>
	);
}
