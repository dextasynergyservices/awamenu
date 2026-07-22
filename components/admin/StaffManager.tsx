"use client";

import {
	ArrowLeft,
	Banknote,
	Bike,
	Calendar,
	CalendarDays,
	Check,
	ChevronDown,
	ClipboardCopy,
	Lock,
	MoreHorizontal,
	MoreVertical,
	Plus,
	RefreshCw,
	Search,
	Settings2,
	Shield,
	ShieldOff,
	ShoppingBag,
	SlidersHorizontal,
	UserPlus,
	Users,
	UtensilsCrossed,
	X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
	createStaffAction,
	deactivateStaffAction,
	reactivateStaffAction,
	updateGlobalStaffPermissionsAction,
	updateStaffPermissionsAction,
} from "@/actions/staff.actions";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────

type StaffItem = {
	id: string;
	name: string;
	staffId: string;
	isActive: boolean;
	canHandleDineIn: boolean | null;
	canHandlePickup: boolean | null;
	canHandleDelivery: boolean | null;
	canRecordCashPayment: boolean | null;
	canApproveReservations: boolean | null;
	createdAt: string;
	orderCount: number;
};

type GlobalPermissions = {
	staffDefaultDineIn: boolean;
	staffDefaultPickup: boolean;
	staffDefaultDelivery: boolean;
	staffDefaultCashPayment: boolean;
	staffDefaultApproveReservations: boolean;
};

type StaffManagerProps = {
	slug: string;
	staffList: StaffItem[];
	globalPermissions: GlobalPermissions;
};

// ─── Main Component ───────────────────────────────────

