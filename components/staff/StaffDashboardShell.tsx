"use client";

import { LogOut } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { staffLogoutAction } from "@/actions/staff.actions";
import { InstallPWAPrompt } from "@/components/notifications/InstallPWAPrompt";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { NotificationDrawer } from "@/components/notifications/NotificationDrawer";
import { PushPermissionPrompt } from "@/components/notifications/PushPermissionPrompt";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { useNotificationStream } from "@/hooks/useNotificationStream";
import type { StaffPermissions } from "@/lib/staff-permissions";
import type { Notification } from "@/stores/notification.store";
import { useNotificationStore } from "@/stores/notification.store";

type StaffDashboardShellProps = {
	children: React.ReactNode;
	restaurantId: string;
	restaurantName: string;
	restaurantLogoUrl: string | null;
	slug: string;
	staffId: string;
	staffName: string;
	staffCode: string;
	currency: string;
	permissions: StaffPermissions;
	initialNotifications: Notification[];
	initialUnreadCount: number;
};

export function StaffDashboardShell({
	children,
	restaurantId,
	restaurantName,
	restaurantLogoUrl,
	slug,
	staffId,
	staffName,
	staffCode,
	initialNotifications,
	initialUnreadCount,
}: StaffDashboardShellProps) {
	const router = useRouter();
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [isLoggingOut, startLogout] = useTransition();

	// Initialize notification store
	const setNotifications = useNotificationStore((s) => s.setNotifications);
	useEffect(() => {
		setNotifications(initialNotifications, initialUnreadCount);
	}, [setNotifications, initialNotifications, initialUnreadCount]);

	// SSE for real-time notifications
	useNotificationStream(restaurantId, {
		onNotification(notification) {
			if (
				notification.type === "NEW_ORDER" ||
				notification.type === "ORDER_STATUS_CHANGED" ||
				notification.type === "ORDER_CANCELLED" ||
				notification.type === "PAYMENT_RECEIVED"
			) {
				router.refresh();
			}
		},
	});

	return (
		<div className="min-h-screen bg-slate-50">
			<OfflineBanner />

			{/* Header */}
			<header className="fixed inset-x-0 top-0 z-30 border-b border-emerald-100 bg-white/95 px-3 py-3 backdrop-blur min-[390px]:px-4 sm:px-6">
				<div className="flex items-center gap-3">
					{/* Restaurant branding */}
					<div className="flex min-w-0 flex-1 items-center gap-2.5">
						{restaurantLogoUrl ? (
							<Image
								src={restaurantLogoUrl}
								alt={restaurantName}
								width={40}
								height={40}
								className="size-10 shrink-0 rounded-xl object-cover"
								unoptimized
							/>
						) : (
							<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-700 text-lg font-black text-white">
								{restaurantName.charAt(0).toUpperCase()}
							</span>
						)}
						<div className="min-w-0">
							<p className="truncate text-sm font-black text-slate-950">
								{restaurantName}
							</p>
							<p className="truncate text-xs font-medium text-slate-500">
								{staffName} · {staffCode}
							</p>
						</div>
					</div>

					{/* Actions */}
					<div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
						<NotificationBell onClick={() => setDrawerOpen(true)} />
						<button
							type="button"
							onClick={() => startLogout(() => staffLogoutAction(slug))}
							disabled={isLoggingOut}
							title="Lock Terminal"
							className="grid size-10 place-items-center rounded-xl bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 disabled:opacity-50"
						>
							<LogOut className="size-5" />
						</button>
					</div>
				</div>
			</header>

			{/* Main content */}
			<main className="min-w-0 px-3 pt-[76px] pb-6 min-[390px]:px-4 sm:px-6">
				<InstallPWAPrompt />
				<PushPermissionPrompt
					restaurantId={restaurantId}
					recipientType="staff"
					recipientId={staffId}
				/>
				{children}
			</main>

			{/* Notification Drawer */}
			<NotificationDrawer
				open={drawerOpen}
				onClose={() => setDrawerOpen(false)}
				slug={slug}
				recipientType="staff"
				recipientId={staffId}
			/>
		</div>
	);
}
