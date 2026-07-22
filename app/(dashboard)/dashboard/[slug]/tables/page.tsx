import {
	ReservationStatus,
	TableBookingMode,
	TableInclusionType,
	TablePaymentTiming,
} from "@prisma/client";
import {
	Armchair,
	Ban,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	CircleHelp,
	Clock3,
	MapPin,
	Search,
	Settings,
	Users,
	WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { upsertReservationSettingAction } from "@/actions/reservation.actions";
import { TableCreateModal } from "@/components/admin/TableCreateModal";
import { TableEditModal } from "@/components/admin/TableEditModal";
import { ReservationStatusPoller } from "@/components/reservation/ReservationStatusPoller";
import { SubmitButton } from "@/components/ui/action-button";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

type TablesPageProps = {
	params: Promise<{ slug: string }>;
	searchParams?: Promise<{
		q?: string;
		status?: string;
		page?: string;
	}>;
};

type TableStatus = "ALL" | "AVAILABLE" | "RESERVED" | "OCCUPIED" | "DISABLED";
type AdminTableRow = {
	id: string;
	label: string;
	description: string | null;
	imageUrl: string | null;
	capacity: number;
	isActive: boolean;
	sortOrder: number;
	bookingModeOverride: TableBookingMode | null;
	paymentTimingOverride: TablePaymentTiming | null;
	inclusionTypeOverride: TableInclusionType | null;
	tableFee: unknown;
	minimumSpend: unknown;
	displayMinimumSpend: unknown;
	status: Exclude<TableStatus, "ALL">;
	location: string;
};

export const dynamic = "force-dynamic";

const inputClass =
	"min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-700";
const labelClass = "grid gap-1 text-xs font-semibold text-slate-500";
const pageSize = 8;

const statusFilters: Array<{ value: TableStatus; label: string }> = [
	{ value: "ALL", label: "All" },
	{ value: "AVAILABLE", label: "Available" },
	{ value: "RESERVED", label: "Reserved" },
	{ value: "OCCUPIED", label: "Occupied" },
	{ value: "DISABLED", label: "Disabled" },
];

const helpText = {
	enable:
		"Turn this on to show the public reserve-table button and allow customers to book tables.",
	bookingMode:
		"Choose what customers must do to reserve. Free booking needs no food or payment; order required makes food selection mandatory; deposit/full payment can require money up front.",
	paymentTiming:
		"Choose when payment is collected: during booking, on arrival, or after service.",
	inclusion:
		"Choose what the reservation payment covers: table fee only, food only, or both food and table fee.",
	defaultTableFee:
		"Restaurant-wide table fee used when a table does not have its own fee.",
	advanceHours:
		"Minimum notice before a customer can reserve. 24 means they must book at least 24 hours ahead.",
	holdMinutes:
		"How long the table is blocked for the booking. 60 means a 7:00 PM booking holds the table until 8:00 PM.",
	minGuests: "Smallest party size customers can reserve for.",
	maxGuests:
		"Largest party size customers can reserve for. Use 0 for no limit.",
	bookingDescription:
		"Public text customers see before booking. Use it to explain your reservation rules or experience.",
	cancellationPolicy:
		"Public cancellation rule customers see on the reservation flow and receipt.",
	tableLabel:
		"Customer-facing table name, such as Table 1, VIP Booth, or Table for couples.",
	tableDescription:
		"Short customer-facing note about the table, seating, or special setup.",
	tableImage:
		"Optional table photo. This image appears in the public table list and details modal.",
	capacity: "Maximum number of guests this table can seat.",
	sortOrder:
		"Controls display order. Lower numbers appear first on the public reservation page.",
	override:
		"Leave as restaurant default unless this table needs a different rule from the main reservation settings.",
	tableFee:
		"Specific reservation fee for this table. If filled, it overrides the default table fee.",
	minimumSpend:
		"Optional minimum food/order value expected for this table. Leave empty if it does not apply.",
} as const;

function formatMoney(value: unknown, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(Number(value ?? 0));
}

function enumOptions<T extends Record<string, string>>(values: T) {
	return Object.values(values).map((value) => (
		<option key={value} value={value}>
			{value.replaceAll("_", " ")}
		</option>
	));
}

function getTableLocation(label: string, description?: string | null) {
	const text = `${label} ${description ?? ""}`.toLowerCase();
	if (text.includes("vip")) return "VIP Room";
	if (text.includes("balcony")) return "Balcony";
	if (text.includes("outdoor") || text.includes("outside")) return "Outdoor";
	return "Indoor";
}

function getTableStatus(table: {
	isActive: boolean;
	reservations: Array<{
		status: ReservationStatus;
		startsAt: Date;
		expiresAt: Date;
	}>;
}): Exclude<TableStatus, "ALL"> {
	if (!table.isActive) return "DISABLED" satisfies TableStatus;

	const now = new Date();
	const activeReservations = table.reservations.filter(
		(reservation) => reservation.expiresAt >= now,
	);

	if (
		activeReservations.some(
			(reservation) => reservation.status === ReservationStatus.CHECKED_IN,
		)
	) {
		return "OCCUPIED" satisfies TableStatus;
	}

	if (
		activeReservations.some(
			(reservation) =>
				reservation.status === ReservationStatus.ACTIVE ||
				reservation.status === ReservationStatus.APPROVED,
		)
	) {
		return "RESERVED" satisfies TableStatus;
	}

	return "AVAILABLE" satisfies TableStatus;
}

function statusTone(status: TableStatus) {
	if (status === "AVAILABLE") {
		return {
			icon: "bg-emerald-50 text-emerald-700",
			badge: "bg-emerald-50 text-emerald-700",
			filter: "bg-emerald-50 text-emerald-700",
		};
	}
	if (status === "RESERVED") {
		return {
			icon: "bg-orange-50 text-orange-500",
			badge: "bg-orange-50 text-orange-600",
			filter: "bg-orange-50 text-orange-600",
		};
	}
	if (status === "OCCUPIED") {
		return {
			icon: "bg-red-50 text-red-600",
			badge: "bg-red-50 text-red-700",
			filter: "bg-red-50 text-red-700",
		};
	}
	if (status === "DISABLED") {
		return {
			icon: "bg-slate-100 text-slate-500",
			badge: "bg-slate-100 text-slate-600",
			filter: "bg-slate-100 text-slate-700",
		};
	}
	return {
		icon: "bg-emerald-50 text-emerald-700",
		badge: "bg-emerald-50 text-emerald-700",
		filter: "bg-emerald-800 text-white",
	};
}

function buildTablesHref(
	slug: string,
	params: { q?: string; status?: TableStatus; page?: number },
) {
	const search = new URLSearchParams();
	if (params.q) search.set("q", params.q);
	if (params.status && params.status !== "ALL")
		search.set("status", params.status);
	if (params.page && params.page > 1) search.set("page", String(params.page));
	const query = search.toString();
	return `/dashboard/${slug}/tables${query ? `?${query}` : ""}`;
}

function FieldLabel({ children, help }: { children: ReactNode; help: string }) {
	return (
		<span className="grid gap-1">
			<span className="inline-flex items-center gap-1.5">
				<span>{children}</span>
				<HelpIcon label={String(children)} help={help} />
			</span>
		</span>
	);
}

function HelpIcon({ label, help }: { label: string; help: string }) {
	return (
		<details className="group relative inline-block">
			<summary className="list-none text-slate-400 transition-colors hover:text-emerald-700">
				<CircleHelp className="size-3.5" aria-hidden="true" />
				<span className="sr-only">Show help for {label}</span>
			</summary>
			<span className="absolute z-30 mt-1 block w-64 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-xs font-semibold leading-5 text-emerald-900 shadow-lg">
				{help}
			</span>
		</details>
	);
}

export default async function TablesPage({
	params,
	searchParams,
}: TablesPageProps) {
	const { slug } = await params;
	const query = (await searchParams) ?? {};
	const searchTerm = (query.q ?? "").trim();
	const selectedStatus = statusFilters.some(
		(filter) => filter.value === query.status,
	)
		? (query.status as TableStatus)
		: "ALL";
	const currentPage = Math.max(1, Number(query.page ?? 1) || 1);

	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug },
		select: {
			id: true,
			name: true,
			slug: true,
			currency: true,
			tableReservationEnabled: true,
			reservationSetting: true,
			tables: {
				orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
				select: {
					id: true,
					label: true,
					description: true,
					imageUrl: true,
					capacity: true,
					isActive: true,
					sortOrder: true,
					bookingModeOverride: true,
					paymentTimingOverride: true,
					inclusionTypeOverride: true,
					tableFee: true,
					minimumSpend: true,
					reservations: {
						where: {
							status: {
								in: [
									ReservationStatus.APPROVED,
									ReservationStatus.ACTIVE,
									ReservationStatus.CHECKED_IN,
								],
							},
						},
						select: {
							status: true,
							startsAt: true,
							expiresAt: true,
						},
					},
				},
			},
		},
	});
	const setting = restaurant.reservationSetting ?? {
		bookingMode: TableBookingMode.FREE_BOOKING,
		paymentTiming: TablePaymentTiming.PAY_ON_ARRIVAL,
		inclusionType: TableInclusionType.TABLE_FEE_ONLY,
		defaultTableFee: null,
		advanceBookingHours: 0,
		holdDurationMinutes: 60,
		minPartySize: 1,
		maxPartySize: 0,
		bookingDescription: "",
		cancellationPolicy: "",
	};
	const tableRows = restaurant.tables.map((table) => {
		const status = getTableStatus(table);
		const location = getTableLocation(table.label, table.description);
		const displayMinimumSpend =
			table.minimumSpend ?? table.tableFee ?? setting.defaultTableFee;

		return {
			...table,
			status,
			location,
			displayMinimumSpend,
		};
	});
	const filteredTables = tableRows.filter((table) => {
		const matchesStatus =
			selectedStatus === "ALL" || table.status === selectedStatus;
		const searchText =
			`${table.label} ${table.description ?? ""} ${table.location}`.toLowerCase();
		const matchesSearch =
			searchTerm.length === 0 || searchText.includes(searchTerm.toLowerCase());
		return matchesStatus && matchesSearch;
	});
	const totalPages = Math.max(1, Math.ceil(filteredTables.length / pageSize));
	const safePage = Math.min(currentPage, totalPages);
	const visibleTables = filteredTables.slice(
		(safePage - 1) * pageSize,
		safePage * pageSize,
	);
	const firstItem =
		filteredTables.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
	const lastItem = Math.min(safePage * pageSize, filteredTables.length);
	const stats = {
		total: tableRows.length,
		available: tableRows.filter((table) => table.status === "AVAILABLE").length,
		reserved: tableRows.filter((table) => table.status === "RESERVED").length,
		occupied: tableRows.filter((table) => table.status === "OCCUPIED").length,
		disabled: tableRows.filter((table) => table.status === "DISABLED").length,
	};

	return (
		<section className="grid gap-5 lg:gap-6">
			<ReservationStatusPoller />
			<MobileTablesView
				currency={restaurant.currency}
				restaurantId={restaurant.id}
				restaurantName={restaurant.name}
				restaurantSlug={restaurant.slug}
				searchTerm={searchTerm}
				selectedStatus={selectedStatus}
				stats={stats}
				tables={visibleTables}
				totalFiltered={filteredTables.length}
				safePage={safePage}
				totalPages={totalPages}
			/>
			<div className="hidden gap-4 md:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
				<div>
					<p className="text-sm font-semibold text-slate-600">
						Welcome back, {restaurant.name}
					</p>
					<h1 className="mt-2 text-3xl font-black leading-tight text-slate-950 md:text-4xl">
						Tables
					</h1>
					<p className="mt-2 text-sm font-semibold text-slate-500 md:text-base">
						Manage your restaurant tables, seating capacity and booking rules.
					</p>
				</div>

				<div className="flex flex-wrap gap-3">
					<SettingsPanel
						restaurantSlug={restaurant.slug}
						setting={setting}
						restaurant={restaurant}
					/>
					<TableCreateModal
						currency={restaurant.currency}
						restaurantId={restaurant.id}
						restaurantSlug={restaurant.slug}
					/>
				</div>
			</div>

			<div className="hidden gap-4 md:grid sm:grid-cols-2 xl:grid-cols-5">
				<StatCard
					icon={<Armchair className="size-7" aria-hidden="true" />}
					value={stats.total}
					label="Total Tables"
					description="All tables in your restaurant"
					tone="emerald"
				/>
				<StatCard
					icon={<CheckCircle2 className="size-7" aria-hidden="true" />}
					value={stats.available}
					label="Available"
					description="Ready for booking"
					tone="emerald"
				/>
				<StatCard
					icon={<Clock3 className="size-7" aria-hidden="true" />}
					value={stats.reserved}
					label="Reserved"
					description="Currently reserved"
					tone="orange"
				/>
				<StatCard
					icon={<Users className="size-7" aria-hidden="true" />}
					value={stats.occupied}
					label="Occupied"
					description="Currently in use"
					tone="red"
				/>
				<StatCard
					icon={<Ban className="size-7" aria-hidden="true" />}
					value={stats.disabled}
					label="Disabled"
					description="Not available"
					tone="slate"
				/>
			</div>

			<div className="hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)] md:block">
				<div className="grid gap-4 xl:grid-cols-[minmax(18rem,1fr)_auto] xl:items-center">
					<form
						action={`/dashboard/${restaurant.slug}/tables`}
						className="relative"
					>
						<Search
							className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 size-5 text-slate-500"
							aria-hidden="true"
						/>
						<input
							name="q"
							defaultValue={searchTerm}
							placeholder="Search tables by name or note..."
							className="min-h-14 w-full rounded-2xl border border-slate-200 bg-white pr-4 pl-12 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-700"
						/>
						{selectedStatus !== "ALL" ? (
							<input type="hidden" name="status" value={selectedStatus} />
						) : null}
					</form>
					<div className="flex flex-wrap items-center gap-2 xl:justify-end">
						<span className="mr-1 text-sm font-bold text-slate-500">
							Filter by status:
						</span>
						{statusFilters.map((filter) => {
							const active = selectedStatus === filter.value;
							const tone = statusTone(filter.value);
							return (
								<Link
									key={filter.value}
									href={buildTablesHref(restaurant.slug, {
										q: searchTerm,
										status: filter.value,
									})}
									className={cn(
										"inline-flex min-h-11 items-center rounded-xl px-5 text-sm font-black transition-colors",
										active
											? "bg-emerald-800 text-white shadow-[0_10px_24px_rgba(4,120,87,0.18)]"
											: tone.filter,
									)}
								>
									{filter.label}
								</Link>
							);
						})}
					</div>
				</div>
			</div>

			<div className="hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)] md:block md:p-5">
				{visibleTables.length > 0 ? (
					<div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
						{visibleTables.map((table) => (
							<TableCard
								key={table.id}
								table={table}
								currency={restaurant.currency}
								restaurantId={restaurant.id}
								restaurantSlug={restaurant.slug}
							/>
						))}
					</div>
				) : (
					<div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
						<p className="text-lg font-black text-slate-950">
							No matching tables found
						</p>
						<p className="mt-2 text-sm font-semibold text-slate-500">
							Try another search or status filter.
						</p>
					</div>
				)}

				<div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
					<p className="text-sm font-semibold text-slate-500">
						Showing {firstItem} to {lastItem} of {filteredTables.length} tables
					</p>
					<div className="flex items-center gap-2">
						<PageLink
							href={buildTablesHref(restaurant.slug, {
								q: searchTerm,
								status: selectedStatus,
								page: Math.max(1, safePage - 1),
							})}
							disabled={safePage <= 1}
						>
							<ChevronLeft className="size-4" aria-hidden="true" />
						</PageLink>
						{Array.from({ length: totalPages }, (_, index) => index + 1).map(
							(page) => (
								<PageLink
									key={page}
									href={buildTablesHref(restaurant.slug, {
										q: searchTerm,
										status: selectedStatus,
										page,
									})}
									active={page === safePage}
								>
									{page}
								</PageLink>
							),
						)}
						<PageLink
							href={buildTablesHref(restaurant.slug, {
								q: searchTerm,
								status: selectedStatus,
								page: Math.min(totalPages, safePage + 1),
							})}
							disabled={safePage >= totalPages}
						>
							<ChevronRight className="size-4" aria-hidden="true" />
						</PageLink>
					</div>
				</div>
			</div>
		</section>
	);
}

