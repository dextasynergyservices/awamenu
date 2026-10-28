"use client";

import {
	BarChart3,
	CalendarDays,
	ClipboardList,
	CreditCard,
	LayoutDashboard,
	MonitorSmartphone,
	Receipt,
	Settings,
	Sparkles,
	Users,
	Utensils,
	Wallet,
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
import { InstallPWAPrompt } from "@/components/notifications/InstallPWAPrompt";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationDrawer } from "@/components/notifications/NotificationDrawer";
import { PushPermissionPrompt } from "@/components/notifications/PushPermissionPrompt";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { useNotificationStream } from "@/hooks/useNotificationStream";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { Notification } from "@/stores/notification.store";
import { useNotificationStore } from "@/stores/notification.store";

type AdminDashboardShellProps = {
	children: React.ReactNode;
	restaurantId: string;
	restaurantName: string;
	restaurantLogoUrl: string | null;
	slug: string;
	userId: string;
	userName: string;
	userEmail: string;
	initialNotifications: Notification[];
	initialUnreadCount: number;
	isPaid?: boolean;
};

const navItems: NavItem[] = [
	{ label: "Dashboard", href: "", icon: LayoutDashboard },
	{ label: "Orders", href: "/orders", icon: ClipboardList },
	{ label: "Menu", href: "/menu", icon: Utensils },
	{
		label: "Reservations",
		shortLabel: "Bookings",
		href: "/reservations",
		icon: CalendarDays,
	},
	{ label: "Staff", href: "/staff", icon: Users },
	{ label: "Analytics", href: "/analytics", icon: BarChart3 },
	{ label: "Payments", href: "/financials", icon: Wallet },
	{ label: "Billing", href: "/billing", icon: Receipt },
	{ label: "Settings", href: "/settings", icon: Settings },
];
const tabItems = navItems.slice(0, 4);
const moreItems = navItems.slice(4);

const SIDEBAR_KEY = "awamenu_admin_sidebar_collapsed";

