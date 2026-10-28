"use client";

import { Loader2, type LucideIcon, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	useTransition,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * The "⋯" menu for a table row's actions, so rows stay clean and every table
 * handles actions the same way.
 *
 * Rendered in a portal with fixed positioning: tables sit in scrolling
 * containers that would clip an ordinary dropdown. Flips upward near the
 * bottom of the screen; closes on outside click, Escape, scroll or resize.
 */

type Ctx = { close: () => void; setError: (message: string | null) => void };
const RowActionsContext = createContext<Ctx>({
	close: () => {},
	setError: () => {},
});

const MENU_WIDTH = 208;

export function RowActions({
	label,
	children,
	className,
}: {
	/** Accessible name, e.g. "Actions for Opusbar". */
	label: string;
	children: ReactNode;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [position, setPosition] = useState<{
		top: number;
		left: number;
		up: boolean;
	} | null>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const menuId = useId();

	const close = useCallback(() => {
		setOpen(false);
		setError(null);
	}, []);

	const place = useCallback(() => {
		const trigger = triggerRef.current;
		if (!trigger) return;
		const rect = trigger.getBoundingClientRect();
		const menuHeight = menuRef.current?.offsetHeight ?? 200;
		const up =
			rect.bottom + menuHeight + 8 > window.innerHeight &&
			rect.top > menuHeight + 8;
		const left = Math.min(
			Math.max(8, rect.right - MENU_WIDTH),
			window.innerWidth - MENU_WIDTH - 8,
		);
		setPosition({
			top: up ? rect.top - menuHeight - 4 : rect.bottom + 4,
			left,
			up,
		});
	}, []);

	useLayoutEffect(() => {
		if (open) place();
	}, [open, place]);

	useEffect(() => {
		if (!open) return;
		function onPointer(event: PointerEvent) {
			const target = event.target as Node;
			if (
				menuRef.current?.contains(target) ||
				triggerRef.current?.contains(target)
			)
				return;
			close();
		}
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") {
				close();
				triggerRef.current?.focus();
			}
		}
		document.addEventListener("pointerdown", onPointer);
		document.addEventListener("keydown", onKey);
		window.addEventListener("resize", close);
		window.addEventListener("scroll", close, true);
		return () => {
			document.removeEventListener("pointerdown", onPointer);
			document.removeEventListener("keydown", onKey);
			window.removeEventListener("resize", close);
			window.removeEventListener("scroll", close, true);
		};
	}, [open, close]);

	return (
		<RowActionsContext.Provider value={{ close, setError }}>
			<button
				ref={triggerRef}
				type="button"
				aria-label={label}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls={open ? menuId : undefined}
				onClick={() => setOpen((v) => !v)}
				className={cn(
					"grid size-8 place-items-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 aria-expanded:bg-slate-100 aria-expanded:text-slate-900",
					className,
				)}
			>
				<MoreHorizontal className="size-4" aria-hidden="true" />
			</button>
			{open && typeof document !== "undefined"
				? createPortal(
						<div
							ref={menuRef}
							id={menuId}
							role="menu"
							aria-label={label}
							style={{
								position: "fixed",
								top: position?.top ?? -9999,
								left: position?.left ?? -9999,
								width: MENU_WIDTH,
							}}
							className="z-[200] grid gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-[0_16px_40px_rgba(15,23,42,0.16)]"
						>
							{children}
							{error ? (
								<p
									role="alert"
									className="mx-1 mt-1 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] font-bold text-red-700"
								>
									{error}
								</p>
							) : null}
						</div>,
						document.body,
					)
				: null}
		</RowActionsContext.Provider>
	);
}

const itemClass = (tone: "default" | "danger" | "success") =>
	cn(
		"flex min-h-8 w-full items-center gap-2 rounded-lg px-2.5 text-left text-xs font-semibold transition-colors disabled:opacity-50",
		tone === "danger"
			? "text-red-600 hover:bg-red-50"
			: tone === "success"
				? "text-emerald-700 hover:bg-emerald-50"
				: "text-slate-700 hover:bg-slate-100",
	);

type ItemProps = {
	icon?: LucideIcon;
	tone?: "default" | "danger" | "success";
	children: ReactNode;
	disabled?: boolean;
	/** Shown as a tooltip when disabled, e.g. why it can't be done. */
	title?: string;
};

/** Runs a client handler (open a dialog, open an editor…), then closes. */
export function RowActionButton({
	onSelect,
	icon: Icon,
	tone = "default",
	children,
	disabled,
	title,
}: ItemProps & { onSelect: () => void }) {
	const { close } = useContext(RowActionsContext);
	return (
		<button
			type="button"
			role="menuitem"
			disabled={disabled}
			title={title}
			onClick={() => {
				close();
				onSelect();
			}}
			className={itemClass(tone)}
		>
			{Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
			{children}
		</button>
	);
}

export function RowActionLink({
	href,
	icon: Icon,
	tone = "default",
	children,
	external,
}: Omit<ItemProps, "disabled" | "title"> & {
	href: string;
	external?: boolean;
}) {
	const { close } = useContext(RowActionsContext);
	return (
		<Link
			href={href}
			role="menuitem"
			onClick={close}
			target={external ? "_blank" : undefined}
			className={itemClass(tone)}
		>
			{Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
			{children}
		</Link>
	);
}

/**
 * Submits a server action with the given fields. Asks first when `confirm` is
 * set. Shows the server's error inside the menu; closes on success.
 */
export function RowActionForm({
	action,
	fields,
	confirm,
	icon: Icon,
	tone = "default",
	children,
	disabled,
	title,
	onDone,
}: ItemProps & {
	action: (formData: FormData) => Promise<unknown>;
	fields: Record<string, string>;
	confirm?: string;
	onDone?: () => void;
}) {
	const { close, setError } = useContext(RowActionsContext);
	const [pending, startTransition] = useTransition();
	return (
		<button
			type="button"
			role="menuitem"
			disabled={disabled || pending}
			title={title}
			onClick={() => {
				if (confirm && !window.confirm(confirm)) return;
				const fd = new FormData();
				for (const [key, value] of Object.entries(fields)) fd.set(key, value);
				setError(null);
				startTransition(async () => {
					try {
						const result = await action(fd);
						if (result && typeof result === "object" && "error" in result) {
							setError(String(result.error));
							return;
						}
						close();
						onDone?.();
					} catch {
						setError("Something went wrong. Please try again.");
					}
				});
			}}
			className={itemClass(tone)}
		>
			{pending ? (
				<Loader2
					className="size-3.5 shrink-0 animate-spin"
					aria-hidden="true"
				/>
			) : Icon ? (
				<Icon className="size-3.5 shrink-0" aria-hidden="true" />
			) : null}
			{children}
		</button>
	);
}

export function RowActionSeparator() {
	return <hr className="my-0.5 border-0 border-slate-100 border-t" />;
}
