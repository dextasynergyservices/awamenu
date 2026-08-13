export type OpeningPeriod = {
	/** 0 = Sunday … 6 = Saturday. */
	dayOfWeek: number;
	/** "HH:mm", 24-hour, in the restaurant's own timezone. */
	opensAt: string;
	closesAt: string;
};

export type OpenState = {
	isOpen: boolean;
	/** "Open now", "Closed", "Opens 9:00 AM", "Closes 10:00 PM". */
	label: string;
};

const DAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

export const DAY_LABELS = DAY_NAMES;

function toMinutes(time: string): number | null {
	const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
	if (!match) return null;
	const hours = Number(match[1]);
	const minutes = Number(match[2]);
	if (hours > 23 || minutes > 59) return null;
	return hours * 60 + minutes;
}

function formatTime(minutes: number) {
	const total = ((minutes % 1440) + 1440) % 1440;
	const hour24 = Math.floor(total / 60);
	const minute = total % 60;
	const suffix = hour24 < 12 ? "AM" : "PM";
	const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
	return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/**
 * Reads the wall clock in a specific timezone.
 *
 * A restaurant in Lagos is open by Lagos time, not by the clock of whoever is
 * looking at the menu — a customer browsing from London must still see
 * "Closed" at 3am Lagos time. `Intl` does the conversion without pulling in a
 * date library, and handles DST for timezones that observe it.
 */
function wallClockIn(timezone: string, now: Date) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		weekday: "short",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	}).formatToParts(now);

	const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
	const weekdayIndex = [
		"Sun",
		"Mon",
		"Tue",
		"Wed",
		"Thu",
		"Fri",
		"Sat",
	].indexOf(get("weekday"));
	// `hour12: false` renders midnight as "24" in some ICU versions.
	const hour = Number(get("hour")) % 24;

	return {
		dayOfWeek: weekdayIndex === -1 ? now.getDay() : weekdayIndex,
		minutes: hour * 60 + Number(get("minute")),
	};
}

/**
 * Whether a restaurant is open right now, and what to tell the customer.
 *
 * Handles periods that run past midnight, which is the case naive
 * implementations miss: a bar open 18:00–02:00 on Friday is still open at
 * 00:30 on Saturday, and that period belongs to Friday's row.
 *
 * With no hours configured the restaurant is treated as open. Silently
 * marking every existing restaurant "Closed" the moment this ships would cost
 * them orders; an empty schedule means "not specified", not "never open".
 */
export function getOpenState(
	periods: OpeningPeriod[],
	timezone: string,
	now: Date = new Date(),
): OpenState {
	if (periods.length === 0) return { isOpen: true, label: "Open now" };

	let clock: { dayOfWeek: number; minutes: number };
	try {
		clock = wallClockIn(timezone, now);
	} catch {
		// An invalid timezone must not take the menu down.
		clock = {
			dayOfWeek: now.getDay(),
			minutes: now.getHours() * 60 + now.getMinutes(),
		};
	}

	const yesterday = (clock.dayOfWeek + 6) % 7;

	for (const period of periods) {
		const open = toMinutes(period.opensAt);
		const close = toMinutes(period.closesAt);
		if (open === null || close === null) continue;

		// Same-day period.
		if (
			close > open &&
			period.dayOfWeek === clock.dayOfWeek &&
			clock.minutes >= open &&
			clock.minutes < close
		) {
			return { isOpen: true, label: `Open until ${formatTime(close)}` };
		}

		// Overnight period, evaluated from both ends: the evening it opens, and
		// the small hours of the following day.
		if (close <= open) {
			if (period.dayOfWeek === clock.dayOfWeek && clock.minutes >= open) {
				return { isOpen: true, label: `Open until ${formatTime(close)}` };
			}
			if (period.dayOfWeek === yesterday && clock.minutes < close) {
				return { isOpen: true, label: `Open until ${formatTime(close)}` };
			}
		}
	}

	// Closed — find the next opening so the badge says something useful.
	const next = findNextOpening(periods, clock);
	return { isOpen: false, label: next ? `Opens ${next}` : "Closed" };
}

function findNextOpening(
	periods: OpeningPeriod[],
	clock: { dayOfWeek: number; minutes: number },
): string | null {
	for (let offset = 0; offset < 7; offset++) {
		const day = (clock.dayOfWeek + offset) % 7;
		const candidates = periods
			.filter((p) => p.dayOfWeek === day)
			.map((p) => toMinutes(p.opensAt))
			.filter((m): m is number => m !== null)
			.filter((m) => offset > 0 || m > clock.minutes)
			.sort((a, b) => a - b);

		const soonest = candidates[0];
		if (soonest === undefined) continue;

		if (offset === 0) return formatTime(soonest);
		if (offset === 1) return `tomorrow ${formatTime(soonest)}`;
		return `${DAY_NAMES[day]} ${formatTime(soonest)}`;
	}
	return null;
}