export function AdminDashboardShell({
	children,
	restaurantId,
	restaurantName,
	restaurantLogoUrl,
	slug,
	userId,
	userName,
	userEmail,
	initialNotifications,
	initialUnreadCount,
	isPaid = false,
}: AdminDashboardShellProps) {
	const router = useRouter();
	const basePath = `/dashboard/${slug}`;
	const { active, pathname, backHref } = useActiveNav(navItems, basePath);
	const [drawerOpen, setDrawerOpen] = useState(false);
	// Read after mount so server and client render the same HTML.
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

	// Initialize notification store with server-fetched data
	const setNotifications = useNotificationStore((s) => s.setNotifications);
	useEffect(() => {
		setNotifications(initialNotifications, initialUnreadCount);
	}, [setNotifications, initialNotifications, initialUnreadCount]);

	// Poll for new notifications (see hook — SSE pinned a serverless function
	// per open dashboard and timed out on Vercel).
	useNotificationStream(restaurantId, {
		recipientType: "admin",
		recipientId: userId,
		onNotification(notification) {
			// The only thing that refreshes these pages: the separate 5-second
			// full-page pollers on the orders and reservations pages were removed,
			// so every event that changes what they show must be listed here.
			if (
				notification.type === "NEW_ORDER" ||
				notification.type === "ORDER_STATUS_CHANGED" ||
				notification.type === "ORDER_CANCELLED" ||
				notification.type === "PAYMENT_RECEIVED" ||
				notification.type === "NEW_RESERVATION" ||
				notification.type === "RESERVATION_CANCELLED" ||
				notification.type === "RESERVATION_EXPIRED"
			) {
				router.refresh();
			}
		},
	});

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
					"fixed inset-y-0 left-0 z-40 hidden flex-col border-slate-200/70 border-r bg-white transition-[width] duration-300 md:flex print:hidden",
					isCollapsed ? "w-20" : "w-[248px]",
				)}
			>
				<Link
					href={basePath}
					className={cn(
						"flex h-16 shrink-0 items-center gap-3 border-slate-200/70 border-b",
						isCollapsed ? "justify-center" : "px-5",
					)}
				>
					<RestaurantLogo
						name={restaurantName}
						logoUrl={restaurantLogoUrl}
						className="size-9 shrink-0 rounded-xl"
					/>
					{!isCollapsed ? (
						<span className="truncate text-base font-black text-slate-950">
							{restaurantName}
						</span>
					) : null}
				</Link>
				<nav
					aria-label="Restaurant"
					className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto px-3 py-4"
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
				{!isPaid ? (
					<div className="shrink-0 p-3">
						{isCollapsed ? (
							<Link
								href={`${basePath}/settings/plan`}
								title="Upgrade your plan"
								className="mx-auto grid size-10 place-items-center rounded-xl bg-emerald-700 text-white"
							>
								<Sparkles className="size-4" aria-hidden="true" />
							</Link>
						) : (
							<div className="rounded-2xl border border-lime-100 bg-lime-50 p-4">
								<p className="text-sm font-black text-emerald-800">
									Upgrade your plan
								</p>
								<p className="mt-1 text-xs font-medium leading-5 text-slate-600">
									More items, templates, your own branding and advanced
									analytics.
								</p>
								<Link
									href={`${basePath}/settings/plan`}
									className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-xl bg-emerald-700 px-3 text-xs font-black text-white"
								>
									See plans
								</Link>
							</div>
						)}
					</div>
				) : null}
			</aside>

			<div
				className={cn(
					"min-w-0 transition-[margin] duration-300 print:ml-0",
					isCollapsed ? "md:ml-20" : "md:ml-[248px]",
				)}
			>
				<DashboardTopBar
					title={active?.label ?? "Dashboard"}
					subtitle={restaurantName}
					brand={
						<RestaurantLogo
							name={restaurantName}
							logoUrl={restaurantLogoUrl}
							className="size-8 rounded-lg"
						/>
					}
					backHref={backHref}
					sidebarCollapsed={isCollapsed}
					onToggleSidebar={toggleSidebar}
					actions={
						<NotificationBell
							onClick={() => setDrawerOpen(true)}
							className="border-0 shadow-none md:border md:shadow-sm"
						/>
					}
					account={{
						name: userName,
						detail: userEmail,
						role: "Owner",
						links: [
							{
								label: "View public menu",
								href: `/${slug}`,
								icon: MonitorSmartphone,
							},
							{
								label: "Restaurant settings",
								href: `${basePath}/settings`,
								icon: Settings,
							},
							{
								label: "Billing & invoices",
								href: `${basePath}/billing`,
								icon: CreditCard,
							},
						],
						onLogout: handleLogout,
					}}
				/>

				<main
					className={cn(
						"min-w-0 px-3 pt-3 min-[390px]:px-4 md:px-8 md:pt-6 print:p-0",
						TAB_BAR_PADDING,
					)}
				>
					{/* PWA & Push permission prompts */}
					<InstallPWAPrompt />
					<PushPermissionPrompt
						restaurantId={restaurantId}
						recipientType="admin"
						recipientId={userId}
					/>
					{children}
				</main>
			</div>

			<MobileTabBar
				items={tabItems}
				moreItems={moreItems}
				moreExtra={[
					{ label: "Preview menu", href: `/${slug}`, icon: MonitorSmartphone },
				]}
				basePath={basePath}
			/>

			<NotificationDrawer
				open={drawerOpen}
				onClose={() => setDrawerOpen(false)}
				slug={slug}
				recipientType="admin"
				recipientId={userId}
			/>
		</div>
	);
}

function RestaurantLogo({
	name,
	logoUrl,
	className,
}: {
	name: string;
	logoUrl: string | null;
	className: string;
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
			className={`${className} grid place-items-center bg-emerald-700 text-sm font-black text-white`}
		>
			{name.charAt(0).toUpperCase()}
		</span>
	);
}
