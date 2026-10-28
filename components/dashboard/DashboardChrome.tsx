"use client";

import {
	ChevronDown,
	ChevronLeft,
	Ellipsis,
	LogOut,
	type LucideIcon,
	PanelLeftClose,
	PanelLeftOpen,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { MobileModal } from "@/components/ui/MobileModal";
import { cn } from "@/lib/utils";

/**
 * The chrome every dashboard shares (Super Admin, owner, staff):
 *
 * - Desktop: a sticky header with the page title and an account menu, so
 *   Log out is always one click away (it used to sit at the bottom of a
 *   sidebar that could run off the screen).
 * - Mobile: a native-style app bar (title, back arrow on sub-pages, avatar)
 *   and a full-width bottom tab bar that respects the home indicator, with
 *   "More" and the account in bottom sheets.
 */

export type NavItem = {
	label: string;
	/** Relative to the dashboard's base path; "" is the home tab. */
	href: string;
	icon: LucideIcon;
	/** Shorter label for the mobile tab bar, where space is tight. */
	shortLabel?: string;
};

export type AccountLink = { label: string; href: string; icon: LucideIcon };

/** The nav item for the current page (longest matching path wins). */
export function useActiveNav(items: NavItem[], basePath: string) {
	const pathname = usePathname();
	let active: NavItem | null = null;
	for (const item of items) {
		const href = `${basePath}${item.href}`;
		const matches =
			pathname === href ||
			(item.href !== "" && pathname.startsWith(`${href}/`));
		if (matches && (!active || item.href.length > active.href.length)) {
			active = item;
		}
	}
	const activeHref = active ? `${basePath}${active.href}` : basePath;
	return {
		active,
		pathname,
		/** On a page below a tab (e.g. a restaurant's detail): show a back arrow. */
		backHref: active && pathname !== activeHref ? activeHref : null,
	};
}

export function isNavActive(pathname: string, basePath: string, item: NavItem) {
	const href = `${basePath}${item.href}`;
	return (
		pathname === href || (item.href !== "" && pathname.startsWith(`${href}/`))
	);
}

// ─── Avatar ──────────────────────────────────────────────────────

export function Avatar({
	name,
	imageUrl,
	className,
}: {
	name: string;
	imageUrl?: string | null;
	className?: string;
}) {
	const initials =
		name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase())
			.join("") || "?";
	if (imageUrl) {
		return (
			<Image
				src={imageUrl}
				alt=""
				width={80}
				height={80}
				className={cn("size-9 shrink-0 rounded-full object-cover", className)}
				unoptimized
			/>
		);
	}
	return (
		<span
			className={cn(
				"grid size-9 shrink-0 place-items-center rounded-full bg-emerald-700 text-xs font-black text-white",
				className,
			)}
			aria-hidden="true"
		>
			{initials}
		</span>
	);
}

// ─── Account menu ────────────────────────────────────────────────

export type AccountMenuProps = {
	name: string;
	/** Email, Staff ID or role: the line under the name. */
	detail: string;
	/** Short role label shown on desktop next to the name. */
	role: string;
	imageUrl?: string | null;
	links?: AccountLink[];
	logoutLabel?: string;
	onLogout: () => void | Promise<void>;
};

function AccountMenuBody({
	name,
	detail,
	imageUrl,
	links = [],
	logoutLabel = "Log out",
	onLogout,
	onNavigate,
}: AccountMenuProps & { onNavigate: () => void }) {
	const [loggingOut, setLoggingOut] = useState(false);
	return (
		<div className="grid gap-1">
			<div className="flex items-center gap-3 px-2 pt-1 pb-3">
				<Avatar name={name} imageUrl={imageUrl} className="size-11 text-sm" />
				<div className="min-w-0">
					<p className="truncate text-sm font-black text-slate-950">{name}</p>
					<p className="truncate text-xs font-medium text-slate-500">
						{detail}
					</p>
				</div>
			</div>
			{links.map((link) => {
				const Icon = link.icon;
				return (
					<Link
						key={link.href}
						href={link.href}
						onClick={onNavigate}
						className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
					>
						<Icon className="size-4 text-slate-500" aria-hidden="true" />
						{link.label}
					</Link>
				);
			})}
			<div className="my-1 border-slate-100 border-t" />
			<button
				type="button"
				disabled={loggingOut}
				onClick={async () => {
					setLoggingOut(true);
					try {
						await onLogout();
					} finally {
						setLoggingOut(false);
					}
				}}
				className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-black text-red-600 hover:bg-red-50 disabled:opacity-60"
			>
				<LogOut className="size-4" aria-hidden="true" />
				{loggingOut ? "Signing out…" : logoutLabel}
			</button>
		</div>
	);
}

