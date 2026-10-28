import { wallClockIn, zonedWallClockToUtc } from "@/lib/zoned-time";

/**
 * Calendar maths in the restaurant's own timezone.
 *
 * Servers run in UTC, so `setHours(0, 0, 0, 0)` gives UTC midnight, an hour
 * into a Lagos day. Orders between midnight and 1am landed on the wrong day
 * and "today" started an hour late. Everything that groups by day goes
 * through here instead.
 */

/** "YYYY-MM-DD" plus `days`, as plain calendar arithmetic. */
export function addDaysToDateKey(dateKey: string, days: number): string {
	const [y, m, d] = dateKey.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The restaurant's calendar date for an instant. */
export function dateKeyIn(timeZone: string, instant: Date): string {
	return wallClockIn(timeZone, instant).date;
}

/** The instant the given calendar date starts in the restaurant's timezone. */
export function startOfDateIn(timeZone: string, dateKey: string): Date {
	return zonedWallClockToUtc(dateKey, "00:00", timeZone);
}

/** The local hour (0–23) of an instant. */
export function hourIn(timeZone: string, instant: Date): number {
	return Number(wallClockIn(timeZone, instant).time.slice(0, 2));
}

/** Day of week (0 = Sunday) of a calendar date. */
function weekdayOf(dateKey: string): number {
	const [y, m, d] = dateKey.split("-").map(Number);
	return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * Today's boundaries and the comparable windows before it, for "vs yesterday"
 * and "vs last week" figures. Comparisons are to the same point in time
 * (yesterday up to this hour), so a quiet morning isn't compared with a whole
 * finished day.
 */
export function restaurantCalendar(timeZone: string, now: Date = new Date()) {
	const today = dateKeyIn(timeZone, now);
	const todayStart = startOfDateIn(timeZone, today);
	const tomorrowStart = startOfDateIn(timeZone, addDaysToDateKey(today, 1));
	const yesterdayStart = startOfDateIn(timeZone, addDaysToDateKey(today, -1));
	const elapsedToday = now.getTime() - todayStart.getTime();

	// Weeks start on Monday.
	const sinceMonday = (weekdayOf(today) + 6) % 7;
	const weekStartKey = addDaysToDateKey(today, -sinceMonday);
	const weekStart = startOfDateIn(timeZone, weekStartKey);
	const lastWeekStart = startOfDateIn(
		timeZone,
		addDaysToDateKey(weekStartKey, -7),
	);
	const elapsedWeek = now.getTime() - weekStart.getTime();

	return {
		today,
		todayStart,
		tomorrowStart,
		yesterdayStart,
		/** Yesterday, up to the same time of day as now. */
		yesterdaySameTime: new Date(yesterdayStart.getTime() + elapsedToday),
		weekStart,
		lastWeekStart,
		/** Last week, up to the same point in the week as now. */
		lastWeekSameTime: new Date(lastWeekStart.getTime() + elapsedWeek),
		/** Start of the day 29 days ago: a 30-day window including today. */
		thirtyDaysStart: startOfDateIn(timeZone, addDaysToDateKey(today, -29)),
	};
}

/**
 * Percentage change, or null when there's nothing to compare with (a jump
 * from 0 isn't a meaningful percentage).
 */
export function percentChange(
	current: number,
	previous: number,
): number | null {
	if (previous <= 0) return null;
	return ((current - previous) / previous) * 100;
}

export function formatChange(change: number | null): string | null {
	if (change === null) return null;
	const rounded = Math.round(change);
	if (rounded === 0) return "No change";
	return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

/** When the restaurant's next calendar day starts: the end of "today". */
export function startOfNextDayIn(
	timeZone: string,
	now: Date = new Date(),
): Date {
	return startOfDateIn(timeZone, addDaysToDateKey(dateKeyIn(timeZone, now), 1));
}