function MobileTablesView({
	currency,
	restaurantId,
	restaurantName,
	restaurantSlug,
	searchTerm,
	selectedStatus,
	stats,
	tables,
	totalFiltered,
	safePage,
	totalPages,
}: {
	currency: string;
	restaurantId: string;
	restaurantName: string;
	restaurantSlug: string;
	searchTerm: string;
	selectedStatus: TableStatus;
	stats: {
		total: number;
		available: number;
		reserved: number;
		occupied: number;
		disabled: number;
	};
	tables: AdminTableRow[];
	totalFiltered: number;
	safePage: number;
	totalPages: number;
}) {
	return (
		<div className="grid w-full min-w-0 max-w-full gap-4 overflow-hidden md:hidden">
			<div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-2 pt-2">
				<div className="min-w-0">
					<p className="text-xs font-semibold text-emerald-700">
						Manage restaurant seating
					</p>
					<h1 className="mt-1 text-sm font-black leading-none tracking-normal text-slate-950">
						Tables
					</h1>
				</div>
				<TableCreateModal
					currency={currency}
					restaurantId={restaurantId}
					restaurantSlug={restaurantSlug}
					triggerLabel="Add"
					triggerClassName="inline-flex min-h-10 max-w-[4.8rem] shrink-0 items-center justify-center gap-1 rounded-xl bg-emerald-700 px-2.5 text-xs font-bold text-white shadow-[0_10px_20px_rgba(4,120,87,0.16)]"
				/>
			</div>

			<div className="grid w-full min-w-0 grid-cols-2 gap-2">
				<MobileStatCard
					icon={<Armchair className="size-5" aria-hidden="true" />}
					value={stats.total}
					label="Total Tables"
					description="All tables in your restaurant"
					tone="emerald"
				/>
				<MobileStatCard
					icon={<CheckCircle2 className="size-5" aria-hidden="true" />}
					value={stats.available}
					label="Available"
					description="Ready for booking"
					tone="emerald"
				/>
				<MobileStatCard
					icon={<Clock3 className="size-5" aria-hidden="true" />}
					value={stats.reserved}
					label="Reserved"
					description="Currently reserved"
					tone="orange"
				/>
				<MobileStatCard
					icon={<Users className="size-5" aria-hidden="true" />}
					value={stats.occupied}
					label="Occupied"
					description="Currently in use"
					tone="red"
				/>
			</div>

			<div className="w-full min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white p-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
				<form
					action={`/dashboard/${restaurantSlug}/tables`}
					className="relative"
				>
					<Search
						className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 size-5 text-slate-500"
						aria-hidden="true"
					/>
					<input
						name="q"
						defaultValue={searchTerm}
						placeholder="Search tables..."
						className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pr-3 pl-11 text-base font-semibold text-slate-600 outline-none focus:border-emerald-700"
					/>
					{selectedStatus !== "ALL" ? (
						<input type="hidden" name="status" value={selectedStatus} />
					) : null}
				</form>
				<div className="mt-3 grid w-full min-w-0 grid-cols-3 gap-2">
					{statusFilters.map((filter) => (
						<MobileFilterLink
							key={filter.value}
							active={selectedStatus === filter.value}
							filter={filter}
							restaurantSlug={restaurantSlug}
							searchTerm={searchTerm}
						/>
					))}
				</div>
			</div>

			<div className="grid w-full min-w-0 gap-3">
				{tables.length > 0 ? (
					tables.map((table) => (
						<MobileTableCard
							key={table.id}
							currency={currency}
							restaurantId={restaurantId}
							restaurantSlug={restaurantSlug}
							table={table}
						/>
					))
				) : (
					<div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white p-6 text-center">
						<p className="text-sm font-bold text-slate-950">
							No matching tables found
						</p>
						<p className="mt-1 text-xs font-medium text-slate-500">
							Try another search or status filter.
						</p>
					</div>
				)}
			</div>

			{totalPages > 1 ? (
				<div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-2">
					<PageLink
						href={buildTablesHref(restaurantSlug, {
							q: searchTerm,
							status: selectedStatus,
							page: Math.max(1, safePage - 1),
						})}
						disabled={safePage <= 1}
					>
						<ChevronLeft className="size-4" aria-hidden="true" />
					</PageLink>
					<span className="text-xs font-semibold text-slate-500">
						Page {safePage} of {totalPages} • {totalFiltered} table
						{totalFiltered === 1 ? "" : "s"}
					</span>
					<PageLink
						href={buildTablesHref(restaurantSlug, {
							q: searchTerm,
							status: selectedStatus,
							page: Math.min(totalPages, safePage + 1),
						})}
						disabled={safePage >= totalPages}
					>
						<ChevronRight className="size-4" aria-hidden="true" />
					</PageLink>
				</div>
			) : null}

			<span className="sr-only">{restaurantName} tables admin view</span>
		</div>
	);
}

