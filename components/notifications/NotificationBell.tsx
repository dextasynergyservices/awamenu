"use client";

import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

type NotificationBellProps = {
	className?: string;
	unreadCount?: number;
};

export function NotificationBell({
	className,
	unreadCount = 0,
}: NotificationBellProps) {
	const displayCount = unreadCount > 99 ? "99+" : unreadCount.toString();

	return (
		<button
			type="button"
			className={cn(
				"relative grid size-10 place-items-center rounded-full border border-emerald-100 bg-white text-emerald-950 shadow-sm transition-colors hover:bg-emerald-50 sm:size-11",
				className,
			)}
			aria-label={
				unreadCount > 0
					? `${displayCount} unread notifications`
					: "Notifications"
			}
		>
			<Bell className="size-5" aria-hidden="true" />
			{unreadCount > 0 ? (
				<span className="-right-1 -top-1 absolute grid min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white">
					{displayCount}
				</span>
			) : null}
		</button>
	);
}
