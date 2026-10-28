"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { staffLogoutAction } from "@/actions/staff.actions";
import { DashboardTopBar } from "@/components/dashboard/DashboardChrome";
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
	initialNotifications,
	initialUnreadCount,
}: StaffDashboardShellProps) {
	const router = useRouter();
	const [drawerOpen, setDrawerOpen] = useState(false);

	// Initialize notification store
	const setNotifications = useNotificationStore((s) => s.setNotifications);
	useEffect(() => {
		setNotifications(initialNotifications, initialUnreadCount);
	}, [setNotifications, initialNotifications, initialUnreadCount]);

	// Poll for new notifications (see hook — SSE pinned a serverless function
	// per open terminal and timed out on Vercel).
	useNotificationStream(restaurantId, {
		recipientType: "staff",
		recipientId: "shared",
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

	return (
		<div className="min-h-screen bg-slate-50">
			<OfflineBanner />

			<DashboardTopBar
				title="Orders & bookings"
				subtitle={restaurantName}
				brand={
					restaurantLogoUrl ? (
						<Image
							src={restaurantLogoUrl}
							alt=""
							width={32}
							height={32}
							className="size-8 rounded-lg object-cover"
							unoptimized
						/>
					) : (
						<span className="grid size-8 place-items-center rounded-lg bg-emerald-700 text-sm font-black text-white">
							{restaurantName.charAt(0).toUpperCase()}
						</span>
					)
				}
				actions={
					<NotificationBell
						onClick={() => setDrawerOpen(true)}
						className="border-0 shadow-none md:border md:shadow-sm"
					/>
				}
				account={{
					name: "Staff terminal",
					detail: restaurantName,
					role: "Staff",
					imageUrl: null,
					logoutLabel: "Lock terminal",
					onLogout: () => staffLogoutAction(slug),
				}}
			/>

			{/* Main content */}
			<main className="min-w-0 px-3 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] min-[390px]:px-4 sm:px-6">
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