/** Desktop: name chip with a dropdown. */
function DesktopAccountMenu(props: AccountMenuProps) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		function onPointer(event: PointerEvent) {
			if (!ref.current?.contains(event.target as Node)) setOpen(false);
		}
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") setOpen(false);
		}
		document.addEventListener("pointerdown", onPointer);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onPointer);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-haspopup="menu"
				aria-expanded={open}
				className="flex items-center gap-2.5 rounded-full border border-slate-200 bg-white py-1 pr-3 pl-1 transition-colors hover:bg-slate-50"
			>
				<Avatar name={props.name} imageUrl={props.imageUrl} />
				<span className="hidden min-w-0 text-left lg:block">
					<span className="block max-w-[11rem] truncate text-sm font-black text-slate-950">
						{props.name}
					</span>
					<span className="block text-[11px] font-bold text-slate-500">
						{props.role}
					</span>
				</span>
				<ChevronDown className="size-4 text-slate-500" aria-hidden="true" />
			</button>
			{open ? (
				<div
					role="menu"
					className="absolute top-full right-0 z-50 mt-2 w-72 rounded-2xl border border-slate-100 bg-white p-2 shadow-[0_20px_50px_rgba(15,23,42,0.15)]"
				>
					<AccountMenuBody {...props} onNavigate={() => setOpen(false)} />
				</div>
			) : null}
		</div>
	);
}

/** Mobile: avatar button that opens a bottom sheet. */
function MobileAccountButton(props: AccountMenuProps) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				aria-label="Account and sign out"
				className="grid size-10 place-items-center rounded-full"
			>
				<Avatar name={props.name} imageUrl={props.imageUrl} />
			</button>
			<MobileModal open={open} onClose={() => setOpen(false)} title="Account">
				<AccountMenuBody {...props} onNavigate={() => setOpen(false)} />
			</MobileModal>
		</>
	);
}

// ─── Top bar ─────────────────────────────────────────────────────

export function DashboardTopBar({
	title,
	subtitle,
	brand,
	backHref,
	sidebarCollapsed,
	onToggleSidebar,
	actions,
	account,
}: {
	title: string;
	subtitle?: string;
	/** Mobile, on top-level tabs: logo or restaurant mark left of the title. */
	brand?: ReactNode;
	backHref?: string | null;
	sidebarCollapsed?: boolean;
	onToggleSidebar?: () => void;
	/** Extra buttons before the account (e.g. notifications). */
	actions?: ReactNode;
	account: AccountMenuProps;
}) {
	return (
		<header className="sticky top-0 z-30 border-slate-200/70 border-b bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur-md print:hidden">
			<div className="flex h-14 items-center gap-2 px-2 md:h-16 md:gap-3 md:px-6">
				{onToggleSidebar ? (
					<button
						type="button"
						onClick={onToggleSidebar}
						className="hidden size-10 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 md:grid"
						aria-label={
							sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
						}
						title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
					>
						{sidebarCollapsed ? (
							<PanelLeftOpen className="size-5" />
						) : (
							<PanelLeftClose className="size-5" />
						)}
					</button>
				) : null}

				{backHref ? (
					<Link
						href={backHref}
						aria-label="Back"
						className="grid size-10 shrink-0 place-items-center rounded-full text-slate-800 active:bg-slate-100 md:hidden"
					>
						<ChevronLeft className="size-6" aria-hidden="true" />
					</Link>
				) : brand ? (
					<span className="shrink-0 pl-1 md:hidden">{brand}</span>
				) : null}

				<div className="min-w-0 flex-1 px-1">
					<h1 className="truncate text-[17px] font-black leading-tight text-slate-950 md:text-xl">
						{title}
					</h1>
					{subtitle ? (
						<p className="truncate text-xs font-semibold text-slate-500">
							{subtitle}
						</p>
					) : null}
				</div>

				<div className="flex shrink-0 items-center gap-1 md:gap-3">
					{actions}
					<div className="md:hidden">
						<MobileAccountButton {...account} />
					</div>
					<div className="hidden md:block">
						<DesktopAccountMenu {...account} />
					</div>
				</div>
			</div>
		</header>
	);
}

