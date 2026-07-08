"use client";

import {
	Bell,
	CalendarDays,
	ClipboardList,
	CreditCard,
	ShoppingBag,
	X as XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notification } from "@/stores/notification.store";

type NotificationItemProps = {
	notification: Notification;
	onRead?: (id: string) => void;
	onClick?: (notification: Notification) => void;
};

const typeIcons: Record<string, typeof Bell> = {
	NEW_ORDER: ShoppingBag,
	ORDER_STATUS_CHANGED: ClipboardList,
	ORDER_CANCELLED: XIcon,
	NEW_RESERVATION: CalendarDays,
	RESERVATION_CANCELLED: XIcon,
	RESERVATION_EXPIRED: CalendarDays,
	PAYMENT_RECEIVED: CreditCard,
};

const typeColors: Record<string, string> = {
	NEW_ORDER: "bg-blue-100 text-blue-700",
	ORDER_STATUS_CHANGED: "bg-amber-100 text-amber-700",
	ORDER_CANCELLED: "bg-red-100 text-red-700",
	NEW_RESERVATION: "bg-emerald-100 text-emerald-700",
	RESERVATION_CANCELLED: "bg-red-100 text-red-700",
	RESERVATION_EXPIRED: "bg-slate-100 text-slate-600",
	PAYMENT_RECEIVED: "bg-green-100 text-green-700",
};

function getRelativeTime(dateString: string) {
	const now = Date.now();
	const date = new Date(dateString).getTime();
	const diffSeconds = Math.floor((now - date) / 1000);

	if (diffSeconds < 60) return "Just now";
	if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
	if (diffSeconds < 86_400) return `${Math.floor(diffSeconds / 3600)}h ago`;
	return `${Math.floor(diffSeconds / 86_400)}d ago`;
}

export function NotificationItem({
	notification,
	onRead,
	onClick,
}: NotificationItemProps) {
	const Icon = typeIcons[notification.type] ?? Bell;
	const iconColor =
		typeColors[notification.type] ?? "bg-slate-100 text-slate-600";

	function handleClick() {
		if (!notification.isRead && onRead) {
			onRead(notification.id);
		}
		if (onClick) {
			onClick(notification);
		}
	}

	return (
		<button
			type="button"
			onClick={handleClick}
			className={cn(
				"flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-slate-50",
				!notification.isRead && "bg-emerald-50/60",
			)}
		>
			<span
				className={cn(
					"grid size-10 shrink-0 place-items-center rounded-xl",
					iconColor,
				)}
			>
				<Icon className="size-5" />
			</span>
			<div className="min-w-0 flex-1">
				<div className="flex items-start justify-between gap-2">
					<p
						className={cn(
							"text-sm leading-tight",
							notification.isRead
								? "font-semibold text-slate-600"
								: "font-black text-slate-900",
						)}
					>
						{notification.title}
					</p>
					{!notification.isRead && (
						<span className="mt-1 size-2 shrink-0 rounded-full bg-emerald-500" />
					)}
				</div>
				<p className="mt-0.5 text-sm leading-snug text-slate-500 line-clamp-2">
					{notification.body}
				</p>
				<p className="mt-1 text-xs font-medium text-slate-400">
					{getRelativeTime(notification.createdAt)}
				</p>
			</div>
		</button>
	);
}