export function StaffManager({
	slug,
	staffList,
	globalPermissions,
}: StaffManagerProps) {
	const [createOpen, setCreateOpen] = useState(false);
	const [createdStaffId, setCreatedStaffId] = useState<string | null>(null);
	const [createdPin, setCreatedPin] = useState<string | null>(null);
	const [resetPinStaff, setResetPinStaff] = useState<StaffItem | null>(null);
	const [globalOpen, setGlobalOpen] = useState(false);
	const [permModalStaff, setPermModalStaff] = useState<StaffItem | null>(null);
	const [deactivateTarget, setDeactivateTarget] = useState<StaffItem | null>(
		null,
	);
	const [searchQuery, setSearchQuery] = useState("");
	const [activeFilter, setActiveFilter] = useState("All");

	const filters = ["All", "Active", "Managers", "Cashiers", "Suspended"];

	let filteredList = staffList;
	if (searchQuery.trim()) {
		filteredList = filteredList.filter(
			(s) =>
				s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				s.staffId.toLowerCase().includes(searchQuery.toLowerCase()),
		);
	}
	if (activeFilter === "Active") {
		filteredList = filteredList.filter((s) => s.isActive);
	} else if (activeFilter === "Suspended") {
		filteredList = filteredList.filter((s) => !s.isActive);
	} else if (activeFilter === "Managers") {
		filteredList = filteredList.filter(
			(s) =>
				s.canApproveReservations ??
				globalPermissions.staffDefaultApproveReservations,
		);
	} else if (activeFilter === "Cashiers") {
		filteredList = filteredList.filter((s) => {
			const isManager =
				s.canApproveReservations ??
				globalPermissions.staffDefaultApproveReservations;
			const canCash =
				s.canRecordCashPayment ?? globalPermissions.staffDefaultCashPayment;
			return canCash && !isManager;
		});
	}

	return (
		<section className="flex w-full min-w-0 flex-col gap-6 pb-32 sm:pb-6">
			{/* Header */}
			<div className="flex items-center justify-between md:hidden">
				<div className="flex items-center gap-4">
					<Link
						href={`/dashboard/${slug}`}
						className="rounded-full p-2 transition-colors hover:bg-slate-100 -ml-2"
					>
						<ArrowLeft className="size-6 text-slate-900" />
					</Link>
					<div>
						<h2 className="text-lg sm:text-2xl font-black tracking-tight text-slate-950">
							Staff
						</h2>
						<p className="text-xs sm:text-sm font-medium text-slate-500">
							Manage your restaurant employees
						</p>
					</div>
				</div>
				<button
					type="button"
					className="rounded-full p-2 transition-colors hover:bg-slate-100 -mr-2"
				>
					<MoreVertical className="size-6 text-slate-700" />
				</button>
			</div>

			{/* Search & Filters */}
			<div className="flex flex-col gap-5 md:hidden">
				<div className="flex items-center gap-2 sm:gap-3">
					<div className="relative flex-1">
						<Search className="absolute left-3 sm:left-4 top-1/2 size-3.5 sm:size-5 -translate-y-1/2 text-slate-400" />
						<input
							type="text"
							placeholder="Search staff..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="h-8 sm:h-12 w-full rounded-full border border-slate-200 bg-white pl-8 sm:pl-11 pr-3 sm:pr-4 text-base font-medium outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
						/>
					</div>
					<button
						type="button"
						onClick={() => setGlobalOpen(true)}
						className="grid size-8 sm:size-12 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
					>
						<SlidersHorizontal className="size-3.5 sm:size-5" />
					</button>
				</div>

				<div className="w-full overflow-x-auto pb-2 scrollbar-hide">
					<div className="flex w-max items-center gap-2">
						{filters.map((filter) => (
							<button
								key={filter}
								type="button"
								onClick={() => setActiveFilter(filter)}
								className={cn(
									"flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-full border px-2.5 sm:px-4 py-1 sm:py-2 text-xs sm:text-sm font-bold transition-colors",
									activeFilter === filter
										? "border-emerald-700 bg-emerald-700 text-white"
										: "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
								)}
							>
								{filter !== "All" && activeFilter !== filter && (
									<span
										className={cn(
											"size-1.5 sm:size-2 rounded-full",
											filter === "Active" || filter === "Cashiers"
												? "bg-emerald-500"
												: filter === "Managers"
													? "bg-purple-500"
													: "bg-red-500",
										)}
									/>
								)}
								{filter}
							</button>
						))}
					</div>
				</div>

				<button
					type="button"
					onClick={() => {
						setCreatedStaffId(null);
						setCreateOpen(true);
					}}
					className="flex h-8 sm:h-12 w-full items-center justify-center gap-1.5 sm:gap-2 rounded-lg sm:rounded-xl bg-emerald-700 text-xs sm:text-sm font-black text-white shadow-sm transition-colors hover:bg-emerald-800"
				>
					<Plus className="size-3.5 sm:size-5" />
					Add Staff
				</button>
			</div>

			{/* Staff list */}
			{filteredList.length === 0 ? (
				<div className="grid place-items-center rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center md:hidden">
					<div className="grid size-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
						<Users className="size-7" />
					</div>
					<p className="mt-4 text-lg font-black text-slate-950">
						No staff members found
					</p>
					<p className="mt-1 max-w-sm text-sm font-medium text-slate-500">
						Try adjusting your search or filters.
					</p>
				</div>
			) : (
				<div className="grid gap-4 md:hidden">
					{filteredList.map((s) => (
						<MobileStaffCard
							key={s.id}
							staff={s}
							slug={slug}
							globalPermissions={globalPermissions}
							onEditPermissions={() => setPermModalStaff(s)}
							onDeactivate={() => setDeactivateTarget(s)}
							onResetPin={() => setResetPinStaff(s)}
						/>
					))}
				</div>
			)}

			{/* Desktop Header */}
			<div className="hidden md:flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
						Staff Management
					</h2>
					<p className="mt-0.5 text-xs font-medium text-slate-500 sm:mt-1 sm:text-sm">
						Create and manage staff accounts, set permissions.
					</p>
				</div>
				<div className="flex w-full gap-2 sm:w-auto sm:flex-wrap">
					<button
						type="button"
						onClick={() => setGlobalOpen(true)}
						className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:min-h-11 sm:flex-none sm:gap-2 sm:rounded-2xl sm:px-4 sm:text-sm"
					>
						<Settings2 className="size-3.5 sm:size-4" />
						<span className="hidden sm:inline">Default Permissions</span>
						<span className="sm:hidden">Defaults</span>
					</button>
					<button
						type="button"
						onClick={() => {
							setCreatedStaffId(null);
							setCreateOpen(true);
						}}
						className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-xs font-black text-white shadow-sm transition-colors hover:bg-emerald-800 sm:min-h-11 sm:flex-none sm:gap-2 sm:rounded-2xl sm:px-4 sm:text-sm"
					>
						<UserPlus className="size-3.5 sm:size-4" />
						Add Staff
					</button>
				</div>
			</div>

			{/* Desktop Staff list */}
			{staffList.length === 0 ? (
				<div className="hidden md:grid place-items-center rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
					<div className="grid size-16 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
						<Users className="size-7" />
					</div>
					<p className="mt-4 text-lg font-black text-slate-950">
						No staff members yet
					</p>
					<p className="mt-1 max-w-sm text-sm font-medium text-slate-500">
						Add your first staff member to help manage orders and payments.
					</p>
					<button
						type="button"
						onClick={() => {
							setCreatedStaffId(null);
							setCreateOpen(true);
						}}
						className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white"
					>
						<Plus className="size-4" />
						Add your first staff member
					</button>
				</div>
			) : (
				<div className="hidden md:grid gap-3">
					{staffList.map((s) => (
						<DesktopStaffCard
							key={s.id}
							staff={s}
							slug={slug}
							globalPermissions={globalPermissions}
							onEditPermissions={() => setPermModalStaff(s)}
							onDeactivate={() => setDeactivateTarget(s)}
							onResetPin={() => setResetPinStaff(s)}
						/>
					))}
				</div>
			)}

			{/* Modals */}
			{createOpen ? (
				<CreateStaffModal
					slug={slug}
					createdStaffId={createdStaffId}
					createdPin={createdPin}
					onCreated={(id, pin) => {
						setCreatedStaffId(id);
						setCreatedPin(pin);
					}}
					onClose={() => setCreateOpen(false)}
				/>
			) : null}

			{globalOpen ? (
				<GlobalPermissionsModal
					slug={slug}
					permissions={globalPermissions}
					onClose={() => setGlobalOpen(false)}
				/>
			) : null}

			{permModalStaff ? (
				<StaffPermissionsModal
					slug={slug}
					staff={permModalStaff}
					globalPermissions={globalPermissions}
					onClose={() => setPermModalStaff(null)}
				/>
			) : null}

			{deactivateTarget ? (
				<DeactivateModal
					slug={slug}
					staff={deactivateTarget}
					onClose={() => setDeactivateTarget(null)}
				/>
			) : null}

			{resetPinStaff ? (
				<ResetPinModal
					slug={slug}
					staff={resetPinStaff}
					onClose={() => setResetPinStaff(null)}
				/>
			) : null}
		</section>
	);
}

