"use client";

import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import type { ReactNode } from "react";

type MobileModalProps = {
	open: boolean;
	onClose: () => void;
	title: ReactNode;
	description?: ReactNode;
	children: ReactNode;
};

const DISMISS_OFFSET = 80;
const DISMISS_VELOCITY = 600;

/**
 * The single native-feeling bottom sheet used across the platform admin's
 * mobile UI: slides up from under, drag handle doubles as a tap-to-close
 * button, and swiping it down past a threshold (offset or velocity) closes it.
 */
export function MobileModal({
	open,
	onClose,
	title,
	description,
	children,
}: MobileModalProps) {
	function handleDragEnd(_: unknown, info: PanInfo) {
		if (info.offset.y > DISMISS_OFFSET || info.velocity.y > DISMISS_VELOCITY) {
			onClose();
		}
	}

	return (
		<AnimatePresence>
			{open ? (
				<div className="fixed inset-0 z-160 md:hidden">
					<motion.button
						type="button"
						className="absolute inset-0 bg-slate-950/40"
						aria-label="Close"
						onClick={onClose}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
					/>
					<motion.div
						role="dialog"
						aria-modal="true"
						aria-label={typeof title === "string" ? title : undefined}
						className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl"
						initial={{ y: "100%" }}
						animate={{ y: 0 }}
						exit={{ y: "100%" }}
						transition={{ type: "spring", damping: 32, stiffness: 320 }}
						drag="y"
						dragConstraints={{ top: 0, bottom: 0 }}
						dragElastic={{ top: 0, bottom: 0.6 }}
						onDragEnd={handleDragEnd}
					>
						<button
							type="button"
							onClick={onClose}
							aria-label="Close"
							className="flex w-full shrink-0 cursor-grab justify-center py-2.5 active:cursor-grabbing"
						>
							<span className="h-1.5 w-10 rounded-full bg-slate-300" />
						</button>
						<div className="shrink-0 px-4 pb-3">
							<h2 className="truncate text-sm font-black text-slate-950">
								{title}
							</h2>
							{description ? (
								<p className="truncate text-xs font-medium text-slate-500">
									{description}
								</p>
							) : null}
						</div>
						<div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
							{children}
						</div>
					</motion.div>
				</div>
			) : null}
		</AnimatePresence>
	);
}