function MobileStatCard({
	icon,
	value,
	label,
	description,
	tone,
}: {
	icon: ReactNode;
	value: number;
	label: string;
	description: string;
	tone: "emerald" | "orange" | "red";
}) {
	const toneClass = {
		emerald: "bg-emerald-50 text-emerald-700",
		orange: "bg-orange-50 text-orange-500",
		red: "bg-red-50 text-red-600",
	}[tone];

	return (
		<div className="grid min-h-[7.1rem] w-full min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2 rounded-2xl border border-slate-100 bg-white p-2 shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
			<span
				className={cn("grid size-9 place-items-center rounded-xl", toneClass)}
			>
				{icon}
			</span>
			<span className="min-w-0">
				<span className="block text-lg font-bold leading-none text-slate-950">
					{value}
				</span>
				<span className="mt-1.5 block truncate text-xs font-bold text-slate-950">
					{label}
				</span>
				<span className="mt-1 block truncate text-xs font-medium leading-4 text-slate-500">
					{description}
				</span>
			</span>
		</div>
	);
}

function MobileFilterLink({
	active,
	filter,
	restaurantSlug,
	searchTerm,
}: {
	active: boolean;
	filter: { value: TableStatus; label: string };
	restaurantSlug: string;
	searchTerm: string;
}) {
	const tone =
		filter.value === "AVAILABLE"
			? "bg-emerald-700 text-white"
			: filter.value === "RESERVED"
				? "bg-orange-50 text-orange-600"
				: filter.value === "OCCUPIED"
					? "bg-red-50 text-red-600"
					: "bg-slate-100 text-slate-700";

	return (
		<Link
			href={buildTablesHref(restaurantSlug, {
				q: searchTerm,
				status: filter.value,
			})}
			className={cn(
				"inline-flex min-h-9 w-full min-w-0 items-center justify-center rounded-xl px-2 text-xs font-bold",
				active ? "bg-emerald-700 text-white" : tone,
				active && filter.value !== "AVAILABLE" && "bg-emerald-700 text-white",
			)}
		>
			{filter.label}
		</Link>
	);
}