// ─── Staff Card ───────────────────────────────────────

function MobileStaffCard({
	staff,
	slug,
	globalPermissions,
	onEditPermissions,
	onDeactivate,
	onResetPin,
}: {
	staff: StaffItem;
	slug: string;
	globalPermissions: GlobalPermissions;
	onEditPermissions: () => void;
	onDeactivate: () => void;
	onResetPin: () => void;
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [copied, setCopied] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);

	function handleCopy() {
		navigator.clipboard.writeText(staff.staffId);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	function handleReactivate() {
		const fd = new FormData();
		fd.set("slug", slug);
		fd.set("staffMemberId", staff.id);
		startTransition(async () => {
			await reactivateStaffAction(fd);
			setMenuOpen(false);
			router.refresh();
		});
	}

	const resolvedPerms = {
		dineIn: staff.canHandleDineIn ?? globalPermissions.staffDefaultDineIn,
		pickup: staff.canHandlePickup ?? globalPermissions.staffDefaultPickup,
		delivery: staff.canHandleDelivery ?? globalPermissions.staffDefaultDelivery,
		cashPayment:
			staff.canRecordCashPayment ?? globalPermissions.staffDefaultCashPayment,
		reservations:
			staff.canApproveReservations ??
			globalPermissions.staffDefaultApproveReservations,
	};

	const isManager = resolvedPerms.reservations;
	const isCashier = resolvedPerms.cashPayment && !isManager;
	const role = isManager ? "Manager" : isCashier ? "Cashier" : "Waiter";
	const allPerms =
		resolvedPerms.dineIn &&
		resolvedPerms.pickup &&
		resolvedPerms.delivery &&
		resolvedPerms.cashPayment &&
		resolvedPerms.reservations;

	return (
		<div
			className={cn(
				"flex flex-col overflow-hidden rounded-2xl sm:rounded-[24px] border bg-white shadow-sm transition-colors",
				staff.isActive ? "border-slate-100" : "border-red-100 bg-red-50/10",
			)}
		>
			<div className="p-3 sm:p-5">
				<div className="flex items-start justify-between">
					<div className="flex items-start gap-2.5 sm:gap-4">
						<div
							className={cn(
								"relative grid size-10 sm:size-[60px] shrink-0 place-items-center rounded-full text-lg sm:text-2xl font-black",
								staff.isActive
									? "bg-emerald-100/50 text-emerald-800"
									: "bg-red-50 text-red-700",
								role === "Manager" && staff.isActive
									? "bg-purple-100/50 text-purple-800"
									: "",
								role === "Waiter" && staff.isActive
									? "bg-orange-100/50 text-orange-800"
									: "",
							)}
						>
							{staff.name.charAt(0).toUpperCase()}
							<div
								className={cn(
									"absolute bottom-0 sm:bottom-0.5 right-0 sm:right-0.5 size-2.5 sm:size-3.5 rounded-full border-2 border-white",
									staff.isActive ? "bg-emerald-500" : "bg-red-500",
								)}
							/>
						</div>
						<div className="flex flex-col pt-0 sm:pt-1">
							<h3 className="text-base sm:text-xl font-black text-slate-950">
								{staff.name}
							</h3>
							<div className="mt-0.5 sm:mt-1 flex flex-wrap items-center gap-1.5 sm:gap-2">
								<span
									className={cn(
										"rounded-full px-1.5 sm:px-2 py-0.5 text-xs font-black tracking-wide",
										role === "Manager"
											? "bg-purple-100/50 text-purple-700"
											: role === "Cashier"
												? "bg-emerald-100/50 text-emerald-700"
												: "bg-orange-100/50 text-orange-700",
									)}
								>
									{role}
								</span>
							</div>
							<div className="mt-1 sm:mt-2 flex items-center gap-1 sm:gap-1.5 text-xs font-medium text-slate-500">
								<span>ID: {staff.staffId}</span>
								<button
									type="button"
									onClick={handleCopy}
									className="text-slate-400 transition-colors hover:text-slate-600"
									title="Copy Staff ID"
								>
									{copied ? (
										<Check className="size-2.5 sm:size-3.5 text-emerald-600" />
									) : (
										<ClipboardCopy className="size-2.5 sm:size-3.5" />
									)}
								</button>
							</div>
						</div>
					</div>

					<div className="flex flex-col items-end gap-1.5 sm:gap-2">
						<div
							className={cn(
								"flex items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-2.5 py-0.5 sm:py-1 text-xs font-bold",
								staff.isActive
									? "bg-emerald-50 text-emerald-700"
									: "bg-red-50 text-red-700",
							)}
						>
							<div
								className={cn(
									"size-1 sm:size-1.5 rounded-full",
									staff.isActive ? "bg-emerald-500" : "bg-red-500",
								)}
							/>
							{staff.isActive ? "Active" : "Suspended"}
						</div>
						<button
							type="button"
							className="p-1 text-slate-400 hover:text-slate-600"
						>
							<ChevronDown className="size-4 sm:size-5" />
						</button>
					</div>
				</div>

				<div className="mt-3 sm:mt-4 flex flex-wrap gap-1.5 sm:gap-2">
					{allPerms ? (
						<PermBadge
							label="All Permissions"
							active
							icon={Shield}
							color="emerald"
						/>
					) : (
						<>
							{resolvedPerms.dineIn && (
								<PermBadge
									label="Dine-in"
									active
									icon={UtensilsCrossed}
									color="emerald"
								/>
							)}
							{resolvedPerms.pickup && (
								<PermBadge
									label="Pickup"
									active
									icon={ShoppingBag}
									color="blue"
								/>
							)}
							{resolvedPerms.delivery && (
								<PermBadge label="Delivery" active icon={Bike} color="orange" />
							)}
							{resolvedPerms.cashPayment && (
								<PermBadge
									label="Cash Payment"
									active
									icon={Banknote}
									color="emerald"
								/>
							)}
							{resolvedPerms.reservations && (
								<PermBadge
									label="Reservations"
									active
									icon={CalendarDays}
									color="purple"
								/>
							)}
						</>
					)}
				</div>

				<div className="mt-3 sm:mt-4 flex items-center gap-1.5 sm:gap-2 text-xs font-medium text-slate-500">
					<Calendar className="size-3 sm:size-4" />
					Joined{" "}
					{new Date(staff.createdAt).toLocaleDateString("en-US", {
						month: "short",
						day: "numeric",
						year: "numeric",
					})}
				</div>
			</div>

			<div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 bg-white">
				<button
					type="button"
					onClick={onEditPermissions}
					className="flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-3.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-slate-50"
				>
					<Lock className="size-3 sm:size-4" />
					Permissions
				</button>
				<button
					type="button"
					onClick={() => setMenuOpen(!menuOpen)}
					className="relative flex items-center justify-center gap-1.5 sm:gap-2 py-2 sm:py-3.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-slate-50"
				>
					<MoreHorizontal className="size-3 sm:size-4" />
					More
				</button>
			</div>

			{menuOpen && (
				<div className="flex flex-col divide-y divide-slate-100 border-t border-slate-100 bg-slate-50">
					<button
						type="button"
						onClick={() => {
							setMenuOpen(false);
							onResetPin();
						}}
						className="flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
					>
						<RefreshCw className="size-4" />
						Reset PIN
					</button>
					{staff.isActive ? (
						<button
							type="button"
							onClick={() => {
								setMenuOpen(false);
								onDeactivate();
							}}
							className="flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-red-600 hover:bg-red-50"
						>
							<ShieldOff className="size-4" />
							Suspend Account
						</button>
					) : (
						<button
							type="button"
							onClick={handleReactivate}
							disabled={isPending}
							className="flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
						>
							<RefreshCw
								className={cn("size-4", isPending && "animate-spin")}
							/>
							Reactivate Account
						</button>
					)}
				</div>
			)}
		</div>
	);
}

function PermBadge({
	label,
	active,
	icon: Icon,
	color,
}: {
	label: string;
	active: boolean;
	icon: React.ElementType;
	color: "emerald" | "blue" | "orange" | "purple";
}) {
	if (!active) return null;
	const colorStyles = {
		emerald: "bg-emerald-50 text-emerald-700",
		blue: "bg-blue-50 text-blue-700",
		orange: "bg-orange-50 text-orange-700",
		purple: "bg-purple-50 text-purple-700",
	};
	return (
		<span
			className={cn(
				"flex items-center gap-1 sm:gap-1.5 rounded-full px-1.5 sm:px-2.5 py-0.5 sm:py-1 text-xs font-bold",
				colorStyles[color],
			)}
		>
			<Icon className="size-2.5 sm:size-3.5" />
			{label}
		</span>
	);
}

// ─── Create Staff Modal ──────────────────────────────

function CreateStaffModal({
	slug,
	createdStaffId,
	createdPin,
	onCreated,
	onClose,
}: {
	slug: string;
	createdStaffId: string | null;
	createdPin: string | null;
	onCreated: (id: string, pin: string) => void;
	onClose: () => void;
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);

		const fd = new FormData();
		fd.set("slug", slug);
		fd.set("name", name.trim());

		startTransition(async () => {
			try {
				const result = await createStaffAction(fd);
				onCreated(result.staffId, result.pin);
				setName("");
				router.refresh();
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to create staff.",
				);
			}
		});
	}

	function handleCopyId() {
		if (createdStaffId) {
			navigator.clipboard.writeText(createdStaffId);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	}

	return (
		<ModalOverlay onClose={onClose}>
			<div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
				<div className="flex items-center justify-between">
					<h3 className="text-xl font-black text-slate-950">
						{createdStaffId ? "Staff Created!" : "Add Staff Member"}
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="grid size-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100"
					>
						<X className="size-4" />
					</button>
				</div>

				{createdStaffId ? (
					<div className="mt-5">
						<p className="text-sm font-medium text-slate-600">
							Share this Staff ID with your team member. They will use it to log
							in at{" "}
							<code className="rounded bg-slate-100 px-1 font-mono text-xs">
								/staff/{slug}/login
							</code>
						</p>
						<div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
							<code className="flex-1 text-lg font-black text-emerald-800">
								{createdStaffId}
							</code>
							<button
								type="button"
								onClick={handleCopyId}
								className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white"
							>
								{copied ? (
									<>
										<Check className="size-3.5" /> Copied
									</>
								) : (
									<>
										<ClipboardCopy className="size-3.5" /> Copy
									</>
								)}
							</button>
						</div>

						<p className="mt-4 text-sm font-medium text-slate-600">
							Their 4-digit PIN for attributing actions is:
						</p>
						<div className="mt-2 flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-4">
							<code className="flex-1 text-2xl tracking-widest font-black text-blue-800">
								{createdPin}
							</code>
						</div>

						<button
							type="button"
							onClick={onClose}
							className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white"
						>
							Done
						</button>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="mt-5 grid gap-4">
						<div>
							<label
								htmlFor="staff-name"
								className="block text-sm font-black text-slate-700"
							>
								Staff Name
							</label>
							<input
								id="staff-name"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="e.g. John Doe"
								required
								maxLength={100}
								className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
							/>
						</div>
						{error ? (
							<p className="text-sm font-medium text-red-600">{error}</p>
						) : null}
						<button
							type="submit"
							disabled={isPending || !name.trim()}
							className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-emerald-700 text-sm font-black text-white disabled:opacity-50"
						>
							{isPending ? "Creating…" : "Create Staff Member"}
						</button>
					</form>
				)}
			</div>
		</ModalOverlay>
	);
}

