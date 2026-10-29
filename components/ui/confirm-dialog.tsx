"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import {
	Dialog,
	DialogDescription,
	DialogFooter,
	DialogTitle,
} from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";

export type ConfirmTone = "danger" | "default";

type ConfirmDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: ReactNode;
	message?: ReactNode;
	confirmLabel?: ReactNode;
	cancelLabel?: string;
	tone?: ConfirmTone;
	/** Keeps the dialog open with a spinner while the action runs. */
	pending?: boolean;
	/** The server's refusal, shown inside the dialog so it can be retried. */
	error?: string | null;
	onConfirm: () => void;
};

/**
 * Splits a one-line prompt ("Delete Opusbar? This cannot be undone.") into a
 * title and the explanation after it, so existing confirm strings read well
 * as a dialog.
 */
export function splitConfirm(text: string): {
	title: string;
	message?: string;
} {
	const match = text.match(/^([\s\S]+?[?.!])\s+([\s\S]+)$/);
	return match ? { title: match[1], message: match[2] } : { title: text };
}

/**
 * The app's "are you sure?" — used instead of window.confirm, which can't be
 * styled, blocks the page, and is suppressed by some in-app browsers.
 */
export function ConfirmDialog({
	open,
	onOpenChange,
	title,
	message,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	tone = "danger",
	pending = false,
	error,
	onConfirm,
}: ConfirmDialogProps) {
	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				// Don't drop a running action halfway.
				if (!pending) onOpenChange(next);
			}}
			size="md"
		>
			<div className="flex gap-3 p-4 sm:p-5">
				<span
					className={cn(
						"grid size-10 shrink-0 place-items-center rounded-full",
						tone === "danger"
							? "bg-red-50 text-red-600"
							: "bg-emerald-50 text-emerald-700",
					)}
				>
					<AlertTriangle className="size-5" aria-hidden="true" />
				</span>
				<div className="min-w-0">
					<DialogTitle className="text-base font-black text-slate-950">
						{title}
					</DialogTitle>
					{message ? (
						<DialogDescription className="mt-1 text-sm font-medium text-slate-600">
							{message}
						</DialogDescription>
					) : null}
					{error ? (
						<p
							role="alert"
							className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
						>
							{error}
						</p>
					) : null}
				</div>
			</div>
			<DialogFooter
				bordered
				className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
			>
				<button
					type="button"
					onClick={() => onOpenChange(false)}
					disabled={pending}
					className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
				>
					{cancelLabel}
				</button>
				<button
					type="button"
					onClick={onConfirm}
					disabled={pending}
					className={cn(
						"inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black text-white disabled:opacity-70",
						tone === "danger"
							? "bg-red-600 hover:bg-red-700"
							: "bg-emerald-700 hover:bg-emerald-800",
					)}
				>
					{pending ? (
						<Loader2 className="size-4 animate-spin" aria-hidden="true" />
					) : null}
					{confirmLabel}
				</button>
			</DialogFooter>
		</Dialog>
	);
}
