"use client";

import {
	CalendarDays,
	Check,
	ChevronLeft,
	ChevronRight,
	CircleHelp,
	Clock,
	Minus,
	Plus,
	Users,
	Utensils,
} from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";
import { createReservationAction } from "@/actions/reservation.actions";
import { SubmitButton } from "@/components/ui/action-button";
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
	currency: string;
	setting: ReservationSetting;
	tables: ReservationTable[];
	categories: MenuCategory[];
};

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

function formatPolicyLabel(policy: TablePolicy) {
	if (policy.bookingMode === "FREE_BOOKING") return "Free booking";
	if (policy.bookingMode === "ORDER_REQUIRED") return "Food pre-order required";
	if (policy.bookingMode === "DEPOSIT_REQUIRED") return "Deposit required";
	return "Full payment required";
}

function getMinimumDateTime(advanceBookingHours: number) {
	const date = new Date(Date.now() + advanceBookingHours * 60 * 60 * 1000);
	if (date.getSeconds() > 0 || date.getMilliseconds() > 0) {
		date.setMinutes(date.getMinutes() + 1);
	}
	date.setSeconds(0, 0);
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	const hh = String(date.getHours()).padStart(2, "0");
	const min = String(date.getMinutes()).padStart(2, "0");
	return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
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

function chargesNow(policy?: TablePolicy) {
	return policy?.paymentTiming === "PAY_ON_BOOKING";
}

function shouldChargeTableFee(policy?: TablePolicy) {
	if (!policy) return false;
	return (
		(policy.bookingMode === "DEPOSIT_REQUIRED" ||
			policy.bookingMode === "FULL_PAYMENT") &&
		(policy.inclusionType === "TABLE_FEE_ONLY" ||
			policy.inclusionType === "FOOD_AND_TABLE_FEE")
	);
}

function HelpNote({ label, text }: { label: string; text: string }) {
	return (
		<details className="inline-block">
			<summary className="list-none text-slate-400 transition-colors hover:text-emerald-700">
				<CircleHelp className="size-4" aria-hidden="true" />
				<span className="sr-only">Show help for {label}</span>
			</summary>
			<span className="mt-2 block max-w-sm rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold leading-5 text-emerald-950">
				{text}
			</span>
		</details>
	);
}

export function TableReservationFlow({
	restaurantName,
	restaurantSlug,
	logoUrl,
	currency,
	setting,
	tables,
	categories,
}: TableReservationFlowProps) {
	const minimumDateTime = getMinimumDateTime(setting.advanceBookingHours);
	const [date, setDate] = useState(minimumDateTime.date);
	const [time, setTime] = useState(minimumDateTime.time);
	const [partySize, setPartySize] = useState(setting.minPartySize);
	const [selectedTableId, setSelectedTableId] = useState(tables[0]?.id ?? "");
	const [selectedItems, setSelectedItems] = useState<SelectedFoodItem[]>([]);
	const [tablePage, setTablePage] = useState(1);
	const [activeCategoryId, setActiveCategoryId] = useState(
		categories[0]?.id ?? "",
	);
	const [foodPage, setFoodPage] = useState(1);
	const selectedTable = tables.find((table) => table.id === selectedTableId);
	const tablePageSize = 3;
	const tablePageCount = Math.max(1, Math.ceil(tables.length / tablePageSize));
	const currentTablePage = Math.min(tablePage, tablePageCount);
	const paginatedTables = tables.slice(
		(currentTablePage - 1) * tablePageSize,
		currentTablePage * tablePageSize,
	);
	const availableTableCount = tables.filter(
		(table) =>
			isTableAvailable(table, date, time) && partySize <= table.capacity,
	).length;
	const activeCategory =
		categories.find((category) => category.id === activeCategoryId) ??
		categories[0];
	const foodPageSize = 6;
	const activeFoodItems = activeCategory?.items ?? [];
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
	const foodTotal = selectedItems.reduce((total, selectedItem) => {
		const menuItem = flatMenuItems.find((item) => item.id === selectedItem.id);
		return total + (menuItem?.price ?? 0) * selectedItem.quantity;
	}, 0);
	const tableFee = selectedTable?.policy.tableFee ?? 0;
	const dueNow =
		chargesNow(selectedTable?.policy) && selectedTable
			? (selectedTable.policy.bookingMode === "ORDER_REQUIRED" &&
				selectedTable.policy.inclusionType === "FOOD_ONLY"
					? foodTotal
					: 0) +
				(shouldChargeTableFee(selectedTable.policy) ? tableFee : 0) +
				(shouldChargeTableFee(selectedTable.policy) &&
				selectedTable.policy.inclusionType === "FOOD_AND_TABLE_FEE"
					? foodTotal
					: 0)
			: 0;
	const selectedItemsJson = JSON.stringify(selectedItems);
	const foodRequired = requiresFood(selectedTable?.policy);

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

	return (
		<main className="min-h-screen bg-[#f6faf7] pb-24 text-slate-950 md:pb-8">
			<div className="mx-auto grid max-w-7xl gap-5 px-4 py-4 md:px-6 md:py-6">
				<header className="grid gap-4 rounded-2xl bg-emerald-950 p-5 text-white md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:p-7">
					{logoUrl ? (
						<Image
							src={logoUrl}
							alt={`${restaurantName} logo`}
							width={72}
							height={72}
							className="size-16 rounded-2xl object-cover"
							unoptimized
						/>
					) : (
						<div className="grid size-16 place-items-center rounded-2xl bg-yellow-300 text-2xl font-black text-emerald-950">
							{restaurantName.charAt(0).toUpperCase()}
						</div>
					)}
					<div>
						<p className="text-sm font-bold text-yellow-200">
							Table reservation
						</p>
						<h1 className="mt-1 text-3xl font-black md:text-4xl">
							Reserve a table at {restaurantName}
						</h1>
						<p className="mt-2 max-w-2xl text-sm font-medium text-white/80 md:text-base">
							{setting.bookingDescription ??
								"Choose your table, arrival time, party size, and the food you want waiting on the table."}
						</p>
					</div>
				</header>

				<form
					action={createReservationAction}
					className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem]"
				>
					<input type="hidden" name="slug" value={restaurantSlug} />
					<input type="hidden" name="tableId" value={selectedTableId} />
					<input type="hidden" name="items" value={selectedItemsJson} />

					<div className="grid gap-5">
						<section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
							<div className="grid gap-3 md:grid-cols-3">
								<label className="grid gap-2">
									<span className="text-sm font-black text-slate-700">
										Date
									</span>
									<span className="relative">
										<CalendarDays className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-slate-400" />
										<input
											type="date"
											name="date"
											value={date}
											min={minimumDateTime.date}
											onChange={(event) => setDate(event.target.value)}
											required
											className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-10 text-base font-semibold outline-none focus:border-emerald-700"
										/>
									</span>
								</label>
								<label className="grid gap-2">
									<span className="text-sm font-black text-slate-700">
										Time
									</span>
									<span className="relative">
										<Clock className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-slate-400" />
										<input
											type="time"
											name="time"
											value={time}
											onChange={(event) => setTime(event.target.value)}
											required
											className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-10 text-base font-semibold outline-none focus:border-emerald-700"
										/>
									</span>
								</label>
								<label className="grid gap-2">
									<span className="text-sm font-black text-slate-700">
										Guests
									</span>
									<span className="relative">
										<Users className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-slate-400" />
										<input
											type="number"
											name="partySize"
											value={partySize}
											min={setting.minPartySize}
											max={
												setting.maxPartySize > 0
													? setting.maxPartySize
													: undefined
											}
											onChange={(event) =>
												setPartySize(Number(event.target.value))
											}
											required
											className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-10 text-base font-semibold outline-none focus:border-emerald-700"
										/>
									</span>
								</label>
							</div>
						</section>

						<section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
							<div className="flex items-center justify-between gap-3">
								<div>
									<div className="flex items-center gap-2">
										<h2 className="text-xl font-semibold">Choose a table</h2>
										<HelpNote
											label="choosing a table"
											text="Pick the table that matches your party size. Tables marked reserved are blocked for the selected date and time."
										/>
									</div>
									<p className="mt-1 text-sm font-semibold text-slate-500">
										Tables are checked against active reservations for your
										selected time.
									</p>
								</div>
								<div className="hidden flex-col items-end gap-2 md:flex">
									<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
										{availableTableCount} of {tables.length} available
									</span>
									<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
										{setting.holdDurationMinutes} min hold
									</span>
								</div>
							</div>
							<div className="mt-4 flex items-center justify-between gap-2 md:hidden">
								<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
									{availableTableCount} of {tables.length} available
								</span>
								<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
									{setting.holdDurationMinutes} min hold
								</span>
							</div>
							<div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
								<button
									type="button"
									disabled={currentTablePage <= 1}
									onClick={() =>
										setTablePage((current) => Math.max(1, current - 1))
									}
									className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm disabled:opacity-35"
									aria-label="Previous tables"
								>
									<ChevronLeft className="size-5" aria-hidden="true" />
								</button>
								<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
									{paginatedTables.map((table) => {
										const available = isTableAvailable(table, date, time);
										const fitsParty = partySize <= table.capacity;
										const selectable = available && fitsParty;
										const selected = selectedTableId === table.id;

										return (
											<button
												key={table.id}
												type="button"
												disabled={!selectable}
												onClick={() => setSelectedTableId(table.id)}
												className={cn(
													"grid min-h-36 gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition-colors disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
													selected && "border-emerald-700 bg-emerald-50",
												)}
											>
												<div className="flex items-start justify-between gap-3">
													<div>
														<p className="text-lg font-semibold text-slate-950">
															{table.label}
														</p>
														<p className="mt-1 text-sm font-semibold text-slate-500">
															Seats {table.capacity}
														</p>
													</div>
													{selected ? (
														<span className="grid size-7 place-items-center rounded-full bg-emerald-700 text-white">
															<Check className="size-4" />
														</span>
													) : null}
												</div>
												{table.description ? (
													<p className="line-clamp-2 text-sm font-medium text-slate-600">
														{table.description}
													</p>
												) : null}
												<div className="mt-auto flex flex-wrap gap-2">
													<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
														{formatPolicyLabel(table.policy)}
													</span>
													{table.policy.tableFee > 0 ? (
														<span className="rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-800">
															{formatMoney(table.policy.tableFee, currency)}
														</span>
													) : null}
													{!available ? (
														<span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
															Reserved
														</span>
													) : null}
													{available && !fitsParty ? (
														<span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
															Too small
														</span>
													) : null}
												</div>
											</button>
										);
									})}
								</div>
								<button
									type="button"
									disabled={currentTablePage >= tablePageCount}
									onClick={() =>
										setTablePage((current) =>
											Math.min(tablePageCount, current + 1),
										)
									}
									className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm disabled:opacity-35"
									aria-label="Next tables"
								>
									<ChevronRight className="size-5" aria-hidden="true" />
								</button>
							</div>
							{tables.length > tablePageSize ? (
								<div className="mt-4 flex flex-wrap items-center justify-center gap-3">
									<div className="flex items-center gap-2">
										{Array.from({ length: tablePageCount }, (_, index) => {
											const page = index + 1;

											return (
												<button
													key={page}
													type="button"
													onClick={() => setTablePage(page)}
													aria-label={`Go to table page ${page}`}
													className={cn(
														"size-2.5 rounded-full bg-slate-300 transition-colors",
														currentTablePage === page && "bg-emerald-700",
													)}
												/>
											);
										})}
									</div>
								</div>
							) : null}
						</section>

						<section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
							<div className="flex items-center gap-2">
								<h2 className="text-xl font-semibold">Your details</h2>
								<HelpNote
									label="reservation contact details"
									text="Enter the guest name and a reachable phone number. The restaurant uses these details to confirm the booking and send your reservation code."
								/>
							</div>
							<div className="mt-4 grid gap-3 md:grid-cols-2">
								<label className="grid gap-2">
									<span className="text-sm font-semibold text-slate-700">
										Full name
									</span>
									<input
										name="customerName"
										required
										className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-emerald-700"
									/>
								</label>
								<label className="grid gap-2">
									<span className="text-sm font-semibold text-slate-700">
										Phone number
									</span>
									<input
										name="customerPhone"
										required
										className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-emerald-700"
									/>
								</label>
								<label className="grid gap-2">
									<span className="text-sm font-semibold text-slate-700">
										Email address
									</span>
									<input
										name="customerEmail"
										type="email"
										className="min-h-12 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-emerald-700"
									/>
								</label>
								<label className="grid gap-2">
									<span className="text-sm font-semibold text-slate-700">
										Special requests
									</span>
									<textarea
										name="specialRequests"
										rows={4}
										placeholder="Birthday setup, allergies, seating preference..."
										className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold outline-none focus:border-emerald-700"
									/>
								</label>
							</div>
						</section>

						<section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
							<div className="flex items-center justify-between gap-3">
								<div>
									<div className="flex items-center gap-2">
										<h2 className="text-xl font-semibold">
											Food for the table
										</h2>
										<HelpNote
											label="food pre-order"
											text="Add food you want prepared for the reserved table. If the selected table requires food, you must choose at least one item before reserving."
										/>
									</div>
									<p className="mt-1 text-sm font-semibold text-slate-500">
										{foodRequired
											? "This reservation requires a food pre-order."
											: "Optional. Add items you want ready for the table."}
									</p>
								</div>
								<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-800">
									{formatMoney(foodTotal, currency)}
								</span>
							</div>
							<div className="mt-4 grid gap-4">
								<div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
									{categories.map((category) => (
										<button
											key={category.id}
											type="button"
											onClick={() => {
												setActiveCategoryId(category.id);
												setFoodPage(1);
											}}
											className={cn(
												"min-h-10 shrink-0 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors",
												activeCategory?.id === category.id &&
													"border-emerald-700 bg-emerald-700 text-white",
											)}
										>
											{category.name}
										</button>
									))}
								</div>

								{activeCategory ? (
									<div>
										<div className="flex flex-wrap items-center justify-between gap-2">
											<h3 className="text-sm font-semibold text-slate-900">
												{activeCategory.name}
											</h3>
											<p className="text-xs font-semibold text-slate-500">
												Page {currentFoodPage} of {foodPageCount}
											</p>
										</div>
										<div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
											{paginatedFoodItems.map((item) => {
												const selectedItem = selectedItems.find(
													(entry) => entry.id === item.id,
												);
												const quantity = selectedItem?.quantity ?? 0;

												return (
													<article
														key={item.id}
														className="overflow-hidden rounded-xl border border-slate-200 bg-white"
													>
														<div className="relative h-28 bg-emerald-50">
															{item.imageUrl ? (
																<Image
																	src={item.imageUrl}
																	alt={item.name}
																	fill
																	className="object-cover"
																	sizes="220px"
																	unoptimized
																/>
															) : (
																<div className="grid h-full place-items-center">
																	<Utensils className="size-8 text-emerald-700" />
																</div>
															)}
														</div>
														<div className="grid gap-2 p-3">
															<div>
																<p className="line-clamp-1 text-sm font-semibold">
																	{item.name}
																</p>
																<p className="mt-1 line-clamp-2 min-h-8 text-xs font-medium text-slate-500">
																	{item.description ?? "Freshly prepared"}
																</p>
															</div>
															<div className="flex items-center justify-between gap-2">
																<p className="text-sm font-semibold text-emerald-800">
																	{formatMoney(item.price, currency)}
																</p>
																<div className="inline-flex items-center rounded-lg border border-slate-200">
																	<button
																		type="button"
																		onClick={() =>
																			updateItem(item.id, quantity - 1)
																		}
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
																		onClick={() =>
																			updateItem(item.id, quantity + 1)
																		}
																		className="grid size-8 place-items-center text-emerald-800"
																		aria-label={`Add ${item.name}`}
																	>
																		<Plus className="size-4" />
																	</button>
																</div>
															</div>
														</div>
													</article>
												);
											})}
										</div>
										<div className="mt-4 flex items-center justify-between gap-3">
											<button
												type="button"
												disabled={currentFoodPage <= 1}
												onClick={() =>
													setFoodPage((current) => Math.max(1, current - 1))
												}
												className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:opacity-40"
											>
												<ChevronLeft className="size-4" aria-hidden="true" />
												Previous
											</button>
											<button
												type="button"
												disabled={currentFoodPage >= foodPageCount}
												onClick={() =>
													setFoodPage((current) =>
														Math.min(foodPageCount, current + 1),
													)
												}
												className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 disabled:opacity-40"
											>
												Next
												<ChevronRight className="size-4" aria-hidden="true" />
											</button>
										</div>
									</div>
								) : (
									<div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-sm font-semibold text-slate-500">
										No menu items available for table reservations.
									</div>
								)}
							</div>
						</section>
					</div>

					<aside className="grid gap-5 lg:sticky lg:top-6 lg:self-start">
						<section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)] md:p-5">
							<h2 className="text-xl font-semibold">Reservation summary</h2>
							<div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600">
								<div className="flex justify-between gap-3">
									<span>Table</span>
									<span className="text-right text-slate-950">
										{selectedTable?.label ?? "Select a table"}
									</span>
								</div>
								<div className="flex justify-between gap-3">
									<span>Guests</span>
									<span className="text-slate-950">{partySize}</span>
								</div>
								<div className="flex justify-between gap-3">
									<span>Time</span>
									<span className="text-right text-slate-950">
										{date} at {time}
									</span>
								</div>
								<div className="flex justify-between gap-3">
									<span>Food pre-order</span>
									<span className="text-slate-950">
										{formatMoney(foodTotal, currency)}
									</span>
								</div>
								<div className="flex justify-between gap-3">
									<span>Table fee</span>
									<span className="text-slate-950">
										{formatMoney(tableFee, currency)}
									</span>
								</div>
								<div className="flex justify-between gap-3 border-slate-100 border-t pt-3 text-lg font-black text-slate-950">
									<span>Due now</span>
									<span className="text-emerald-800">
										{formatMoney(dueNow, currency)}
									</span>
								</div>
							</div>

							{selectedTable ? (
								<p className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs font-bold leading-5 text-emerald-900">
									{selectedTable.policy.paymentTiming === "PAY_ON_BOOKING"
										? "Payment is required now to hold this table."
										: selectedTable.policy.paymentTiming === "PAY_AFTER_SERVICE"
											? "Payment will be collected after service."
											: "Payment will be collected on arrival if applicable."}
								</p>
							) : null}

							{setting.cancellationPolicy ? (
								<p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-600">
									{setting.cancellationPolicy}
								</p>
							) : null}

							<SubmitButton
								disabled={
									!selectedTableId ||
									(foodRequired && selectedItems.length === 0)
								}
								loadingText="Reserving..."
								successText="Reserved"
								className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-50"
							>
								{dueNow > 0 ? "Reserve and pay" : "Reserve table"}
							</SubmitButton>
						</section>
					</aside>
				</form>
			</div>
		</main>
	);
}