function MobileTableCard({
	currency,
	restaurantId,
	restaurantSlug,
	table,
}: {
	currency: string;
	restaurantId: string;
	restaurantSlug: string;
	table: AdminTableRow;
}) {
	const tone = statusTone(table.status);
	const statusLabel =
		table.status === "AVAILABLE"
			? "Available"
			: table.status === "RESERVED"
				? "Reserved"
				: table.status === "OCCUPIED"
					? "Occupied"
					: "Disabled";

	return (
		<article className="relative w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
			<div className="grid min-w-0 grid-cols-[3.25rem_minmax(0,1fr)_1.25rem] items-center gap-2">
				<span
					className={cn(
						"grid size-12 place-items-center rounded-xl",
						tone.icon,
					)}
				>
					<Armchair className="size-6" aria-hidden="true" />
				</span>
				<div className="min-w-0">
					<h2 className="truncate text-sm font-bold text-slate-950">
						{table.label}
					</h2>
					<span
						className={cn(
							"mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
							tone.badge,
						)}
					>
						<span className="size-2 rounded-full bg-current" />
						{statusLabel}
					</span>
				</div>
				<ChevronRight className="size-5 text-slate-700" aria-hidden="true" />
			</div>

			<div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] overflow-hidden rounded-xl border border-slate-100 bg-white text-center">
				<MobileTableMeta
					icon={<Users className="size-4" aria-hidden="true" />}
					label="Seats"
					value={String(table.capacity)}
				/>
				<MobileTableMeta
					icon={<MapPin className="size-4" aria-hidden="true" />}
					label="Location"
					value={table.location}
				/>
				<MobileTableMeta
					icon={<WalletCards className="size-4" aria-hidden="true" />}
					label="Minimum Spend"
					value={formatMoney(table.displayMinimumSpend, currency)}
				/>
			</div>

			<TableEditModal
				currency={currency}
				restaurantId={restaurantId}
				restaurantSlug={restaurantSlug}
				trigger={<span className="sr-only">Edit {table.label}</span>}
				triggerAriaLabel={`Edit ${table.label}`}
				triggerClassName="absolute inset-0 z-10 rounded-2xl"
				table={{
					id: table.id,
					label: table.label,
					description: table.description,
					imageUrl: table.imageUrl,
					capacity: table.capacity,
					isActive: table.isActive,
					sortOrder: table.sortOrder,
					bookingModeOverride: table.bookingModeOverride,
					paymentTimingOverride: table.paymentTimingOverride,
					inclusionTypeOverride: table.inclusionTypeOverride,
					tableFee: table.tableFee?.toString() ?? "",
					minimumSpend: table.minimumSpend?.toString() ?? "",
					displayMinimumSpend: formatMoney(table.displayMinimumSpend, currency),
					status: table.status,
					location: table.location,
				}}
			/>
		</article>
	);
}

