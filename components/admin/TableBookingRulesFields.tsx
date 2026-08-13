"use client";

import { ChevronDown, Clock, Users, Wallet } from "lucide-react";
import { useState } from "react";

export type TableBookingRules = {
	bookingMode: string;
	paymentTiming: string;
	inclusionType: string;
	holdMinutes: number;
	minPartySize: number;
	maxPartySize: number;
	tableFee: number | null;
	minimumSpend: number | null;
	depositPercent: number;
};

const BOOKING_MODES = [
	{
		value: "FREE_BOOKING",
		label: "Free to book",
		hint: "Anyone can reserve. Nothing is charged up front.",
	},
	{
		value: "ORDER_REQUIRED",
		label: "Must order food",
		hint: "The guest picks menu items as part of booking.",
	},
	{
		value: "DEPOSIT_REQUIRED",
		label: "Deposit required",
		hint: "A part-payment holds the table.",
	},
	{
		value: "FULL_PAYMENT",
		label: "Pay in full",
		hint: "The whole amount is taken at booking.",
	},
];

const PAYMENT_TIMINGS = [
	{ value: "PAY_ON_BOOKING", label: "When booking" },
	{ value: "PAY_ON_ARRIVAL", label: "On arrival" },
	{ value: "PAY_AFTER_SERVICE", label: "After service" },
];

const INCLUSION_TYPES = [
	{ value: "TABLE_FEE_ONLY", label: "Table fee only" },
	{ value: "FOOD_ONLY", label: "Food only" },
	{ value: "FOOD_AND_TABLE_FEE", label: "Food and table fee" },
];

const fieldClass =
	"min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 sm:text-sm";
const labelClass =
	"mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500";

/**
 * Booking rules for one table.
 *
 * These used to be restaurant-wide defaults, with per-table overrides that the
 * table form only ever passed through as hidden inputs — so in practice nobody
 * could set them per table at all. They belong here: the answer differs
 * between a two-seat window table and a private room.
 */