// ─── Reset PIN Modal ──────────────────────────────────

import { resetPinAction } from "@/actions/staff.actions";

function ResetPinModal({
	slug,
	staff,
	onClose,
}: {
	slug: string;
	staff: StaffItem;
	onClose: () => void;
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [newPin, setNewPin] = useState<string | null>(null);

	function handleReset() {
		const fd = new FormData();
		fd.set("slug", slug);
		fd.set("staffMemberId", staff.id);

		startTransition(async () => {
			try {
				const result = await resetPinAction(fd);
				setNewPin(result.pin);
				router.refresh();
			} catch (err) {
				console.error(err);
			}
		});
	}

	return (
		<ModalOverlay onClose={onClose}>
			<div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
				<div className="flex items-center justify-between">
					<h3 className="text-xl font-black text-slate-950">
						{newPin ? "PIN Reset Successful" : "Reset Staff PIN"}
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="grid size-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100"
					>
						<X className="size-4" />
					</button>
				</div>

				{newPin ? (
					<div className="mt-5">
						<p className="text-sm font-medium text-slate-600">
							The new 4-digit PIN for {staff.name} is:
						</p>
						<div className="mt-4 flex items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 p-4">
							<code className="text-3xl tracking-widest font-black text-blue-800">
								{newPin}
							</code>
						</div>
						<button
							type="button"
							onClick={onClose}
							className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-slate-900 text-sm font-black text-white"
						>
							Done
						</button>
					</div>
				) : (
					<div className="mt-5">
						<p className="text-sm font-medium text-slate-600 mb-5">
							Are you sure you want to generate a new PIN for {staff.name}? The
							old PIN will immediately stop working.
						</p>
						<button
							type="button"
							onClick={handleReset}
							disabled={isPending}
							className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-emerald-700 text-sm font-black text-white disabled:opacity-50"
						>
							{isPending ? "Generating new PIN…" : "Yes, generate new PIN"}
						</button>
					</div>
				)}
			</div>
		</ModalOverlay>
	);
}

// ─── Global Permissions Modal ────────────────────────

function GlobalPermissionsModal({
	slug,
	permissions,
	onClose,
}: {
	slug: string;
	permissions: GlobalPermissions;
	onClose: () => void;
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [state, setState] = useState(permissions);

	function handleSave() {
		const fd = new FormData();
		fd.set("slug", slug);
		fd.set("staffDefaultDineIn", String(state.staffDefaultDineIn));
		fd.set("staffDefaultPickup", String(state.staffDefaultPickup));
		fd.set("staffDefaultDelivery", String(state.staffDefaultDelivery));
		fd.set("staffDefaultCashPayment", String(state.staffDefaultCashPayment));
		fd.set(
			"staffDefaultApproveReservations",
			String(state.staffDefaultApproveReservations),
		);

		startTransition(async () => {
			await updateGlobalStaffPermissionsAction(fd);
			router.refresh();
			onClose();
		});
	}

	const toggles: {
		key: keyof GlobalPermissions;
		label: string;
		desc: string;
	}[] = [
		{
			key: "staffDefaultDineIn",
			label: "Dine-in Orders",
			desc: "Staff can view and manage dine-in orders",
		},
		{
			key: "staffDefaultPickup",
			label: "Pickup Orders",
			desc: "Staff can view and manage pickup orders",
		},
		{
			key: "staffDefaultDelivery",
			label: "Delivery Orders",
			desc: "Staff can view and manage delivery orders",
		},
		{
			key: "staffDefaultCashPayment",
			label: "Record Cash Payments",
			desc: "Staff can record manual cash/transfer payments",
		},
		{
			key: "staffDefaultApproveReservations",
			label: "Approve Reservations",
			desc: "Staff can approve pending table reservations",
		},
	];

	return (
		<ModalOverlay onClose={onClose}>
			<div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
				<div className="flex items-center justify-between">
					<h3 className="text-xl font-black text-slate-950">
						Default Staff Permissions
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="grid size-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100"
					>
						<X className="size-4" />
					</button>
				</div>
				<p className="mt-2 text-sm font-medium text-slate-500">
					These defaults apply to all staff unless overridden individually.
				</p>
				<div className="mt-5 grid gap-4">
					{toggles.map((t) => (
						<PermissionToggle
							key={t.key}
							label={t.label}
							description={t.desc}
							checked={state[t.key]}
							onChange={(v) => setState((prev) => ({ ...prev, [t.key]: v }))}
						/>
					))}
				</div>
				<button
					type="button"
					onClick={handleSave}
					disabled={isPending}
					className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-emerald-700 text-sm font-black text-white disabled:opacity-50"
				>
					{isPending ? "Saving…" : "Save Defaults"}
				</button>
			</div>
		</ModalOverlay>
	);
}

// ─── Staff Permissions Modal ─────────────────────────

function StaffPermissionsModal({
	slug,
	staff,
	globalPermissions,
	onClose,
}: {
	slug: string;
	staff: StaffItem;
	globalPermissions: GlobalPermissions;
	onClose: () => void;
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [state, setState] = useState({
		canHandleDineIn: staff.canHandleDineIn,
		canHandlePickup: staff.canHandlePickup,
		canHandleDelivery: staff.canHandleDelivery,
		canRecordCashPayment: staff.canRecordCashPayment,
		canApproveReservations: staff.canApproveReservations,
	});

	function handleSave() {
		const fd = new FormData();
		fd.set("slug", slug);
		fd.set("staffMemberId", staff.id);
		fd.set("canHandleDineIn", String(state.canHandleDineIn ?? "null"));
		fd.set("canHandlePickup", String(state.canHandlePickup ?? "null"));
		fd.set("canHandleDelivery", String(state.canHandleDelivery ?? "null"));
		fd.set(
			"canRecordCashPayment",
			String(state.canRecordCashPayment ?? "null"),
		);
		fd.set(
			"canApproveReservations",
			String(state.canApproveReservations ?? "null"),
		);

		startTransition(async () => {
			await updateStaffPermissionsAction(fd);
			router.refresh();
			onClose();
		});
	}

	const perms: {
		key: keyof typeof state;
		label: string;
		defaultKey: keyof GlobalPermissions;
	}[] = [
		{
			key: "canHandleDineIn",
			label: "Dine-in Orders",
			defaultKey: "staffDefaultDineIn",
		},
		{
			key: "canHandlePickup",
			label: "Pickup Orders",
			defaultKey: "staffDefaultPickup",
		},
		{
			key: "canHandleDelivery",
			label: "Delivery Orders",
			defaultKey: "staffDefaultDelivery",
		},
		{
			key: "canRecordCashPayment",
			label: "Record Cash Payments",
			defaultKey: "staffDefaultCashPayment",
		},
		{
			key: "canApproveReservations",
			label: "Approve Reservations",
			defaultKey: "staffDefaultApproveReservations",
		},
	];

	return (
		<ModalOverlay onClose={onClose}>
			<div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-2xl">
				<div className="flex items-center justify-between gap-3">
					<h3 className="text-lg sm:text-xl font-black text-slate-950 truncate">
						{staff.name}&apos;s Permissions
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="grid size-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100"
					>
						<X className="size-4" />
					</button>
				</div>
				<p className="mt-2 text-sm font-medium text-slate-500">
					Override defaults for this staff member. &ldquo;Use Default&rdquo;
					inherits the global setting.
				</p>
				<div className="mt-5 grid gap-4">
					{perms.map((p) => (
						<TriStatePermission
							key={p.key}
							label={p.label}
							value={state[p.key]}
							defaultValue={globalPermissions[p.defaultKey]}
							onChange={(v) => setState((prev) => ({ ...prev, [p.key]: v }))}
						/>
					))}
				</div>
				<button
					type="button"
					onClick={handleSave}
					disabled={isPending}
					className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-emerald-700 text-sm font-black text-white disabled:opacity-50"
				>
					{isPending ? "Saving…" : "Save Permissions"}
				</button>
			</div>
		</ModalOverlay>
	);
}

// ─── Deactivate Modal ────────────────────────────────

function DeactivateModal({
	slug,
	staff,
	onClose,
}: {
	slug: string;
	staff: StaffItem;
	onClose: () => void;
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);

	function handleDeactivate(e: React.FormEvent) {
		e.preventDefault();
		setError(null);

		const fd = new FormData();
		fd.set("slug", slug);
		fd.set("staffMemberId", staff.id);
		fd.set("password", password);

		startTransition(async () => {
			try {
				await deactivateStaffAction(fd);
				router.refresh();
				onClose();
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to deactivate.");
			}
		});
	}

	return (
		<ModalOverlay onClose={onClose}>
			<div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
				<h3 className="text-xl font-black text-red-700">Deactivate Staff</h3>
				<p className="mt-2 text-sm font-medium text-slate-600">
					<strong>{staff.name}</strong> ({staff.staffId}) will no longer be able
					to log in. You can reactivate them later.
				</p>
				<form onSubmit={handleDeactivate} className="mt-5 grid gap-4">
					<div>
						<label
							htmlFor="deactivate-password"
							className="block text-sm font-black text-slate-700"
						>
							Confirm your password
						</label>
						<input
							id="deactivate-password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
							className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-950 focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:outline-none"
						/>
					</div>
					{error ? (
						<p className="text-sm font-medium text-red-600">{error}</p>
					) : null}
					<button
						type="submit"
						disabled={isPending || !password}
						className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl bg-red-600 text-sm font-black text-white disabled:opacity-50"
					>
						{isPending ? "Deactivating…" : "Deactivate Staff"}
					</button>
				</form>
			</div>
		</ModalOverlay>
	);
}

// ─── Shared Components ───────────────────────────────

function PermissionToggle({
	label,
	description,
	checked,
	onChange,
}: {
	label: string;
	description: string;
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<label className="flex cursor-pointer items-start gap-3">
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				onClick={() => onChange(!checked)}
				className={cn(
					"mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
					checked ? "bg-emerald-600" : "bg-slate-200",
				)}
			>
				<span
					className={cn(
						"inline-block size-5 rounded-full bg-white shadow-sm transition-transform",
						checked ? "translate-x-5.5" : "translate-x-0.5",
					)}
				/>
			</button>
			<div className="min-w-0">
				<p className="text-sm font-black text-slate-900">{label}</p>
				<p className="text-xs font-medium text-slate-500">{description}</p>
			</div>
		</label>
	);
}

function TriStatePermission({
	label,
	value,
	defaultValue,
	onChange,
}: {
	label: string;
	value: boolean | null;
	defaultValue: boolean;
	onChange: (v: boolean | null) => void;
}) {
	const options = [
		{ label: `Default (${defaultValue ? "On" : "Off"})`, val: null },
		{ label: "On", val: true },
		{ label: "Off", val: false },
	] as const;

	return (
		<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-3">
			<p className="text-xs sm:text-sm font-black text-slate-900">{label}</p>
			<div className="flex w-full sm:w-auto overflow-hidden rounded-lg sm:rounded-xl border border-slate-200 text-xs font-black">
				{options.map((opt) => (
					<button
						key={String(opt.val)}
						type="button"
						onClick={() => onChange(opt.val)}
						className={cn(
							"flex-1 sm:flex-none px-2 sm:px-3 py-1.5 sm:py-2 transition-colors text-center whitespace-nowrap",
							value === opt.val
								? "bg-emerald-700 text-white"
								: "bg-white text-slate-600 hover:bg-slate-50",
						)}
					>
						{opt.label}
					</button>
				))}
			</div>
		</div>
	);
}

function ModalOverlay({
	children,
	onClose,
}: {
	children: React.ReactNode;
	onClose: () => void;
}) {
	return (
		<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
			<button
				type="button"
				onClick={onClose}
				className="absolute inset-0 cursor-default"
				aria-label="Close modal"
			/>
			<div className="relative z-10 w-full max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
				{children}
			</div>
		</div>
	);
}

// ─── Desktop Staff Card ───────────────────────────────

function DesktopStaffCard({
	staff,
	slug,
	globalPermissions,
	onEditPermissions,
	onDeactivate,
	onResetPin,
}: {
	staff: StaffItem;
	slug: string;
	globalPermissions: GlobalPermissions;
	onEditPermissions: () => void;
	onDeactivate: () => void;
	onResetPin: () => void;
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [copied, setCopied] = useState(false);

	function handleCopy() {
		navigator.clipboard.writeText(staff.staffId);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

	function handleReactivate() {
		const fd = new FormData();
		fd.set("slug", slug);
		fd.set("staffMemberId", staff.id);
		startTransition(async () => {
			await reactivateStaffAction(fd);
			router.refresh();
		});
	}

	const resolvedPerms = {
		dineIn: staff.canHandleDineIn ?? globalPermissions.staffDefaultDineIn,
		pickup: staff.canHandlePickup ?? globalPermissions.staffDefaultPickup,
		delivery: staff.canHandleDelivery ?? globalPermissions.staffDefaultDelivery,
		cashPayment:
			staff.canRecordCashPayment ?? globalPermissions.staffDefaultCashPayment,
		reservations:
			staff.canApproveReservations ??
			globalPermissions.staffDefaultApproveReservations,
	};

	return (
		<div
			className={cn(
				"hidden md:flex flex-col gap-3 overflow-hidden rounded-xl border bg-white p-3 shadow-sm transition-colors sm:gap-4 sm:rounded-2xl sm:p-5",
				staff.isActive ? "border-slate-100" : "border-red-100 bg-red-50/30",
			)}
		>
			<div className="flex items-center justify-between gap-2 sm:gap-3">
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700 sm:hidden">
						{staff.name.charAt(0).toUpperCase()}
					</div>
					<h3 className="truncate text-base font-black text-slate-950 sm:text-lg">
						{staff.name}
					</h3>
					{!staff.isActive ? (
						<span className="shrink-0 rounded-md bg-red-100 px-1.5 py-0.5 text-[10px] font-black text-red-700 sm:rounded-lg sm:px-2 sm:text-xs">
							Inactive
						</span>
					) : null}
				</div>
				<div className="flex shrink-0 gap-1 sm:gap-1.5">
					<button
						type="button"
						onClick={onEditPermissions}
						className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 sm:size-9 sm:rounded-xl"
						title="Edit permissions"
					>
						<Shield className="size-3.5 sm:size-4" />
					</button>
					<button
						type="button"
						onClick={onResetPin}
						className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 sm:size-9 sm:rounded-xl"
						title="Reset Staff PIN"
					>
						<RefreshCw className="size-3.5 sm:size-4" />
					</button>
					{staff.isActive ? (
						<button
							type="button"
							onClick={onDeactivate}
							className="grid size-8 place-items-center rounded-lg border border-red-200 text-red-500 transition-colors hover:bg-red-50 sm:size-9 sm:rounded-xl"
							title="Deactivate staff"
						>
							<ShieldOff className="size-3.5 sm:size-4" />
						</button>
					) : (
						<button
							type="button"
							onClick={handleReactivate}
							disabled={isPending}
							className="grid size-8 place-items-center rounded-lg border border-emerald-200 text-emerald-600 transition-colors hover:bg-emerald-50 disabled:opacity-50 sm:size-9 sm:rounded-xl"
							title="Reactivate staff"
						>
							<RefreshCw
								className={cn(
									"size-3.5 sm:size-4",
									isPending && "animate-spin",
								)}
							/>
						</button>
					)}
				</div>
			</div>

			<div className="flex items-center gap-1.5 sm:gap-2">
				<code className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-black tracking-wide text-slate-600 sm:rounded-lg sm:px-2 sm:text-xs">
					{staff.staffId}
				</code>
				<button
					type="button"
					onClick={handleCopy}
					className="text-slate-400 transition-colors hover:text-slate-600"
					title="Copy Staff ID"
				>
					{copied ? (
						<Check className="size-3 text-emerald-600 sm:size-3.5" />
					) : (
						<ClipboardCopy className="size-3 sm:size-3.5" />
					)}
				</button>
			</div>

			<div className="flex flex-wrap gap-1 sm:gap-1.5">
				{resolvedPerms.dineIn ? <OldPermBadge label="Dine-in" active /> : null}
				{resolvedPerms.pickup ? <OldPermBadge label="Pickup" active /> : null}
				{resolvedPerms.delivery ? (
					<OldPermBadge label="Delivery" active />
				) : null}
				{resolvedPerms.cashPayment ? (
					<OldPermBadge label="Cash Payment" active />
				) : null}
				{resolvedPerms.reservations ? (
					<OldPermBadge label="Reservations" active />
				) : null}
			</div>

			<p className="text-[10px] font-medium text-slate-400 sm:text-xs">
				{staff.orderCount} order{staff.orderCount !== 1 ? "s" : ""} attended
				<span className="mx-1 inline-block text-slate-300 sm:mx-1.5">•</span>{" "}
				Joined {new Date(staff.createdAt).toLocaleDateString()}
			</p>
		</div>
	);
}

function OldPermBadge({ label, active }: { label: string; active: boolean }) {
	if (!active) return null;
	return (
		<span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 sm:rounded-lg sm:px-2 sm:text-xs">
			{label}
		</span>
	);
}