function MobileTableMeta({
	icon,
	label,
	value,
}: {
	icon: ReactNode;
	label: string;
	value: string;
}) {
	return (
		<div className="grid min-w-0 gap-1 border-slate-100 border-r px-1.5 py-2.5 last:border-r-0">
			<span className="mx-auto text-slate-500">{icon}</span>
			<span className="truncate text-xs font-medium text-slate-500">
				{label}
			</span>
			<span className="truncate text-xs font-semibold text-slate-700">
				{value}
			</span>
		</div>
	);
}

function StatCard({
	icon,
	value,
	label,
	description,
	tone,
}: {
	icon: ReactNode;
	value: number;
	label: string;
	description: string;
	tone: "emerald" | "orange" | "red" | "slate";
}) {
	const toneClass = {
		emerald: "bg-emerald-50 text-emerald-700",
		orange: "bg-orange-50 text-orange-500",
		red: "bg-red-50 text-red-600",
		slate: "bg-slate-100 text-slate-600",
	}[tone];

	return (
		<div className="grid min-h-32 grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
			<span
				className={cn("grid size-16 place-items-center rounded-3xl", toneClass)}
			>
				{icon}
			</span>
			<span className="min-w-0">
				<span className="block text-3xl font-black leading-none text-slate-950">
					{value}
				</span>
				<span className="mt-2 block text-sm font-black text-slate-950">
					{label}
				</span>
				<span className="mt-2 block text-xs font-semibold text-slate-500">
					{description}
				</span>
			</span>
		</div>
	);
}

