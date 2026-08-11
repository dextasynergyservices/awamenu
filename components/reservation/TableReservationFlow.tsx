"use client";

import {
	Armchair,
	ArrowLeft,
	ArrowRight,
	CalendarDays,
	Check,
	ChevronLeft,
	ChevronRight,
	Clock,
	Crown,
	Grid2X2,
	Home,
	LockKeyhole,
	MapPin,
	MessageSquare,
	Minus,
	Phone,
	Plus,
	ShieldCheck,
	Users,
	Utensils,
	X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { createReservationAction } from "@/actions/reservation.actions";
import { CustomerAccountDrawer } from "@/components/menu/CustomerAccountDrawer";
import { PublicMenuNavbar } from "@/components/menu/PublicMenuNavbar";
import { SubmitButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { cn } from "@/lib/utils";

type TablePolicy = {
	bookingMode: string;
	paymentTiming: string;
	inclusionType: string;
	tableFee: number;
};

type ReservationTable = {
	id: string;
	label: string;
	description: string | null;
	imageUrl: string | null;
	capacity: number;
	policy: TablePolicy;
	reservations: Array<{
		startsAt: string;
		expiresAt: string;
	}>;
};

type MenuItem = {
	id: string;
	name: string;
	description: string | null;
	price: number;
	imageUrl: string | null;
};

type MenuCategory = {
	id: string;
	name: string;
	items: MenuItem[];
};

type ReservationSetting = {
	bookingDescription: string | null;
	advanceBookingHours: number;
	holdDurationMinutes: number;
	minPartySize: number;
	maxPartySize: number;
	cancellationPolicy: string | null;
};

type SelectedFoodItem = {
	id: string;
	quantity: number;
	notes?: string;
};

type TableReservationFlowProps = {
	restaurantName: string;
	restaurantSlug: string;
	logoUrl: string | null;
	phone: string | null;
	whatsappNumber: string | null;
	currency: string;
	setting: ReservationSetting;
	initialReservationDateTime: {
		date: string;
		time: string;
	};
	tables: ReservationTable[];
	categories: MenuCategory[];
};

type TableFilter = "ALL" | "INDOOR" | "OUTDOOR" | "VIP";
type DesktopStep = "selection" | "details";

const tableFilters: Array<{ value: TableFilter; label: string }> = [
	{ value: "ALL", label: "All" },
	{ value: "INDOOR", label: "Indoor" },
	{ value: "OUTDOOR", label: "Outdoor" },
	{ value: "VIP", label: "VIP" },
];

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

function clampPartySize(value: number, setting: ReservationSetting) {
	const max =
		setting.maxPartySize > 0 ? setting.maxPartySize : Number.POSITIVE_INFINITY;
	return Math.min(Math.max(value, setting.minPartySize), max);
}

function isTableAvailable(table: ReservationTable, date: string, time: string) {
	if (!date || !time) return true;
	const requested = new Date(`${date}T${time}:00`).getTime();
	if (Number.isNaN(requested)) return true;

	return !table.reservations.some((reservation) => {
		const startsAt = new Date(reservation.startsAt).getTime();
		const expiresAt = new Date(reservation.expiresAt).getTime();
		return startsAt <= requested && requested < expiresAt;
	});
}

function requiresFood(policy?: TablePolicy) {
	if (!policy) return false;
	return (
		policy.bookingMode === "ORDER_REQUIRED" ||
		policy.inclusionType === "FOOD_ONLY" ||
		policy.inclusionType === "FOOD_AND_TABLE_FEE"
	);
}

function formatBookingMode(policy: TablePolicy) {
	if (policy.bookingMode === "FREE_BOOKING") return "Free booking";
	if (policy.bookingMode === "ORDER_REQUIRED") return "Food pre-order required";
	if (policy.bookingMode === "DEPOSIT_REQUIRED") return "Deposit required";
	return "Full payment required";
}

function formatPaymentTiming(policy: TablePolicy) {
	if (policy.paymentTiming === "PAY_ON_BOOKING") return "Pay on booking";
	if (policy.paymentTiming === "PAY_AFTER_SERVICE") return "Pay after service";
	return "Pay on arrival";
}

function formatInclusion(policy: TablePolicy) {
	if (policy.inclusionType === "FOOD_ONLY") return "Food only";
	if (policy.inclusionType === "FOOD_AND_TABLE_FEE")
		return "Food and table fee";
	return "Table fee only";
}

function formatDateLabel(value: string) {
	const [year, month, day] = value.split("-").map(Number);
	if (!year || !month || !day) return value;

	const monthName =
		[
			"Jan",
			"Feb",
			"Mar",
			"Apr",
			"May",
			"Jun",
			"Jul",
			"Aug",
			"Sep",
			"Oct",
			"Nov",
			"Dec",
		][month - 1] ?? "";
	return `${String(day).padStart(2, "0")} ${monthName} ${year}`;
}

function formatTimeLabel(value: string) {
	const [hourValue, minuteValue] = value.split(":").map(Number);
	if (Number.isNaN(hourValue) || Number.isNaN(minuteValue)) return value;

	return `${String(hourValue).padStart(2, "0")}:${String(minuteValue).padStart(2, "0")}`;
}

function getTableZone(table: ReservationTable): Exclude<TableFilter, "ALL"> {
	const text = `${table.label} ${table.description ?? ""}`.toLowerCase();
	if (text.includes("vip")) return "VIP";
	if (text.includes("outdoor") || text.includes("outside")) return "OUTDOOR";
	return "INDOOR";
}

function zoneLabel(zone: Exclude<TableFilter, "ALL">) {
	if (zone === "VIP") return "VIP Room";
	if (zone === "OUTDOOR") return "Outdoor";
	return "Indoor";
}

function tableTone(zone: Exclude<TableFilter, "ALL">, selected: boolean) {
	if (selected) {
		return {
			icon: "bg-emerald-50 text-emerald-700",
			border: "border-emerald-700 bg-emerald-50/20",
		};
	}
	if (zone === "VIP") {
		return {
			icon: "bg-orange-50 text-orange-500",
			border: "border-slate-200 bg-white",
		};
	}
	if (zone === "OUTDOOR") {
		return {
			icon: "bg-red-50 text-red-500",
			border: "border-slate-200 bg-white",
		};
	}
	return {
		icon: "bg-slate-50 text-slate-950",
		border: "border-slate-200 bg-white",
	};
}

export function TableReservationFlow({
	restaurantName,
	restaurantSlug,
	logoUrl,
	phone,
	whatsappNumber,
	currency,
	setting,
	initialReservationDateTime,
	tables,
	categories,
}: TableReservationFlowProps) {
	const [date, setDate] = useState(initialReservationDateTime.date);
	const [time, setTime] = useState(initialReservationDateTime.time);
	const [partySize, setPartySize] = useState(setting.minPartySize);
	const [selectedTableId, setSelectedTableId] = useState(tables[0]?.id ?? "");
	const [selectedItems, setSelectedItems] = useState<SelectedFoodItem[]>([]);
	const [previewTableId, setPreviewTableId] = useState<string | null>(null);
	const [activeCategoryId, setActiveCategoryId] = useState(
		categories[0]?.id ?? "",
	);
	const [foodPage, setFoodPage] = useState(1);
	const [tableFilter, setTableFilter] = useState<TableFilter>("ALL");
	const [tablePage, setTablePage] = useState(1);
	const [desktopStep, setDesktopStep] = useState<DesktopStep>("selection");
	const selectedTable = tables.find((table) => table.id === selectedTableId);
	const previewTable = previewTableId
		? (tables.find((table) => table.id === previewTableId) ?? null)
		: null;
	const activeCategory =
		categories.find((category) => category.id === activeCategoryId) ??
		categories[0];
	const activeFoodItems = activeCategory?.items ?? [];
	const foodPageSize = 6;
	const foodPageCount = Math.max(
		1,
		Math.ceil(activeFoodItems.length / foodPageSize),
	);
	const currentFoodPage = Math.min(foodPage, foodPageCount);
	const paginatedFoodItems = activeFoodItems.slice(
		(currentFoodPage - 1) * foodPageSize,
		currentFoodPage * foodPageSize,
	);
	const flatMenuItems = useMemo(
		() => categories.flatMap((category) => category.items),
		[categories],
	);
	const filteredTables = tables.filter(
		(table) => tableFilter === "ALL" || getTableZone(table) === tableFilter,
	);
	const tablePageSize = 4;
	const tablePageCount = Math.max(
		1,
		Math.ceil(filteredTables.length / tablePageSize),
	);
	const currentTablePage = Math.min(tablePage, tablePageCount);
	const paginatedTables = filteredTables.slice(
		(currentTablePage - 1) * tablePageSize,
		currentTablePage * tablePageSize,
	);
	const foodTotal = selectedItems.reduce((total, selectedItem) => {
		const menuItem = flatMenuItems.find((item) => item.id === selectedItem.id);
		return total + (menuItem?.price ?? 0) * selectedItem.quantity;
	}, 0);
	const tableFee = selectedTable?.policy.tableFee ?? 0;
	const selectedItemsJson = JSON.stringify(selectedItems);
	const foodRequired = requiresFood(selectedTable?.policy);
	const showFoodSection = foodRequired || selectedItems.length > 0;
	const featuredImageUrl =
		selectedTable?.imageUrl ?? tables.find((table) => table.imageUrl)?.imageUrl;
	const selectedTableIsAvailable = selectedTable
		? isTableAvailable(selectedTable, date, time) &&
			partySize <= selectedTable.capacity
		: false;

	function updateItem(itemId: string, nextQuantity: number) {
		setSelectedItems((current) => {
			if (nextQuantity <= 0) {
				return current.filter((item) => item.id !== itemId);
			}

			const existing = current.find((item) => item.id === itemId);
			if (existing) {
				return current.map((item) =>
					item.id === itemId ? { ...item, quantity: nextQuantity } : item,
				);
			}

			return [...current, { id: itemId, quantity: nextQuantity }];
		});
	}

	function selectTable(tableId: string) {
		setSelectedTableId(tableId);
		setPreviewTableId(null);
	}

	function handleTableClick(tableId: string, selectable: boolean) {
		const isDesktop =
			typeof window !== "undefined" &&
			window.matchMedia("(min-width: 768px)").matches;

		if (isDesktop) {
			if (selectable) {
				setSelectedTableId(tableId);
				setDesktopStep("selection");
			}
			return;
		}

		setPreviewTableId(tableId);
	}

	return (
		<main className="min-h-screen bg-white text-slate-950 md:bg-[#fbfcfd]">
			<PublicMenuNavbar
				name={restaurantName}
				logoUrl={logoUrl}
				mode="mobile"
				restaurantSlug={restaurantSlug}
			/>
			<DesktopReservationHeader
				restaurantName={restaurantName}
				restaurantSlug={restaurantSlug}
				logoUrl={logoUrl}
				phone={phone}
				whatsappNumber={whatsappNumber}
			/>
			<ActionForm action={createReservationAction} className="md:pt-25 lg:pt-0">
				<input type="hidden" name="slug" value={restaurantSlug} />
				<input type="hidden" name="tableId" value={selectedTableId} />
				<input type="hidden" name="items" value={selectedItemsJson} />

				<div className="mx-auto grid max-w-472 gap-6 px-4 pb-36 pt-5 md:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)] md:items-start md:px-6 md:py-8 lg:grid-cols-[minmax(19rem,27rem)_minmax(28rem,1fr)_minmax(21rem,29rem)] lg:gap-8 lg:pt-28">
					<section className="md:col-span-2 lg:hidden">
						<p className="text-xs font-black uppercase tracking-wide text-emerald-700">
							Table Reservation
						</p>
						<h2 className="mt-2 text-sm font-black leading-tight text-slate-950 md:text-3xl">
							Reserve a table
						</h2>
						<p className="mt-2 text-xs font-semibold leading-6 text-slate-500 md:text-base">
							{setting.bookingDescription ?? "Great food is better shared."}
						</p>
					</section>

					<div className="md:col-start-1 md:row-start-2 lg:fixed lg:top-28 lg:bottom-8 lg:left-[max(1.5rem,calc((100vw-118rem)/2+1.5rem))] lg:z-40 lg:w-108 lg:overflow-y-auto lg:pr-1">
						<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)] md:p-5">
							<div className="mb-4 flex items-start gap-3">
								<span className="hidden size-8 shrink-0 place-items-center rounded-full bg-emerald-800 text-sm font-black text-white md:grid">
									1
								</span>
								<div>
									<div className="flex items-center gap-3 md:hidden">
										<CalendarDays className="size-5 text-emerald-700" />
										<h3 className="text-sm font-black text-slate-950">
											Reservation Details
										</h3>
									</div>
									<div className="hidden md:block">
										<h3 className="text-lg font-black text-slate-950">
											Reservation Details
										</h3>
										<p className="mt-1 text-sm font-semibold text-slate-500">
											Tell us when you&apos;re coming
										</p>
									</div>
								</div>
							</div>
							<div className="grid gap-3">
								<DateTimeField
									htmlFor="reservation-date"
									icon={<CalendarDays className="size-6" aria-hidden="true" />}
									label="Date"
									displayValue={formatDateLabel(date)}
								>
									<input
										id="reservation-date"
										type="date"
										name="date"
										value={date}
										min={initialReservationDateTime.date}
										onChange={(event) => setDate(event.target.value)}
										required
										className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-black text-slate-700 outline-none focus:border-emerald-700"
									/>
								</DateTimeField>
								<DateTimeField
									htmlFor="reservation-time"
									icon={<Clock className="size-6" aria-hidden="true" />}
									label="Time"
									displayValue={formatTimeLabel(time)}
								>
									<input
										id="reservation-time"
										type="time"
										name="time"
										value={time}
										onChange={(event) => setTime(event.target.value)}
										required
										className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-black text-slate-700 outline-none focus:border-emerald-700"
									/>
								</DateTimeField>
								<div className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
									<span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
										<Users className="size-5" aria-hidden="true" />
									</span>
									<div className="min-w-0">
										<p className="text-xs font-black text-slate-500">Guests</p>
										<p className="mt-1 text-sm font-black text-slate-950">
											{partySize} Guest{partySize === 1 ? "" : "s"}
										</p>
									</div>
									<div className="inline-flex items-center rounded-xl border border-slate-200">
										<button
											type="button"
											onClick={() =>
												setPartySize((current) =>
													clampPartySize(current - 1, setting),
												)
											}
											className="grid size-10 place-items-center text-emerald-800 disabled:opacity-40"
											disabled={partySize <= setting.minPartySize}
											aria-label="Reduce guests"
										>
											<Minus className="size-4" aria-hidden="true" />
										</button>
										<span className="min-w-8 text-center text-sm font-black">
											{partySize}
										</span>
										<button
											type="button"
											onClick={() =>
												setPartySize((current) =>
													clampPartySize(current + 1, setting),
												)
											}
											disabled={
												setting.maxPartySize > 0 &&
												partySize >= setting.maxPartySize
											}
											className="grid size-10 place-items-center text-emerald-800 disabled:opacity-40"
											aria-label="Increase guests"
										>
											<Plus className="size-4" aria-hidden="true" />
										</button>
									</div>
									<input
										id="reservation-guests"
										type="hidden"
										name="partySize"
										value={partySize}
									/>
								</div>
							</div>
							<div className="mt-4 hidden rounded-2xl bg-emerald-50/80 p-4 text-sm font-semibold leading-6 text-emerald-950 md:grid md:grid-cols-[2.25rem_minmax(0,1fr)] md:gap-3">
								<span className="grid size-9 place-items-center rounded-xl bg-white text-emerald-800">
									<Clock className="size-5" aria-hidden="true" />
								</span>
								<span>
									<span className="block font-black">
										We hold your table for {setting.holdDurationMinutes} minutes
									</span>
									<span className="mt-1 block text-slate-600">
										Your request will be reviewed by admin before payment.
									</span>
								</span>
							</div>
						</section>

						<section className="mt-6 hidden md:block">
							{featuredImageUrl ? (
								<div className="relative aspect-16/10 overflow-hidden rounded-2xl bg-emerald-50 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
									<Image
										src={featuredImageUrl}
										alt={`${restaurantName} table seating`}
										fill
										className="object-cover"
										sizes="(min-width: 1024px) 28vw, 50vw"
										unoptimized
									/>
								</div>
							) : null}
							<div className="mt-5 grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 text-sm font-semibold leading-6 text-slate-600">
								<span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-800">
									<ShieldCheck className="size-5" aria-hidden="true" />
								</span>
								<p>
									<span className="block font-black text-slate-950">
										Secure & flexible booking
									</span>
									<span>Admin confirms availability before payment.</span>
								</p>
							</div>
						</section>
					</div>

					<section className="md:col-start-1 md:row-start-4 lg:col-start-2 lg:row-start-1">
						<div className="flex items-start gap-3">
							<span className="hidden size-8 shrink-0 place-items-center rounded-full bg-emerald-800 text-sm font-black text-white md:grid">
								2
							</span>
							<div>
								<h3 className="text-sm font-black text-slate-950 md:text-xl">
									Available Tables
								</h3>
								<p className="mt-1 hidden text-sm font-semibold text-slate-500 md:block">
									Choose the perfect table for your experience
								</p>
							</div>
						</div>
						<div className="mt-4 flex gap-3 overflow-x-auto pb-1">
							{tableFilters.map((filter) => (
								<button
									key={filter.value}
									type="button"
									onClick={() => {
										setTableFilter(filter.value);
										setTablePage(1);
									}}
									className={cn(
										"inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-5 text-xs font-black transition-colors sm:text-sm",
										tableFilter === filter.value
											? "border-emerald-700 bg-emerald-700 text-white"
											: "border-slate-200 bg-white text-slate-600",
									)}
								>
									<FilterIcon filter={filter.value} />
									{filter.label}
								</button>
							))}
						</div>

						<div className="mt-4 grid gap-3">
							{paginatedTables.map((table) => {
								const zone = getTableZone(table);
								const available = isTableAvailable(table, date, time);
								const fitsParty = partySize <= table.capacity;
								const selectable = available && fitsParty;
								const unavailableLabel = !fitsParty ? "Too small" : "Reserved";
								const selected = selectedTableId === table.id;
								const visiblySelected = selected && selectable;

								return (
									<TableCard
										key={table.id}
										table={table}
										zone={zone}
										currency={currency}
										selected={visiblySelected}
										selectable={selectable}
										unavailableLabel={unavailableLabel}
										onSelect={() => handleTableClick(table.id, selectable)}
									/>
								);
							})}
							{filteredTables.length === 0 ? (
								<div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs font-bold text-slate-500 sm:text-sm">
									No tables match this filter.
								</div>
							) : null}
						</div>
						<TablePagination
							currentPage={currentTablePage}
							pageCount={tablePageCount}
							totalItems={filteredTables.length}
							pageSize={tablePageSize}
							onPageChange={setTablePage}
						/>
					</section>

					<DesktopSelectionPanel
						step={desktopStep}
						onContinue={() => setDesktopStep("details")}
						selectedTable={selectedTable}
						currency={currency}
						date={date}
						time={time}
						partySize={partySize}
						tableFee={tableFee}
						selectedTableIsAvailable={selectedTableIsAvailable}
					/>

					<section
						className={cn(
							"rounded-2xl border border-slate-200 bg-white p-4 transition-all duration-300 md:col-start-2 md:row-start-1 md:max-h-[calc(100vh-8rem)] md:overflow-y-auto md:p-5 lg:fixed lg:top-28 lg:right-[max(1.5rem,calc((100vw-118rem)/2+1.5rem))] lg:bottom-8 lg:z-40 lg:w-116 lg:max-h-none lg:col-start-3",
							desktopStep === "details"
								? "md:block md:translate-x-0 md:opacity-100"
								: "md:hidden md:translate-x-4 md:opacity-0",
						)}
					>
						<button
							type="button"
							onClick={() => setDesktopStep("selection")}
							className="mb-4 hidden items-center gap-2 text-sm font-black text-emerald-800 md:inline-flex"
						>
							<ArrowLeft className="size-4" aria-hidden="true" />
							Back to selection
						</button>
						<h3 className="text-sm font-black text-slate-950 md:text-xl">
							Your details
						</h3>
						<div className="mt-4 grid gap-3">
							<input
								name="customerName"
								required
								placeholder="Full name"
								className="h-14 rounded-2xl border border-slate-200 px-4 text-base font-semibold outline-none focus:border-emerald-700"
							/>
							<input
								name="customerPhone"
								required
								placeholder="Phone number"
								inputMode="tel"
								className="h-14 rounded-2xl border border-slate-200 px-4 text-base font-semibold outline-none focus:border-emerald-700"
							/>
							<input
								name="customerEmail"
								type="email"
								placeholder="Email address (optional)"
								className="h-14 rounded-2xl border border-slate-200 px-4 text-base font-semibold outline-none focus:border-emerald-700"
							/>
							<textarea
								name="specialRequests"
								rows={3}
								placeholder="Special requests"
								className="rounded-2xl border border-slate-200 px-4 py-3 text-base font-semibold outline-none focus:border-emerald-700"
							/>
						</div>
						{showFoodSection ? (
							<div className="mt-6 hidden border-slate-100 border-t pt-5 md:block">
								<FoodSelectionContent
									categories={categories}
									activeCategory={activeCategory}
									foodRequired={foodRequired}
									foodTotal={foodTotal}
									currency={currency}
									paginatedFoodItems={paginatedFoodItems}
									totalFoodItems={activeFoodItems.length}
									foodPageSize={foodPageSize}
									selectedItems={selectedItems}
									updateItem={updateItem}
									onSelectCategory={(categoryId) => {
										setActiveCategoryId(categoryId);
										setFoodPage(1);
									}}
									currentFoodPage={currentFoodPage}
									foodPageCount={foodPageCount}
									onPageChange={setFoodPage}
								/>
							</div>
						) : null}
						<SubmitButton
							disabled={
								!selectedTableId ||
								!selectedTableIsAvailable ||
								(foodRequired && selectedItems.length === 0)
							}
							loadingText="Reserving..."
							successText="Reserved"
							className="mt-5 hidden min-h-14 w-full items-center justify-center gap-3 rounded-full bg-emerald-800 px-5 text-sm font-black text-white shadow-[0_14px_35px_rgba(4,120,87,0.25)] disabled:opacity-50 md:inline-flex"
						>
							<span>Send reservation request</span>
							<ArrowRight className="size-5" aria-hidden="true" />
						</SubmitButton>
					</section>

					{showFoodSection ? (
						<section
							className={cn(
								"rounded-2xl border border-slate-200 bg-white p-4 md:hidden",
							)}
						>
							<FoodSelectionContent
								categories={categories}
								activeCategory={activeCategory}
								foodRequired={foodRequired}
								foodTotal={foodTotal}
								currency={currency}
								paginatedFoodItems={paginatedFoodItems}
								totalFoodItems={activeFoodItems.length}
								foodPageSize={foodPageSize}
								selectedItems={selectedItems}
								updateItem={updateItem}
								onSelectCategory={(categoryId) => {
									setActiveCategoryId(categoryId);
									setFoodPage(1);
								}}
								currentFoodPage={currentFoodPage}
								foodPageCount={foodPageCount}
								onPageChange={setFoodPage}
							/>
						</section>
					) : null}

					{setting.cancellationPolicy ? (
						<p className="rounded-2xl bg-slate-50 p-4 text-xs font-bold leading-5 text-slate-500 md:col-start-1 md:row-start-5 lg:col-start-2 lg:row-start-2">
							{setting.cancellationPolicy}
						</p>
					) : null}
				</div>

				{previewTable ? (
					<TableDetailsModal
						table={previewTable}
						zone={getTableZone(previewTable)}
						currency={currency}
						date={date}
						time={time}
						partySize={partySize}
						holdDurationMinutes={setting.holdDurationMinutes}
						selected={
							selectedTableId === previewTable.id &&
							isTableAvailable(previewTable, date, time) &&
							partySize <= previewTable.capacity
						}
						onClose={() => setPreviewTableId(null)}
						onSelect={() => selectTable(previewTable.id)}
					/>
				) : null}

				<div className="fixed inset-x-0 bottom-0 z-40 border-slate-100 border-t bg-white/95 px-5 pb-6 pt-4 shadow-[0_-16px_30px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
					<div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
						<div className="grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3">
							<TableVisualIcon
								table={selectedTable}
								zone={selectedTable ? getTableZone(selectedTable) : "INDOOR"}
								selected
								className="size-12"
							/>
							<div className="min-w-0">
								<p className="truncate text-sm font-black text-slate-950">
									{selectedTable?.label ?? "Select a table"}
								</p>
								<p className="mt-1 truncate text-xs font-semibold text-slate-500">
									Min. Spend{" "}
									<span className="font-black">
										{formatMoney(tableFee, currency)}
									</span>
								</p>
							</div>
						</div>
						<SubmitButton
							disabled={
								!selectedTableId ||
								!selectedTableIsAvailable ||
								(foodRequired && selectedItems.length === 0)
							}
							loadingText="Reserving..."
							successText="Reserved"
							className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-xs font-black text-white shadow-[0_14px_35px_rgba(4,120,87,0.25)] disabled:opacity-50 sm:text-sm"
						>
							<span>Continue</span>
							<ArrowRight className="size-5" aria-hidden="true" />
						</SubmitButton>
					</div>
				</div>
			</ActionForm>
		</main>
	);
}

