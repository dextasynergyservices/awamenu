"use client";

import { BellOff, CheckCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { NotificationItem } from "@/components/notifications/NotificationItem";
import { cn } from "@/lib/utils";
import {
	type Notification,
	useNotificationStore,
} from "@/stores/notification.store";

type NotificationDrawerProps = {
	open: boolean;
	onClose: () => void;
	slug: string;
	recipientType: "admin" | "staff";
	recipientId: string;
};

export function NotificationDrawer({
	open,
	onClose,
	slug,
	recipientType,
	recipientId,
}: NotificationDrawerProps) {
	const router = useRouter();

	const notifications = useNotificationStore((s) => s.notifications);
	const unreadCount = useNotificationStore((s) => s.unreadCount);
	const markRead = useNotificationStore((s) => s.markRead);
	const markAllRead = useNotificationStore((s) => s.markAllRead);

	async function handleMarkRead(notificationId: string) {
		markRead(notificationId);
		// Fire-and-forget server call
		fetch("/api/notifications/mark-read", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ notificationId, recipientType, recipientId }),
		}).catch(() => {});
	}

	function handleMarkAllRead() {
		markAllRead();
		fetch("/api/notifications/mark-all-read", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ slug, recipientType, recipientId }),
		}).catch(() => {});
	}

	/**
	 * Straight to the order or booking: the old confirm step ("Attend Task")
	 * added a tap and said nothing the list item didn't.
	 */
	function handleNotificationClick(notification: Notification) {
		if (!notification.actionUrl) return;
		const query = notification.actionUrl.split("?")[1];
		router.push(
			recipientType === "staff"
				? `/${slug}/staff${query ? `?${query}` : ""}`
				: notification.actionUrl,
		);
		onClose();
	}

	return (
		<>
			{/* Backdrop */}
			{open && (
				<div
					className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm"
					style={{ zIndex: 90 }}
				>
					<button
						type="button"
						className="absolute inset-0 cursor-default"
						aria-label="Close notifications"
						onClick={onClose}
					/>
				</div>
			)}

			{/* Drawer */}
			{/* Hidden once slid out: otherwise its shadow showed along the screen
			    edge and screen readers could still reach it. */}
			<div
				aria-hidden={!open}
				className={cn(
					"fixed top-0 right-0 flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl transition-[transform,visibility] duration-300 ease-out",
					open ? "visible translate-x-0" : "invisible translate-x-full",
				)}
				style={{ zIndex: 100 }}
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
					<div>
						<h2 className="text-lg font-black text-slate-900">Notifications</h2>
						{unreadCount > 0 && (
							<p className="text-sm font-semibold text-slate-500">
								{unreadCount} unread
							</p>
						)}
					</div>
					<div className="flex items-center gap-2">
						{unreadCount > 0 && (
							<button
								type="button"
								onClick={handleMarkAllRead}
								className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
								aria-label="Mark all as read"
							>
								<CheckCheck className="size-4" />
								<span className="hidden sm:inline">Mark all read</span>
							</button>
						)}
						<button
							type="button"
							onClick={onClose}
							className="grid size-10 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100"
							aria-label="Close notifications"
						>
							<X className="size-5" />
						</button>
					</div>
				</div>

				{/* List */}
				<div className="flex-1 overflow-y-auto">
					{notifications.length === 0 ? (
						<div className="grid place-items-center px-5 py-20 text-center">
							<BellOff className="size-12 text-slate-300" />
							<p className="mt-4 text-sm font-bold text-slate-400">
								No notifications yet
							</p>
							<p className="mt-1 text-xs text-slate-400">
								New orders and updates will appear here
							</p>
						</div>
					) : (
						<div className="grid gap-1 p-2">
							{notifications.map((notification) => (
								<NotificationItem
									key={notification.id}
									notification={notification}
									onRead={handleMarkRead}
									onClick={handleNotificationClick}
								/>
							))}
						</div>
					)}
				</div>
			</div>
		</>
	);
}