function SettingsPanel({
	restaurantSlug,
	restaurant,
	setting,
}: {
	restaurantSlug: string;
	restaurant: { tableReservationEnabled: boolean };
	setting: {
		bookingMode: TableBookingMode;
		paymentTiming: TablePaymentTiming;
		inclusionType: TableInclusionType;
		defaultTableFee: unknown;
		advanceBookingHours: number;
		holdDurationMinutes: number;
		minPartySize: number;
		maxPartySize: number;
		bookingDescription: string | null;
		cancellationPolicy: string | null;
	};
}) {
	return (
		<details className="group relative">
			<summary className="inline-flex min-h-12 cursor-pointer list-none items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-950 shadow-sm transition-colors hover:border-emerald-200 hover:text-emerald-800">
				<Settings className="size-5" aria-hidden="true" />
				Reservation Settings
			</summary>
			<form
				action={upsertReservationSettingAction}
				className="mt-3 grid gap-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-2xl md:absolute md:right-0 md:z-40 md:w-[min(62rem,calc(100vw-22rem))] md:p-5"
			>
				<input type="hidden" name="slug" value={restaurantSlug} />
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="text-lg font-black text-slate-950">
							Reservation settings
						</h2>
						<p className="mt-1 text-sm font-semibold text-slate-500">
							Default policy used unless a table overrides it.
						</p>
					</div>
					<label className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
						<input
							type="checkbox"
							name="tableReservationEnabled"
							defaultChecked={restaurant.tableReservationEnabled}
							className="size-4 accent-emerald-700"
						/>
						Enabled
						<HelpIcon label="reservations enabled" help={helpText.enable} />
					</label>
				</div>

				<div className="grid gap-3 md:grid-cols-3">
					<label className={labelClass}>
						<FieldLabel help={helpText.bookingMode}>
							Booking requirement
						</FieldLabel>
						<select
							name="bookingMode"
							defaultValue={setting.bookingMode}
							className={inputClass}
						>
							{enumOptions(TableBookingMode)}
						</select>
					</label>
					<label className={labelClass}>
						<FieldLabel help={helpText.paymentTiming}>
							When customer pays
						</FieldLabel>
						<select
							name="paymentTiming"
							defaultValue={setting.paymentTiming}
							className={inputClass}
						>
							{enumOptions(TablePaymentTiming)}
						</select>
					</label>
					<label className={labelClass}>
						<FieldLabel help={helpText.inclusion}>
							What payment covers
						</FieldLabel>
						<select
							name="inclusionType"
							defaultValue={setting.inclusionType}
							className={inputClass}
						>
							{enumOptions(TableInclusionType)}
						</select>
					</label>
				</div>

				<div className="grid gap-3 md:grid-cols-5">
					<label className={labelClass}>
						<FieldLabel help={helpText.defaultTableFee}>
							Default reservation fee
						</FieldLabel>
						<input
							name="defaultTableFee"
							type="number"
							min="0"
							step="100"
							defaultValue={setting.defaultTableFee?.toString() ?? ""}
							className={inputClass}
						/>
					</label>
					<label className={labelClass}>
						<FieldLabel help={helpText.advanceHours}>Minimum notice</FieldLabel>
						<input
							name="advanceBookingHours"
							type="number"
							min="0"
							defaultValue={setting.advanceBookingHours}
							className={inputClass}
						/>
					</label>
					<label className={labelClass}>
						<FieldLabel help={helpText.holdMinutes}>Table hold time</FieldLabel>
						<input
							name="holdDurationMinutes"
							type="number"
							min="15"
							defaultValue={setting.holdDurationMinutes}
							className={inputClass}
						/>
					</label>
					<label className={labelClass}>
						<FieldLabel help={helpText.minGuests}>Minimum guests</FieldLabel>
						<input
							name="minPartySize"
							type="number"
							min="1"
							defaultValue={setting.minPartySize}
							className={inputClass}
						/>
					</label>
					<label className={labelClass}>
						<FieldLabel help={helpText.maxGuests}>Maximum guests</FieldLabel>
						<input
							name="maxPartySize"
							type="number"
							min="0"
							defaultValue={setting.maxPartySize}
							className={inputClass}
						/>
					</label>
				</div>

				<div className="grid gap-3 md:grid-cols-2">
					<label className={labelClass}>
						<FieldLabel help={helpText.bookingDescription}>
							Public booking note
						</FieldLabel>
						<textarea
							name="bookingDescription"
							defaultValue={setting.bookingDescription ?? ""}
							rows={4}
							className={`${inputClass} py-3`}
						/>
					</label>
					<label className={labelClass}>
						<FieldLabel help={helpText.cancellationPolicy}>
							Cancellation policy
						</FieldLabel>
						<textarea
							name="cancellationPolicy"
							defaultValue={setting.cancellationPolicy ?? ""}
							rows={4}
							className={`${inputClass} py-3`}
						/>
					</label>
				</div>

				<SubmitButton className="min-h-11 w-fit rounded-xl bg-emerald-700 px-5 text-sm font-black text-white">
					Save settings
				</SubmitButton>
			</form>
		</details>
	);
}