function DateTimeField({
	htmlFor,
	icon,
	label,
	displayValue,
	children,
}: {
	htmlFor: string;
	icon: React.ReactNode;
	label: string;
	displayValue: string;
	children: React.ReactNode;
}) {
	return (
		<label
			htmlFor={htmlFor}
			className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-emerald-950"
		>
			<span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
				{icon}
			</span>
			<span className="min-w-0">
				<span className="block text-xs font-black text-slate-500">{label}</span>
				<span className="mt-1 block truncate text-sm font-black text-slate-950">
					{displayValue}
				</span>
			</span>
			{children}
		</label>
	);
}

function DesktopReservationHeader({
	restaurantName,
	restaurantSlug,
	logoUrl,
	phone,
	whatsappNumber,
}: {
	restaurantName: string;
	restaurantSlug: string;
	logoUrl: string | null;
	phone: string | null;
	whatsappNumber: string | null;
}) {
	return (
		<header className="fixed inset-x-0 top-0 z-50 hidden border-slate-200 border-b bg-white/95 px-6 py-5 backdrop-blur md:block">
			<div className="mx-auto flex max-w-472 items-center justify-between gap-6">
				<div className="flex min-w-0 items-center gap-5">
					<div className="flex min-w-0 items-center gap-3">
						<HeaderLogo name={restaurantName} logoUrl={logoUrl} />
						<div className="min-w-0">
							<h1 className="truncate text-2xl font-black text-emerald-950">
								{restaurantName}
							</h1>
							<p className="mt-1 flex items-center gap-2 text-sm font-semibold text-emerald-800">
								<span className="size-2.5 rounded-full bg-emerald-500" />
								Open now
							</p>
						</div>
					</div>
					<span className="h-10 w-px bg-slate-200" />
					<Link
						href={`/${restaurantSlug}`}
						className="inline-flex items-center gap-2 text-sm font-black text-slate-700 transition-colors hover:text-emerald-800"
					>
						<ArrowLeft className="size-5" aria-hidden="true" />
						Back to Main Menu
					</Link>
				</div>

				<div className="flex shrink-0 items-center gap-5">
					{phone ? (
						<a
							href={`tel:${phone}`}
							className="hidden items-center gap-3 text-sm font-semibold text-slate-600 lg:flex"
						>
							<Phone className="size-5 text-emerald-900" aria-hidden="true" />
							<span>
								<span className="block font-black text-emerald-950">
									Call Us
								</span>
								<span>{phone}</span>
							</span>
						</a>
					) : null}
					{whatsappNumber ? (
						<a
							href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
							className="hidden items-center gap-3 text-sm font-semibold text-slate-600 xl:flex"
						>
							<MessageSquare
								className="size-5 text-emerald-900"
								aria-hidden="true"
							/>
							<span>
								<span className="block font-black text-emerald-950">
									Contact
								</span>
								<span>Send a message</span>
							</span>
						</a>
					) : null}
					<CustomerAccountDrawer restaurantSlug={restaurantSlug} />
				</div>
			</div>
		</header>
	);
}

