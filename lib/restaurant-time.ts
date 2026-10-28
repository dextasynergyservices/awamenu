import { dateKeyIn } from "@/lib/restaurant-day";
import { formatInTimeZone } from "@/lib/zoned-time";

/**
 * Dates and times shown in dashboards, always in the restaurant's timezone.
 * Formatting without one used the server's clock (UTC) when rendering and the
 * browser's afterwards: an hour off in Lagos, and a hydration error.
 */

/** "Today, 2:15 pm" or "27 Oct, 2:15 pm". */
export function formatOrderTime(value: string | Date, timeZone: string) {
	const date = new Date(value);
	const time = formatInTimeZone(date, timeZone, {
		hour: "numeric",
		minute: "2-digit",
	});
	if (dateKeyIn(timeZone, date) === dateKeyIn(timeZone, new Date())) {
		return `Today, ${time}`;
	}
	return `${formatInTimeZone(date, timeZone, { month: "short", day: "numeric" })}, ${time}`;
}

/** "27 Oct 2026, 14:15"-style medium date and short time. */
export function formatDateTime(value: string | Date, timeZone: string) {
	return formatInTimeZone(new Date(value), timeZone, {
		dateStyle: "medium",
		timeStyle: "short",
	});
}

/** "14:15" */
export function formatClock(value: string | Date, timeZone: string) {
	return formatInTimeZone(new Date(value), timeZone, {
		hour: "2-digit",
		minute: "2-digit",
	});
}

/** "27 Oct 2026" */
export function formatDay(value: string | Date, timeZone: string) {
	return formatInTimeZone(new Date(value), timeZone, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function isTodayIn(value: string | Date, timeZone: string) {
	return (
		dateKeyIn(timeZone, new Date(value)) === dateKeyIn(timeZone, new Date())
	);
}
