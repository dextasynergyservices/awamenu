"use client";

import { BellOff, CheckCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
	const [selectedNotification, setSelectedNotification] =
		useState<Notification | null>(null);

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

	function handleNotificationClick(notification: Notification) {
		handleMarkRead(notification.id);
		setSelectedNotification(notification);
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
			<div
				className={cn(
					"fixed top-0 right-0 flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out",
					open ? "translate-x-0" : "translate-x-full",
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

			{/* Notification Detail Modal */}
			{selectedNotification && (
				<div
					className="fixed inset-0 flex items-end sm:items-center justify-center p-4 sm:p-0"
					style={{ zIndex: 110 }}
				>
					{/* biome-ignore lint/a11y/useKeyWithClickEvents: Backdrop does not need keyboard interactions */}
					{/* biome-ignore lint/a11y/noStaticElementInteractions: Backdrop should not be focusable */}
					<div
						className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm cursor-pointer"
						onClick={() => setSelectedNotification(null)}
					/>
					<div className="relative w-full max-w-sm overflow-hidden rounded-[2rem] bg-white p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95">
						<button
							type="button"
							onClick={() => setSelectedNotification(null)}
							className="absolute top-4 right-4 grid size-8 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
						>
							<X className="size-4" />
						</button>
						<div className="mt-2 text-center">
							<h3 className="text-xl font-black text-slate-950">
								{selectedNotification.title}
							</h3>
							<p className="mt-3 text-sm font-medium text-slate-600 leading-relaxed">
								{selectedNotification.body}
							</p>
						</div>
						<div className="mt-8 grid gap-3">
							{selectedNotification.actionUrl && (
								<button
									type="button"
									onClick={() => {
										if (
											recipientType === "staff" &&
											selectedNotification.actionUrl
										) {
											const query =
												selectedNotification.actionUrl.split("?")[1];
											router.push(`/${slug}/staff?${query || ""}`);
										} else if (selectedNotification.actionUrl) {
											router.push(selectedNotification.actionUrl);
										}
										setSelectedNotification(null);
										onClose();
									}}
									className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white"
								>
									Attend Task
								</button>
							)}
							<button
								type="button"
								onClick={() => setSelectedNotification(null)}
								className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700"
							>
								Dismiss
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