function HeaderLogo({
	name,
	logoUrl,
}: {
	name: string;
	logoUrl: string | null;
}) {
	if (logoUrl) {
		return (
			<Image
				src={logoUrl}
				alt={`${name} logo`}
				width={64}
				height={64}
				className="size-14 rounded-full object-cover"
				unoptimized
			/>
		);
	}

	return (
		<div className="grid size-14 place-items-center rounded-full bg-emerald-800 text-xl font-black text-white">
			{name.charAt(0).toUpperCase()}
		</div>
	);
}

function FilterIcon({ filter }: { filter: TableFilter }) {
	if (filter === "INDOOR")
		return <Home className="size-4" aria-hidden="true" />;
	if (filter === "OUTDOOR")
		return <Clock className="size-4" aria-hidden="true" />;
	if (filter === "VIP") return <Crown className="size-4" aria-hidden="true" />;
	return <Grid2X2 className="size-4" aria-hidden="true" />;
}

function FoodSelectionContent({
	categories,
	activeCategory,
	foodRequired,
	foodTotal,
	currency,
	paginatedFoodItems,
	totalFoodItems,
	foodPageSize,
	selectedItems,
	updateItem,
	onSelectCategory,
	currentFoodPage,
	foodPageCount,
	onPageChange,
}: {
	categories: MenuCategory[];
	activeCategory: MenuCategory | undefined;
	foodRequired: boolean;
	foodTotal: number;
	currency: string;
	paginatedFoodItems: MenuItem[];
	totalFoodItems: number;
	foodPageSize: number;
	selectedItems: SelectedFoodItem[];
	updateItem: (itemId: string, nextQuantity: number) => void;
	onSelectCategory: (categoryId: string) => void;
	currentFoodPage: number;
	foodPageCount: number;
	onPageChange: (page: number) => void;
}) {
	return (
		<>
			<div className="flex items-start justify-between gap-3">
				<div>
					<h3 className="text-sm font-black text-slate-950 md:text-xl">
						Food for the table
					</h3>
					<p className="mt-1 text-xs font-semibold text-slate-500 md:text-sm">
						{foodRequired
							? "This reservation requires a meal or drink selection."
							: "Add items you want ready for the table."}
					</p>
				</div>
				<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
					{formatMoney(foodTotal, currency)}
				</span>
			</div>

			<div className="mt-4 flex gap-2 overflow-x-auto pb-1">
				{categories.map((category) => (
					<button
						key={category.id}
						type="button"
						onClick={() => onSelectCategory(category.id)}
						className={cn(
							"h-10 shrink-0 rounded-full border px-4 text-xs font-semibold transition-colors sm:text-sm",
							activeCategory?.id === category.id
								? "border-emerald-950 bg-emerald-950 text-white"
								: "border-slate-200 bg-white text-slate-600",
						)}
					>
						{category.name}
					</button>
				))}
			</div>

			{activeCategory ? (
				<div className="mt-4">
					<div className="grid gap-3">
						{paginatedFoodItems.map((item) => {
							const selectedItem = selectedItems.find(
								(entry) => entry.id === item.id,
							);
							const quantity = selectedItem?.quantity ?? 0;

							return (
								<article
									key={item.id}
									className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-2xl border border-slate-200 bg-white p-3"
								>
									<div className="relative h-20 overflow-hidden rounded-2xl bg-emerald-50">
										{item.imageUrl ? (
											<Image
												src={item.imageUrl}
												alt={item.name}
												fill
												className="object-cover"
												sizes="80px"
												unoptimized
											/>
										) : (
											<div className="grid h-full place-items-center">
												<Utensils className="size-7 text-emerald-700" />
											</div>
										)}
									</div>
									<div className="min-w-0">
										<p className="truncate text-sm font-black text-slate-950">
											{item.name}
										</p>
										{item.description ? (
											<p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">
												{item.description}
											</p>
										) : null}
										<p className="mt-1 text-xs font-semibold text-emerald-800 sm:text-sm">
											{formatMoney(item.price, currency)}
										</p>
										<div className="mt-2 inline-flex items-center rounded-xl border border-slate-200">
											<button
												type="button"
												onClick={() => updateItem(item.id, quantity - 1)}
												className="grid size-8 place-items-center text-emerald-800"
												aria-label={`Remove ${item.name}`}
											>
												<Minus className="size-4" />
											</button>
											<span className="min-w-8 text-center text-sm font-semibold">
												{quantity}
											</span>
											<button
												type="button"
												onClick={() => updateItem(item.id, quantity + 1)}
												className="grid size-8 place-items-center text-emerald-800"
												aria-label={`Add ${item.name}`}
											>
												<Plus className="size-4" />
											</button>
										</div>
									</div>
								</article>
							);
						})}
					</div>
					<FoodPagination
						currentPage={currentFoodPage}
						pageCount={foodPageCount}
						totalItems={totalFoodItems}
						pageSize={foodPageSize}
						onPageChange={onPageChange}
					/>
				</div>
			) : null}
		</>
	);
}