// ─── Mobile tab bar ──────────────────────────────────────────────

export function MobileTabBar({
	items,
	moreItems = [],
	moreExtra,
	basePath,
}: {
	/** Up to four primary tabs; "More" is added when moreItems is non-empty. */
	items: NavItem[];
	moreItems?: NavItem[];
	/** Extra rows at the end of the More sheet (e.g. "Preview menu"). */
	moreExtra?: Array<{ label: string; href: string; icon: LucideIcon }>;
	basePath: string;
}) {
	const pathname = usePathname();
	const [moreOpen, setMoreOpen] = useState(false);
	const moreActive = moreItems.some((item) =>
		isNavActive(pathname, basePath, item),
	);

	// Closing on navigation keeps the sheet from lingering over the next page.
	// biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger
	useEffect(() => {
		setMoreOpen(false);
	}, [pathname]);

	const tab = (active: boolean) =>
		cn(
			"flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors",
			active ? "text-emerald-800" : "text-slate-500",
		);
	const pill = (active: boolean) =>
		cn(
			"grid h-7 w-14 place-items-center rounded-full transition-colors",
			active && "bg-emerald-100",
		);

	return (
		<>
			<nav
				aria-label="Main"
				className="fixed inset-x-0 bottom-0 z-40 border-slate-200/80 border-t bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden print:hidden"
			>
				<div
					className="grid"
					style={{
						gridTemplateColumns: `repeat(${items.length + (moreItems.length ? 1 : 0)}, minmax(0, 1fr))`,
					}}
				>
					{items.map((item) => {
						const active = isNavActive(pathname, basePath, item);
						const Icon = item.icon;
						return (
							<Link
								key={item.label}
								href={`${basePath}${item.href}`}
								aria-current={active ? "page" : undefined}
								className={tab(active)}
							>
								<span className={pill(active)}>
									<Icon className="size-5" aria-hidden="true" />
								</span>
								<span className="max-w-full truncate px-1">
									{item.shortLabel ?? item.label}
								</span>
							</Link>
						);
					})}
					{moreItems.length ? (
						<button
							type="button"
							onClick={() => setMoreOpen(true)}
							className={tab(moreActive)}
						>
							<span className={pill(moreActive)}>
								<Ellipsis className="size-5" aria-hidden="true" />
							</span>
							<span>More</span>
						</button>
					) : null}
				</div>
			</nav>

			{moreItems.length ? (
				<MobileModal
					open={moreOpen}
					onClose={() => setMoreOpen(false)}
					title="More"
				>
					<div className="grid gap-1 pb-2">
						{[
							...moreItems,
							...(moreExtra ?? []).map((x) => ({ ...x, external: true })),
						].map((item) => {
							const Icon = item.icon;
							const external = "external" in item;
							const href = external ? item.href : `${basePath}${item.href}`;
							const active = !external && isNavActive(pathname, basePath, item);
							return (
								<Link
									key={item.label}
									href={href}
									onClick={() => setMoreOpen(false)}
									className={cn(
										"flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold text-slate-700 active:bg-slate-100",
										active && "bg-emerald-50 text-emerald-800",
									)}
								>
									<Icon
										className="size-5 text-emerald-700"
										aria-hidden="true"
									/>
									{item.label}
								</Link>
							);
						})}
					</div>
				</MobileModal>
			) : null}
		</>
	);
}

/** Bottom padding for content above the mobile tab bar. */
export const TAB_BAR_PADDING =
	"pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-10";