export function TableBookingRulesFields({
	defaults,
	currency = "NGN",
}: {
	defaults?: Partial<TableBookingRules>;
	currency?: string;
}) {
	const [mode, setMode] = useState(defaults?.bookingMode ?? "FREE_BOOKING");
	const [open, setOpen] = useState(false);
	const [hold, setHold] = useState(defaults?.holdMinutes ?? 60);

	// Money only matters once something is actually charged; showing a fee box
	// on a free table invites a value that is silently never used.
	const takesMoney = mode === "DEPOSIT_REQUIRED" || mode === "FULL_PAYMENT";
	const takesDeposit = mode === "DEPOSIT_REQUIRED";
	const selected = BOOKING_MODES.find((option) => option.value === mode);

	return (
		<div className="grid min-w-0 gap-4">
			<fieldset className="grid min-w-0 gap-2">
				<legend className={labelClass}>How this table is booked</legend>
				<div className="grid gap-2 sm:grid-cols-2">
					{BOOKING_MODES.map((option) => (
						<label
							key={option.value}
							className={`flex min-w-0 cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors ${
								mode === option.value
									? "border-emerald-600 bg-emerald-50"
									: "border-slate-200 bg-white hover:bg-slate-50"
							}`}
						>
							<input
								type="radio"
								name="bookingMode"
								value={option.value}
								checked={mode === option.value}
								onChange={() => setMode(option.value)}
								className="mt-0.5 size-4 shrink-0 accent-emerald-600"
							/>
							<span className="min-w-0">
								<span className="block text-sm font-black text-slate-900">
									{option.label}
								</span>
								<span className="block text-xs font-medium leading-5 text-slate-500">
									{option.hint}
								</span>
							</span>
						</label>
					))}
				</div>
			</fieldset>

			<div className="grid min-w-0 gap-3 sm:grid-cols-2">
				<label className="min-w-0">
					<span className={labelClass}>
						<Users className="mr-1 inline size-3.5" aria-hidden="true" />
						Smallest party
					</span>
					<input
						name="minPartySize"
						type="number"
						min={1}
						defaultValue={defaults?.minPartySize ?? 1}
						className={fieldClass}
					/>
				</label>
				<label className="min-w-0">
					<span className={labelClass}>Largest party</span>
					<input
						name="maxPartySize"
						type="number"
						min={0}
						defaultValue={defaults?.maxPartySize ?? 0}
						className={fieldClass}
					/>
					<span className="mt-1 block text-xs font-medium text-slate-400">
						0 uses the table&apos;s capacity.
					</span>
				</label>
			</div>

			{/* Secondary rules folded away: most tables never change them, and four
			    more inputs on an already long form is where people give up. */}
			<div className="min-w-0 rounded-xl border border-slate-200">
				<button
					type="button"
					onClick={() => setOpen((value) => !value)}
					aria-expanded={open}
					className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left"
				>
					<span className="text-sm font-black text-slate-800">
						Timing and charges
					</span>
					<span className="flex items-center gap-2">
						<span className="hidden text-xs font-medium text-slate-500 sm:inline">
							{selected?.label}
						</span>
						<ChevronDown
							className={`size-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
							aria-hidden="true"
						/>
					</span>
				</button>

				{open ? (
					<div className="grid min-w-0 gap-3 border-t border-slate-100 p-3 sm:grid-cols-2">
						{/* Minutes, not hours: 90 and 120 are the two most common turn
						    times in the trade and neither reads well as a decimal. The
						    presets cover the usual answers; the box handles the rest. */}
						<div className="min-w-0 sm:col-span-2">
							<span className={labelClass}>
								<Clock className="mr-1 inline size-3.5" aria-hidden="true" />
								How long the table is booked for
							</span>
							<div className="flex flex-wrap items-center gap-2">
								{[60, 90, 120, 180].map((preset) => (
									<button
										key={preset}
										type="button"
										onClick={() => setHold(preset)}
										className={`min-h-9 rounded-full border px-3 text-xs font-black transition-colors ${
											hold === preset
												? "border-emerald-600 bg-emerald-50 text-emerald-700"
												: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
										}`}
									>
										{preset % 60 === 0
											? `${preset / 60}h`
											: `${Math.floor(preset / 60)}h ${preset % 60}m`}
									</button>
								))}
								<input
									name="holdMinutes"
									type="number"
									min={15}
									max={480}
									value={hold}
									onChange={(event) => setHold(Number(event.target.value))}
									aria-label="Booking length in minutes"
									className={`${fieldClass} w-24 flex-none`}
								/>
								<span className="text-xs font-medium text-slate-500">mins</span>
							</div>
							<span className="mt-1 block text-xs font-medium text-slate-400">
								The table is unavailable to others for this long from the
								booking time.
							</span>
						</div>

						<label className="min-w-0">
							<span className={labelClass}>When they pay</span>
							<select
								name="paymentTiming"
								defaultValue={defaults?.paymentTiming ?? "PAY_ON_ARRIVAL"}
								className={fieldClass}
							>
								{PAYMENT_TIMINGS.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</label>

						<label className="min-w-0">
							<span className={labelClass}>What the price covers</span>
							<select
								name="inclusionType"
								defaultValue={defaults?.inclusionType ?? "TABLE_FEE_ONLY"}
								className={fieldClass}
							>
								{INCLUSION_TYPES.map((option) => (
									<option key={option.value} value={option.value}>
										{option.label}
									</option>
								))}
							</select>
						</label>

						{takesMoney ? (
							<label className="min-w-0">
								<span className={labelClass}>
									<Wallet className="mr-1 inline size-3.5" aria-hidden="true" />
									Table fee ({currency})
								</span>
								<input
									name="tableFee"
									type="number"
									min={0}
									step="0.01"
									defaultValue={defaults?.tableFee ?? ""}
									className={fieldClass}
								/>
							</label>
						) : (
							<input type="hidden" name="tableFee" value="" />
						)}

						{takesDeposit ? (
							<label className="min-w-0">
								<span className={labelClass}>Deposit (% of total)</span>
								<input
									name="depositPercent"
									type="number"
									min={0}
									max={100}
									defaultValue={defaults?.depositPercent ?? 0}
									className={fieldClass}
								/>
								<span className="mt-1 block text-xs font-medium text-slate-400">
									Taken from the food and table fee together. 0 charges just the
									table fee.
								</span>
							</label>
						) : (
							<input
								type="hidden"
								name="depositPercent"
								value={defaults?.depositPercent ?? 0}
							/>
						)}

						<label className="min-w-0">
							<span className={labelClass}>Minimum spend ({currency})</span>
							<input
								name="minimumSpend"
								type="number"
								min={0}
								step="0.01"
								defaultValue={defaults?.minimumSpend ?? ""}
								className={fieldClass}
							/>
						</label>
					</div>
				) : (
					<>
						{/* Values still submit while collapsed — a hidden section must
						    not silently reset what the owner already saved. */}
						<input type="hidden" name="holdMinutes" value={hold} />
						<input
							type="hidden"
							name="paymentTiming"
							value={defaults?.paymentTiming ?? "PAY_ON_ARRIVAL"}
						/>
						<input
							type="hidden"
							name="inclusionType"
							value={defaults?.inclusionType ?? "TABLE_FEE_ONLY"}
						/>
						<input
							type="hidden"
							name="tableFee"
							value={defaults?.tableFee ?? ""}
						/>
						<input
							type="hidden"
							name="minimumSpend"
							value={defaults?.minimumSpend ?? ""}
						/>
						<input
							type="hidden"
							name="depositPercent"
							value={defaults?.depositPercent ?? 0}
						/>
					</>
				)}
			</div>
		</div>
	);
}