function FoodPagination({
	currentPage,
	pageCount,
	totalItems,
	pageSize,
	onPageChange,
}: {
	currentPage: number;
	pageCount: number;
	totalItems: number;
	pageSize: number;
	onPageChange: (page: number) => void;
}) {
	if (pageCount <= 1) return null;

	const firstItem = (currentPage - 1) * pageSize + 1;
	const lastItem = Math.min(currentPage * pageSize, totalItems);
	const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

	return (
		<div className="mt-4 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 md:bg-white">
			<div className="flex items-center justify-between gap-3">
				<p className="text-xs font-bold text-slate-500">
					Showing {firstItem} to {lastItem} of {totalItems} items
				</p>
				<span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600 md:hidden">
					{currentPage} / {pageCount}
				</span>
			</div>
			<div className="flex items-center justify-between gap-2">
				<button
					type="button"
					disabled={currentPage <= 1}
					onClick={() => onPageChange(Math.max(1, currentPage - 1))}
					className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-40 sm:text-sm"
					aria-label="Previous food page"
				>
					<ChevronLeft className="size-4" aria-hidden="true" />
					Previous
				</button>
				<div className="hidden items-center gap-2 md:flex">
					{pages.map((page) => (
						<button
							key={page}
							type="button"
							onClick={() => onPageChange(page)}
							className={cn(
								"grid size-10 place-items-center rounded-xl border text-sm font-black",
								page === currentPage
									? "border-emerald-800 bg-emerald-800 text-white"
									: "border-slate-200 bg-white text-slate-700",
							)}
							aria-current={page === currentPage ? "page" : undefined}
						>
							{page}
						</button>
					))}
				</div>
				<button
					type="button"
					disabled={currentPage >= pageCount}
					onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
					className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 disabled:opacity-40 sm:text-sm"
					aria-label="Next food page"
				>
					Next
					<ChevronRight className="size-4" aria-hidden="true" />
				</button>
			</div>
		</div>
	);
}