function TableCard({
	table,
	currency,
	restaurantId,
	restaurantSlug,
}: {
	table: {
		id: string;
		label: string;
		description: string | null;
		imageUrl: string | null;
		capacity: number;
		isActive: boolean;
		sortOrder: number;
		bookingModeOverride: TableBookingMode | null;
		paymentTimingOverride: TablePaymentTiming | null;
		inclusionTypeOverride: TableInclusionType | null;
		tableFee: unknown;
		minimumSpend: unknown;
		displayMinimumSpend: unknown;
		status: Exclude<TableStatus, "ALL">;
		location: string;
	};
	currency: string;
	restaurantId: string;
	restaurantSlug: string;
}) {
	const tone = statusTone(table.status);

	return (
		<article className="grid min-h-66 gap-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
			<div className="flex items-start justify-between gap-3">
				<div className="flex items-center gap-4">
					<span
						className={cn(
							"grid size-16 shrink-0 place-items-center rounded-full",
							tone.icon,
						)}
					>
						<Armchair className="size-7" aria-hidden="true" />
					</span>
					<div>
						<h2 className="text-xl font-black text-slate-950">{table.label}</h2>
					</div>
				</div>
				<span
					className={cn(
						"rounded-full px-3 py-1 text-xs font-black",
						tone.badge,
					)}
				>
					{table.status === "AVAILABLE"
						? "Available"
						: table.status === "RESERVED"
							? "Reserved"
							: table.status === "OCCUPIED"
								? "Occupied"
								: "Disabled"}
				</span>
			</div>

			<div className="grid gap-3 text-sm font-semibold text-slate-600">
				<TableMetaRow
					icon={<Users className="size-4" aria-hidden="true" />}
					label="Seats"
					value={String(table.capacity)}
				/>
				<TableMetaRow
					icon={<MapPin className="size-4" aria-hidden="true" />}
					label="Location"
					value={table.location}
				/>
				<TableMetaRow
					icon={<WalletCards className="size-4" aria-hidden="true" />}
					label="Minimum Spend"
					value={formatMoney(table.displayMinimumSpend, currency)}
				/>
			</div>

			<div className="mt-auto flex justify-end">
				<TableEditModal
					currency={currency}
					restaurantId={restaurantId}
					restaurantSlug={restaurantSlug}
					table={{
						id: table.id,
						label: table.label,
						description: table.description,
						imageUrl: table.imageUrl,
						capacity: table.capacity,
						isActive: table.isActive,
						sortOrder: table.sortOrder,
						bookingModeOverride: table.bookingModeOverride,
						paymentTimingOverride: table.paymentTimingOverride,
						inclusionTypeOverride: table.inclusionTypeOverride,
						tableFee: table.tableFee?.toString() ?? "",
						minimumSpend: table.minimumSpend?.toString() ?? "",
						displayMinimumSpend: formatMoney(
							table.displayMinimumSpend,
							currency,
						),
						status: table.status,
						location: table.location,
					}}
				/>
			</div>
		</article>
	);
}

function TableMetaRow({
	icon,
	label,
	value,
}: {
	icon: ReactNode;
	label: string;
	value: string;
}) {
	return (
		<div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-center gap-3">
			<span className="text-slate-600">{icon}</span>
			<span>{label}</span>
			<span className="text-right font-black text-slate-950">{value}</span>
		</div>
	);
}

function PageLink({
	href,
	children,
	active = false,
	disabled = false,
}: {
	href: string;
	children: ReactNode;
	active?: boolean;
	disabled?: boolean;
}) {
	if (disabled) {
		return (
			<span className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-300">
				{children}
			</span>
		);
	}

	return (
		<Link
			href={href}
			className={cn(
				"grid size-10 place-items-center rounded-xl border text-sm font-black",
				active
					? "border-emerald-700 bg-emerald-700 text-white"
					: "border-slate-200 bg-white text-slate-700",
			)}
		>
			{children}
		</Link>
	);
}
