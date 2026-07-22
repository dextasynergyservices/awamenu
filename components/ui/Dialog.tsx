"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DialogVariant = "center" | "sheet";
type DialogSize = "sm" | "md" | "lg" | "xl" | "2xl";

type DialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	children: ReactNode;
	/**
	 * "center" — always a centered card (small/simple dialogs).
	 * "sheet" — bottom sheet on mobile, centered dialog from `sm:` up
	 * (content-heavy forms/editors).
	 */
	variant?: DialogVariant;
	size?: DialogSize;
	className?: string;
};

const centerSizeClassName: Record<DialogSize, string> = {
	sm: "max-w-[280px] sm:max-w-xs",
	md: "max-w-md",
	lg: "max-w-lg",
	xl: "max-w-2xl",
	"2xl": "max-w-3xl",
};

const sheetSizeClassName: Record<DialogSize, string> = {
	sm: "sm:max-w-xs",
	md: "sm:max-w-md",
	lg: "sm:max-w-lg",
	xl: "sm:max-w-2xl",
	"2xl": "sm:max-w-3xl",
};

const overlayClassName =
	"fixed inset-0 z-160 bg-slate-950/50 backdrop-blur-sm data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=open]:animate-in";

const variantClassName: Record<DialogVariant, string> = {
	center:
		"fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] rounded-3xl data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
	sheet:
		"fixed inset-x-0 bottom-0 w-full rounded-t-3xl data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom sm:inset-x-auto sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0",
};

/**
 * Shared modal primitive used across the app — built on radix-ui's Dialog so
 * focus-trap/escape/scroll-lock/portal behavior is correct by construction.
 * Compose with `DialogHeader`, `DialogBody`, and optionally `DialogFooter`.
 */
export function Dialog({
	open,
	onOpenChange,
	children,
	variant = "center",
	size = "md",
	className,
}: DialogProps) {
	const sizeClass =
		variant === "sheet" ? sheetSizeClassName[size] : centerSizeClassName[size];

	return (
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Overlay className={overlayClassName} />
				<DialogPrimitive.Content
					className={cn(
						"fixed z-160 flex max-h-[90vh] flex-col overflow-hidden bg-white shadow-2xl outline-none duration-300 data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=open]:animate-in",
						variantClassName[variant],
						sizeClass,
						className,
					)}
				>
					{children}
				</DialogPrimitive.Content>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}

type DialogHeaderProps = {
	title: ReactNode;
	description?: ReactNode;
	hideCloseButton?: boolean;
	bordered?: boolean;
	className?: string;
};

export function DialogHeader({
	title,
	description,
	hideCloseButton,
	bordered = false,
	className,
}: DialogHeaderProps) {
	return (
		<div
			className={cn(
				"flex shrink-0 items-start justify-between gap-3 p-4 sm:p-5",
				bordered && "border-b border-slate-100",
				className,
			)}
		>
			<div className="min-w-0">
				<DialogPrimitive.Title className="text-base font-black text-slate-950 sm:text-lg">
					{title}
				</DialogPrimitive.Title>
				{description ? (
					<DialogPrimitive.Description className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">
						{description}
					</DialogPrimitive.Description>
				) : null}
			</div>
			{hideCloseButton ? null : (
				<DialogPrimitive.Close
					className="flex size-7 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 sm:size-8"
					aria-label="Close"
				>
					<X className="size-3.5 sm:size-4" aria-hidden="true" />
				</DialogPrimitive.Close>
			)}
		</div>
	);
}

export function DialogBody({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5",
				className,
			)}
		>
			{children}
		</div>
	);
}

/**
 * Footer shell — standardizes padding/border only. Each consumer supplies its
 * own flex layout for its buttons (some are always a row of 2, some stack on
 * mobile) via `className`/wrapping — footer button arrangements vary too much
 * across the app to prescribe one layout.
 */
export function DialogFooter({
	children,
	className,
	bordered = false,
}: {
	children: ReactNode;
	className?: string;
	bordered?: boolean;
}) {
	return (
		<div
			className={cn(
				"shrink-0 p-4 sm:p-5",
				bordered && "border-t border-slate-100",
				className,
			)}
		>
			{children}
		</div>
	);
}

export const DialogClose = DialogPrimitive.Close;
// Raw title/description primitives for custom layouts that don't use
// `DialogHeader`'s title-row-with-close-button structure. Radix requires a
// `Title` inside `Content` for accessibility — use this directly when a
// dialog's design doesn't have a conventional header row (e.g. a centered
// confirmation dialog).
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