function DesktopSelectionPanel({
	step,
	onContinue,
	selectedTable,
	currency,
	date,
	time,
	partySize,
	tableFee,
	selectedTableIsAvailable,
}: {
	step: DesktopStep;
	onContinue: () => void;
	selectedTable: ReservationTable | undefined;
	currency: string;
	date: string;
	time: string;
	partySize: number;
	tableFee: number;
	selectedTableIsAvailable: boolean;
}) {
	const zone = selectedTable ? getTableZone(selectedTable) : "INDOOR";

	if (step === "details") {
		return null;
	}

	return (
		<aside className="hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] md:col-start-2 md:row-start-1 md:block md:max-h-[calc(100vh-8rem)] md:overflow-y-auto lg:fixed lg:top-28 lg:right-[max(1.5rem,calc((100vw-118rem)/2+1.5rem))] lg:bottom-8 lg:z-40 lg:w-116 lg:max-h-none lg:col-start-3">
			<div className="flex items-start gap-3">
				<span className="grid size-8 shrink-0 place-items-center rounded-full bg-emerald-800 text-sm font-black text-white">
					3
				</span>
				<div>
					<h3 className="text-lg font-black text-slate-950">Your Selection</h3>
					<p className="mt-1 text-sm font-semibold text-slate-500">
						Review your booking details
					</p>
				</div>
			</div>

			<div className="mt-5 rounded-2xl border border-slate-200 p-3">
				<div className="grid grid-cols-[5.75rem_minmax(0,1fr)_auto] items-center gap-3">
					<TableVisualIcon
						table={selectedTable}
						zone={zone}
						selected={selectedTableIsAvailable}
						className="h-16 w-24"
					/>
					<div className="min-w-0">
						<p className="truncate text-base font-black text-slate-950">
							{selectedTable?.label ?? "Select a table"}
						</p>
						<p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
							<span>{selectedTable?.capacity ?? 0} Seats</span>
							<span>•</span>
							<span>{selectedTable ? zoneLabel(zone) : "Location"}</span>
						</p>
					</div>
					<span
						className={cn(
							"rounded-full px-3 py-1 text-xs font-black",
							selectedTableIsAvailable
								? "bg-emerald-50 text-emerald-700"
								: "bg-yellow-50 text-yellow-700",
						)}
					>
						{selectedTableIsAvailable ? "Available" : "Review"}
					</span>
				</div>
			</div>

			{selectedTable ? (
				<div className="mt-4 rounded-2xl border border-slate-200 p-4">
					<h4 className="text-base font-black text-slate-950">Table details</h4>
					{selectedTable.description ? (
						<p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
							{selectedTable.description}
						</p>
					) : (
						<p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
							No extra description added for this table.
						</p>
					)}
					<div className="mt-4 grid gap-2 text-sm font-semibold text-slate-600">
						<div className="flex justify-between gap-3">
							<span>Booking</span>
							<span className="text-right font-black text-slate-950">
								{formatBookingMode(selectedTable.policy)}
							</span>
						</div>
						<div className="flex justify-between gap-3">
							<span>Payment</span>
							<span className="text-right font-black text-slate-950">
								{formatPaymentTiming(selectedTable.policy)}
							</span>
						</div>
						<div className="flex justify-between gap-3">
							<span>Includes</span>
							<span className="text-right font-black text-slate-950">
								{formatInclusion(selectedTable.policy)}
							</span>
						</div>
					</div>
				</div>
			) : null}

			<div className="mt-4 rounded-2xl border border-slate-200 p-4">
				<div className="flex items-center justify-between gap-3">
					<h4 className="text-base font-black text-slate-950">
						Reservation Summary
					</h4>
					<span className="text-sm font-black text-emerald-800">Edit</span>
				</div>
				<div className="mt-4 grid gap-3 text-sm font-bold text-slate-600">
					<SummaryRow
						icon={<CalendarDays className="size-4" aria-hidden="true" />}
						label="Date"
						value={formatDateLabel(date)}
					/>
					<SummaryRow
						icon={<Clock className="size-4" aria-hidden="true" />}
						label="Time"
						value={formatTimeLabel(time)}
					/>
					<SummaryRow
						icon={<Users className="size-4" aria-hidden="true" />}
						label="Guests"
						value={`${partySize} Guest${partySize === 1 ? "" : "s"}`}
					/>
				</div>
			</div>

			<div className="mt-4 rounded-2xl border border-slate-200 p-4">
				<div className="flex items-center justify-between gap-3">
					<p className="text-base font-black text-slate-950">Minimum Spend</p>
					<p className="text-base font-black text-slate-950">
						{formatMoney(tableFee, currency)}
					</p>
				</div>
				<p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
					Food and beverages only. Admin confirms the table before payment.
				</p>
			</div>

			<div className="mt-4 grid grid-cols-[2.25rem_minmax(0,1fr)] gap-3 rounded-2xl bg-emerald-50/80 p-4 text-sm font-semibold leading-6 text-emerald-950">
				<span className="grid size-9 place-items-center rounded-xl bg-white text-emerald-800">
					<ShieldCheck className="size-5" aria-hidden="true" />
				</span>
				<p>
					<span className="block font-black">Good to know</span>
					<span className="text-slate-600">
						Payment appears after admin approves the table.
					</span>
				</p>
			</div>

			<button
				type="button"
				onClick={onContinue}
				disabled={!selectedTable?.id || !selectedTableIsAvailable}
				className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-full bg-emerald-800 px-5 text-sm font-black text-white shadow-[0_14px_35px_rgba(4,120,87,0.25)] disabled:opacity-50"
			>
				<span>Continue to Details</span>
				<ArrowRight className="size-5" aria-hidden="true" />
			</button>
			<p className="mt-3 flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
				<LockKeyhole className="size-4" aria-hidden="true" />
				Your information is secure and encrypted
			</p>
		</aside>
	);
}

