import { create } from "zustand";

type UIState = {
	isOnline: boolean;
	setOnline: (online: boolean) => void;
};

export const useUIStore = create<UIState>((set) => ({
	isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
	setOnline: (online) => set({ isOnline: online }),
}));
