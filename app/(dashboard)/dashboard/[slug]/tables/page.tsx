import {
	TableBookingMode,
	TableInclusionType,
	TablePaymentTiming,
} from "@prisma/client";
import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import {
	createTableSeatAction,
	deactivateTableSeatAction,
	updateTableSeatAction,
	upsertReservationSettingAction,
} from "@/actions/reservation.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";

type TablesPageProps = {
	params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

const inputClass =
	"min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-700";
const labelClass = "grid gap-1 text-xs font-semibold text-slate-500";

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
			<span className="mt-1 block rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-xs font-semibold leading-5 text-emerald-900">
				{help}
			</span>
		</details>
	);
}

export default async function TablesPage({ params }: TablesPageProps) {
	const user = await requireUser();
	const { slug } = await params;
	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug, ownerId: user.id },
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
					capacity: true,
					isActive: true,
					sortOrder: true,
					bookingModeOverride: true,
					paymentTimingOverride: true,
					inclusionTypeOverride: true,
					tableFee: true,
					minimumSpend: true,
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

	return (
		<section className="grid gap-5">
			<div>
				<p className="text-sm font-medium text-slate-500">{restaurant.name}</p>
				<h1 className="mt-1 text-xl font-black text-slate-950 md:text-3xl">
					Tables
				</h1>
				<p className="mt-1 text-xs font-medium text-slate-500 md:text-base">
					Configure public table reservations and per-table booking rules.
				</p>
			</div>

			<form
				action={upsertReservationSettingAction}
				className="grid gap-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)] md:p-5"
			>
				<input type="hidden" name="slug" value={restaurant.slug} />
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

				<div>
					<SubmitButton className="min-h-11 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white">
						Save settings
					</SubmitButton>
				</div>
			</form>

			<form
				action={createTableSeatAction}
				className="grid gap-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)] md:p-5"
			>
				<input type="hidden" name="slug" value={restaurant.slug} />
				<h2 className="text-lg font-black text-slate-950">Add table</h2>
				<div className="grid gap-3 md:grid-cols-[1fr_1fr_0.5fr_0.5fr]">
					<label className={labelClass}>
						<FieldLabel help={helpText.tableLabel}>Table name</FieldLabel>
						<input name="label" required className={inputClass} />
					</label>
					<label className={labelClass}>
						<FieldLabel help={helpText.tableDescription}>
							Customer note
						</FieldLabel>
						<input name="description" className={inputClass} />
					</label>
					<label className={labelClass}>
						<FieldLabel help={helpText.capacity}>Seats</FieldLabel>
						<input
							name="capacity"
							type="number"
							min="1"
							defaultValue={2}
							className={inputClass}
						/>
					</label>
					<label className={labelClass}>
						<FieldLabel help={helpText.sortOrder}>Display order</FieldLabel>
						<input
							name="sortOrder"
							type="number"
							min="0"
							defaultValue={0}
							className={inputClass}
						/>
					</label>
				</div>
				<div className="grid gap-3 md:grid-cols-5">
					<PolicyOverrideSelect name="bookingModeOverride" label="Mode" />
					<PolicyOverrideSelect name="paymentTimingOverride" label="Timing" />
					<PolicyOverrideSelect
						name="inclusionTypeOverride"
						label="Inclusion"
					/>
					<label className={labelClass}>
						<FieldLabel help={helpText.tableFee}>Table fee</FieldLabel>
						<input
							name="tableFee"
							type="number"
							min="0"
							step="100"
							className={inputClass}
						/>
					</label>
					<label className={labelClass}>
						<FieldLabel help={helpText.minimumSpend}>Minimum spend</FieldLabel>
						<input
							name="minimumSpend"
							type="number"
							min="0"
							step="100"
							className={inputClass}
						/>
					</label>
				</div>
				<div>
					<SubmitButton className="min-h-11 rounded-xl bg-slate-950 px-5 text-sm font-black text-white">
						Add table
					</SubmitButton>
				</div>
			</form>

			<div className="grid gap-4">
				{restaurant.tables.length > 0 ? (
					restaurant.tables.map((table) => (
						<form
							key={table.id}
							action={updateTableSeatAction}
							className="grid gap-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)] md:p-5"
						>
							<input type="hidden" name="slug" value={restaurant.slug} />
							<input type="hidden" name="tableId" value={table.id} />
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<h2 className="text-lg font-black text-slate-950">
										{table.label}
									</h2>
									<p className="mt-1 text-sm font-semibold text-slate-500">
										Seats {table.capacity} ·{" "}
										{table.tableFee
											? formatMoney(table.tableFee, restaurant.currency)
											: "No table fee"}
									</p>
								</div>
								<label className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">
									<input
										type="checkbox"
										name="isActive"
										defaultChecked={table.isActive}
										className="size-4 accent-emerald-700"
									/>
									Active
								</label>
							</div>

							<div className="grid gap-3 md:grid-cols-[1fr_1fr_0.5fr_0.5fr]">
								<label className={labelClass}>
									<FieldLabel help={helpText.tableLabel}>Table name</FieldLabel>
									<input
										name="label"
										required
										defaultValue={table.label}
										className={inputClass}
									/>
								</label>
								<label className={labelClass}>
									<FieldLabel help={helpText.tableDescription}>
										Customer note
									</FieldLabel>
									<input
										name="description"
										defaultValue={table.description ?? ""}
										className={inputClass}
									/>
								</label>
								<label className={labelClass}>
									<FieldLabel help={helpText.capacity}>Seats</FieldLabel>
									<input
										name="capacity"
										type="number"
										min="1"
										defaultValue={table.capacity}
										className={inputClass}
									/>
								</label>
								<label className={labelClass}>
									<FieldLabel help={helpText.sortOrder}>
										Display order
									</FieldLabel>
									<input
										name="sortOrder"
										type="number"
										min="0"
										defaultValue={table.sortOrder}
										className={inputClass}
									/>
								</label>
							</div>

							<div className="grid gap-3 md:grid-cols-5">
								<PolicyOverrideSelect
									name="bookingModeOverride"
									label="Mode"
									defaultValue={table.bookingModeOverride ?? ""}
								/>
								<PolicyOverrideSelect
									name="paymentTimingOverride"
									label="Timing"
									defaultValue={table.paymentTimingOverride ?? ""}
								/>
								<PolicyOverrideSelect
									name="inclusionTypeOverride"
									label="Inclusion"
									defaultValue={table.inclusionTypeOverride ?? ""}
								/>
								<label className={labelClass}>
									<FieldLabel help={helpText.tableFee}>Table fee</FieldLabel>
									<input
										name="tableFee"
										type="number"
										min="0"
										step="100"
										defaultValue={table.tableFee?.toString() ?? ""}
										className={inputClass}
									/>
								</label>
								<label className={labelClass}>
									<FieldLabel help={helpText.minimumSpend}>
										Minimum spend
									</FieldLabel>
									<input
										name="minimumSpend"
										type="number"
										min="0"
										step="100"
										defaultValue={table.minimumSpend?.toString() ?? ""}
										className={inputClass}
									/>
								</label>
							</div>

							<div className="flex flex-wrap gap-2">
								<SubmitButton className="min-h-11 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white">
									Save table
								</SubmitButton>
								<button
									type="submit"
									formAction={deactivateTableSeatAction}
									className="min-h-11 rounded-xl border border-red-100 bg-red-50 px-5 text-sm font-black text-red-700"
								>
									Deactivate
								</button>
							</div>
						</form>
					))
				) : (
					<div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
						<p className="text-lg font-black text-slate-950">
							No tables added yet
						</p>
					</div>
				)}
			</div>
		</section>
	);
}

function PolicyOverrideSelect({
	name,
	label,
	defaultValue = "",
}: {
	name: string;
	label: string;
	defaultValue?: string;
}) {
	const options =
		name === "bookingModeOverride"
			? enumOptions(TableBookingMode)
			: name === "paymentTimingOverride"
				? enumOptions(TablePaymentTiming)
				: enumOptions(TableInclusionType);

	return (
		<label className={labelClass}>
			<FieldLabel help={helpText.override}>{label}</FieldLabel>
			<select name={name} defaultValue={defaultValue} className={inputClass}>
				<option value="">Restaurant default</option>
				{options}
			</select>
		</label>
	);
}