function SummaryRow({
	icon,
	label,
	value,
}: {
	icon: React.ReactNode;
	label: string;
	value: string;
}) {
	return (
		<div className="grid grid-cols-[1.5rem_5rem_minmax(0,1fr)] items-center gap-2 border-slate-100 border-b pb-3 last:border-b-0 last:pb-0">
			<span className="text-slate-500">{icon}</span>
			<span>{label}</span>
			<span className="truncate text-right font-black text-slate-950">
				{value}
			</span>
		</div>
	);
}

function TablePagination({
	currentPage,
	pageCount,
	totalItems,
	pageSize,
	onPageChange,
}: {
	currentPage: number;
	pageCount: number;
	totalItems: number;
	pageSize: number;
	onPageChange: (page: number) => void;
}) {
	if (pageCount <= 1) return null;

	const firstItem = (currentPage - 1) * pageSize + 1;
	const lastItem = Math.min(currentPage * pageSize, totalItems);
	const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

	return (
		<div className="mt-5 flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 md:flex-row md:items-center md:justify-between md:border-0 md:bg-transparent md:p-0">
			<p className="text-center text-xs font-bold text-slate-500 md:text-left">
				Showing {firstItem} to {lastItem} of {totalItems} tables
			</p>
			<div className="flex items-center justify-center gap-2">
				<button
					type="button"
					disabled={currentPage <= 1}
					onClick={() => onPageChange(Math.max(1, currentPage - 1))}
					className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
					aria-label="Previous tables page"
				>
					<ChevronLeft className="size-4" aria-hidden="true" />
				</button>
				<div className="hidden items-center gap-2 md:flex">
					{pages.map((page) => (
						<button
							key={page}
							type="button"
							onClick={() => onPageChange(page)}
							className={cn(
								"grid size-10 place-items-center rounded-xl border text-sm font-black",
								page === currentPage
									? "border-emerald-800 bg-emerald-800 text-white"
									: "border-slate-200 bg-white text-slate-700",
							)}
							aria-current={page === currentPage ? "page" : undefined}
						>
							{page}
						</button>
					))}
				</div>
				<span className="min-w-20 text-center text-xs font-black text-slate-700 md:hidden">
					{currentPage} / {pageCount}
				</span>
				<button
					type="button"
					disabled={currentPage >= pageCount}
					onClick={() => onPageChange(Math.min(pageCount, currentPage + 1))}
					className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 disabled:opacity-40"
					aria-label="Next tables page"
				>
					<ChevronRight className="size-4" aria-hidden="true" />
				</button>
			</div>
		</div>
	);
}

