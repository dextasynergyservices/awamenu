import { create } from "zustand";

export type Notification = {
	id: string;
	type: string;
	audience: string;
	title: string;
	body: string;
	actionUrl?: string;
	metadata?: Record<string, unknown>;
	createdAt: string;
	isRead?: boolean;
};

type NotificationState = {
	notifications: Notification[];
	unreadCount: number;

	/** Add a new notification from SSE and increment unread */
	addNotification: (notification: Notification) => void;

	/** Set the initial list of notifications (e.g. from server fetch) */
	setNotifications: (
		notifications: Notification[],
		unreadCount: number,
	) => void;

	/** Mark a single notification as read */
	markRead: (notificationId: string) => void;

	/** Mark all notifications as read */
	markAllRead: () => void;

	/** Clear all notifications from the store */
	clear: () => void;
};

export const useNotificationStore = create<NotificationState>((set) => ({
	notifications: [],
	unreadCount: 0,

	addNotification: (notification) =>
		set((state) => ({
			notifications: [notification, ...state.notifications].slice(0, 100),
			unreadCount: state.unreadCount + 1,
		})),

	setNotifications: (notifications, unreadCount) =>
		set({ notifications, unreadCount }),

	markRead: (notificationId) =>
		set((state) => {
			const target = state.notifications.find((n) => n.id === notificationId);
			if (!target || target.isRead) return state;

			return {
				notifications: state.notifications.map((n) =>
					n.id === notificationId ? { ...n, isRead: true } : n,
				),
				unreadCount: Math.max(0, state.unreadCount - 1),
			};
		}),

	markAllRead: () =>
		set((state) => ({
			notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
			unreadCount: 0,
		})),

	clear: () => set({ notifications: [], unreadCount: 0 }),
}));