/**
 * Whether a specific wall-clock slot falls inside opening hours.
 *
 * Used to stop a reservation being taken for a day the restaurant is closed.
 * Takes the date and time as the customer entered them — both are already in
 * the restaurant's timezone, so no conversion is needed and none is done.
 *
 * No hours configured means unrestricted, matching `getOpenState`: a schedule
 * nobody has filled in should not start refusing bookings.
 */
export function isWithinOpeningHours(
	periods: OpeningPeriod[],
	date: string,
	time: string,
): boolean {
	if (periods.length === 0) return true;

	const requested = toMinutes(time);
	if (requested === null) return true;

	// Parsed as plain calendar parts. `new Date("2026-08-12")` is UTC midnight,
	// which lands on the previous day west of Greenwich and would pick the
	// wrong weekday.
	const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
	if (!parts) return true;
	const dayOfWeek = new Date(
		Number(parts[1]),
		Number(parts[2]) - 1,
		Number(parts[3]),
	).getDay();
	const yesterday = (dayOfWeek + 6) % 7;

	return periods.some((period) => {
		const open = toMinutes(period.opensAt);
		const close = toMinutes(period.closesAt);
		if (open === null || close === null) return false;

		if (close > open) {
			return (
				period.dayOfWeek === dayOfWeek && requested >= open && requested < close
			);
		}

		// Overnight: the evening half belongs to this day, the small hours to the
		// next one.
		if (period.dayOfWeek === dayOfWeek && requested >= open) return true;
		return period.dayOfWeek === yesterday && requested < close;
	});
}

/** Days with no opening periods at all, for showing "Closed" in a picker. */
export function getClosedDays(periods: OpeningPeriod[]): number[] {
	if (periods.length === 0) return [];
	const open = new Set(periods.map((period) => period.dayOfWeek));
	return [0, 1, 2, 3, 4, 5, 6].filter((day) => !open.has(day));
}

/**
 * The bookable start times for one day, on the restaurant's grid.
 *
 * A raw time input let a customer book 19:37: no kitchen paces around that,
 * and it makes the overlap check nearly useless because two bookings twenty
 * minutes apart both "fit" while neither table turns.
 *
 * Slots stop far enough before closing that the booking still fits inside
 * opening hours — offering 21:45 for a two-hour sitting at a place that shuts
 * at 22:00 is an argument at the door, not a booking.
 */
export function getBookableSlots(input: {
	periods: OpeningPeriod[];
	date: string;
	intervalMinutes: number;
	bookingMinutes: number;
	/** Slots at or before this instant are already gone. */
	notBefore?: { date: string; time: string };
}): string[] {
	const interval = Math.max(5, input.intervalMinutes);
	const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.date.trim());
	if (!parts) return [];

	const dayOfWeek = new Date(
		Number(parts[1]),
		Number(parts[2]) - 1,
		Number(parts[3]),
	).getDay();

	const cutoff =
		input.notBefore && input.notBefore.date === input.date
			? (toMinutes(input.notBefore.time) ?? -1)
			: -1;

	const slots = new Set<number>();

	// No hours configured means unrestricted, matching the rest of this module:
	// a schedule nobody filled in should not silently refuse every booking.
	if (input.periods.length === 0) {
		for (let minute = 0; minute < 1440; minute += interval) {
			if (minute > cutoff) slots.add(minute);
		}
		return [...slots].sort((a, b) => a - b).map(formatSlot);
	}

	for (const period of input.periods) {
		if (period.dayOfWeek !== dayOfWeek) continue;
		const open = toMinutes(period.opensAt);
		const close = toMinutes(period.closesAt);
		if (open === null || close === null) continue;

		// An overnight period runs past midnight, so its usable length is
		// measured to the close on the following day.
		const span = close > open ? close - open : 1440 - open + close;
		const last = open + Math.max(0, span - input.bookingMinutes);

		for (let minute = open; minute <= last; minute += interval) {
			// Stored past 1440 for ordering; wrapped only when formatted.
			if (minute % 1440 > cutoff || minute >= 1440) slots.add(minute);
		}
	}

	return [...slots].sort((a, b) => a - b).map(formatSlot);
}

function formatSlot(minutes: number) {
	const wrapped = minutes % 1440;
	const hours = Math.floor(wrapped / 60);
	return `${String(hours).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}