function TableCard({
	table,
	zone,
	currency,
	selected,
	selectable,
	unavailableLabel,
	onSelect,
}: {
	table: ReservationTable;
	zone: Exclude<TableFilter, "ALL">;
	currency: string;
	selected: boolean;
	selectable: boolean;
	unavailableLabel: string;
	onSelect: () => void;
}) {
	const tone = tableTone(zone, selected);

	return (
		<button
			type="button"
			onClick={onSelect}
			aria-disabled={!selectable}
			className={cn(
				"grid min-h-24 grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border p-3 text-left transition-colors md:min-h-28 md:grid-cols-[7rem_minmax(0,1fr)_auto] md:p-4",
				tone.border,
				!selectable && "opacity-90",
			)}
		>
			<TableVisualIcon
				table={table}
				zone={zone}
				selected={selected}
				className="md:h-20 md:w-28"
			/>
			<span className="min-w-0">
				<span className="block truncate text-sm font-black text-slate-950 md:text-lg">
					{table.label}
				</span>
				<span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
					<span className="inline-flex items-center gap-1.5">
						<Users className="size-4" aria-hidden="true" />
						{table.capacity} Seats
					</span>
					<span className="inline-flex items-center gap-1.5">
						<MapPin className="size-4" aria-hidden="true" />
						{zoneLabel(zone)}
					</span>
				</span>
				<span className="mt-2 block text-xs font-semibold text-slate-500 md:text-base">
					Min. Spend{" "}
					<span className="font-black text-slate-950">
						{formatMoney(table.policy.tableFee, currency)}
					</span>
				</span>
			</span>
			<span className="grid justify-items-end gap-3">
				<span
					className={cn(
						"rounded-full px-3 py-1 text-xs font-black",
						selected
							? "bg-emerald-700 text-white"
							: selectable
								? "bg-emerald-50 text-emerald-600"
								: unavailableLabel === "Too small"
									? "bg-yellow-50 text-yellow-700"
									: "bg-red-50 text-red-600",
					)}
				>
					{selected ? "Selected" : selectable ? "Available" : unavailableLabel}
				</span>
				<span
					className={cn(
						"hidden size-8 place-items-center rounded-full border md:grid",
						selected
							? "border-emerald-800 bg-emerald-800 text-white"
							: "border-slate-300 bg-white text-transparent",
					)}
				>
					<Check className="size-5" aria-hidden="true" />
				</span>
				<ChevronRight
					className="size-6 text-emerald-950 md:hidden"
					aria-hidden="true"
				/>
			</span>
		</button>
	);
}

function TableDetailsModal({
	table,
	zone,
	currency,
	date,
	time,
	partySize,
	holdDurationMinutes,
	selected,
	onClose,
	onSelect,
}: {
	table: ReservationTable;
	zone: Exclude<TableFilter, "ALL">;
	currency: string;
	date: string;
	time: string;
	partySize: number;
	holdDurationMinutes: number;
	selected: boolean;
	onClose: () => void;
	onSelect: () => void;
}) {
	const available = isTableAvailable(table, date, time);
	const fitsParty = partySize <= table.capacity;
	const selectable = available && fitsParty;
	const unavailableText = !available
		? "This table is already reserved for the selected time."
		: !fitsParty
			? `This table only seats ${table.capacity} guest${table.capacity === 1 ? "" : "s"}.`
			: "";

	return (
		<div className="fixed inset-0 z-70 grid place-items-end bg-slate-950/50 px-4 pb-4 pt-10 backdrop-blur-sm md:place-items-center">
			<button
				type="button"
				className="absolute inset-0 cursor-default"
				aria-label="Close table details"
				onClick={onClose}
			/>
			<section className="relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl">
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 items-start gap-3">
						<TableVisualIcon
							table={table}
							zone={zone}
							selected={selectable}
							className="size-14"
						/>
						<div className="min-w-0">
							<p className="truncate text-sm font-black text-slate-950 sm:text-xl">
								{table.label}
							</p>
							<p className="mt-1 text-xs font-bold text-slate-500 sm:text-sm">
								{zoneLabel(zone)}
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500"
						aria-label="Close"
					>
						<X className="size-4" aria-hidden="true" />
					</button>
				</div>

				<div className="mt-4 flex flex-wrap gap-2">
					<span
						className={cn(
							"rounded-full px-3 py-1 text-xs font-black",
							selectable
								? "bg-emerald-50 text-emerald-700"
								: "bg-red-50 text-red-700",
						)}
					>
						{selectable ? "Available" : "Unavailable"}
					</span>
					<span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">
						{table.capacity} Seats
					</span>
					<span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">
						{formatBookingMode(table.policy)}
					</span>
				</div>

				{table.description ? (
					<p className="mt-4 text-xs font-semibold leading-6 text-slate-600 sm:text-sm">
						{table.description}
					</p>
				) : null}

				<div className="mt-4 grid grid-cols-2 gap-3">
					<DetailTile label="Date" value={formatDateLabel(date)} />
					<DetailTile label="Time" value={formatTimeLabel(time)} />
					<DetailTile label="Guests" value={`${partySize}`} />
					<DetailTile label="Location" value={zoneLabel(zone)} />
					<DetailTile
						label="Min. spend"
						value={formatMoney(table.policy.tableFee, currency)}
					/>
					<DetailTile label="Hold time" value={`${holdDurationMinutes} min`} />
				</div>

				<div className="mt-4 rounded-2xl bg-slate-50 p-4">
					<p className="text-sm font-black text-slate-950">
						Reservation policy
					</p>
					<div className="mt-3 grid gap-2 text-sm font-semibold text-slate-600">
						<div className="flex justify-between gap-3">
							<span>Booking</span>
							<span className="text-right text-slate-950">
								{formatBookingMode(table.policy)}
							</span>
						</div>
						<div className="flex justify-between gap-3">
							<span>Payment</span>
							<span className="text-right text-slate-950">
								{formatPaymentTiming(table.policy)}
							</span>
						</div>
						<div className="flex justify-between gap-3">
							<span>Includes</span>
							<span className="text-right text-slate-950">
								{formatInclusion(table.policy)}
							</span>
						</div>
					</div>
				</div>

				{unavailableText ? (
					<p className="mt-4 rounded-2xl bg-red-50 p-3 text-xs font-black text-red-700">
						{unavailableText}
					</p>
				) : null}

				<div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-3">
					<button
						type="button"
						onClick={onClose}
						className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 sm:text-sm"
					>
						Close
					</button>
					<button
						type="button"
						disabled={!selectable}
						onClick={selected ? onClose : onSelect}
						className="min-h-12 rounded-2xl bg-emerald-700 px-4 text-xs font-black text-white disabled:opacity-50 sm:text-sm"
					>
						{selected ? "Selected" : "Select this table"}
					</button>
				</div>
			</section>
		</div>
	);
}

function DetailTile({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-slate-100 bg-white p-3">
			<p className="text-xs font-black text-slate-500">{label}</p>
			<p className="mt-1 truncate text-sm font-black text-slate-950">{value}</p>
		</div>
	);
}

function TableVisualIcon({
	table,
	zone,
	selected,
	className,
}: {
	table?: Pick<ReservationTable, "label" | "imageUrl"> | null;
	zone: Exclude<TableFilter, "ALL">;
	selected: boolean;
	className?: string;
}) {
	const tone = tableTone(zone, selected);

	if (table?.imageUrl) {
		return (
			<span
				className={cn(
					"relative block size-[4.4rem] shrink-0 overflow-hidden rounded-2xl bg-emerald-50",
					className,
				)}
			>
				<Image
					src={table.imageUrl}
					alt={`${table.label} table`}
					fill
					className="object-cover"
					sizes="80px"
					unoptimized
				/>
			</span>
		);
	}

	return (
		<span
			className={cn(
				"grid size-[4.4rem] shrink-0 place-items-center rounded-2xl",
				tone.icon,
				className,
			)}
		>
			<Armchair className="size-7" strokeWidth={1.9} aria-hidden="true" />
		</span>
	);
}
