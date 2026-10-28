/**
 * Wall-clock ↔ instant conversion in a named timezone, with no date library.
 *
 * A booking is made in the restaurant's wall-clock time ("19:00 on the 12th,
 * in Lagos"). `new Date("2026-08-12T19:00:00")` reads that in the *server's*
 * timezone instead — UTC on Vercel — so every reservation was stored an hour
 * late, emails (formatted in Africa/Lagos) told guests the wrong time, and the
 * customer's browser drew availability an hour off from what the server
 * enforced. Safe on the client and the server.
 */

const FALLBACK_TIMEZONE = "Africa/Lagos";

function partsIn(timeZone: string, instant: Date) {
	let formatter: Intl.DateTimeFormat;
	try {
		formatter = new Intl.DateTimeFormat("en-US", {
			timeZone,
			hourCycle: "h23",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	} catch {
		// An invalid timezone on a restaurant record must not break booking.
		return partsIn(FALLBACK_TIMEZONE, instant);
	}

	const parts = formatter.formatToParts(instant);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((part) => part.type === type)?.value ?? 0);

	return {
		year: get("year"),
		month: get("month"),
		day: get("day"),
		// Some ICU builds still render midnight as "24".
		hour: get("hour") % 24,
		minute: get("minute"),
		second: get("second"),
	};
}

/** Milliseconds the zone is ahead of UTC at that instant. */
function offsetAt(timeZone: string, instant: Date) {
	const p = partsIn(timeZone, instant);
	const asUtc = Date.UTC(
		p.year,
		p.month - 1,
		p.day,
		p.hour,
		p.minute,
		p.second,
	);
	return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * The instant at which it is `date` `time` on the wall clock in `timeZone`.
 *
 * Returns an invalid Date for malformed input, so callers keep their existing
 * `Number.isNaN(date.getTime())` check.
 */
export function zonedWallClockToUtc(
	date: string,
	time: string,
	timeZone: string,
): Date {
	const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
	const t = /^(\d{2}):(\d{2})$/.exec(time.trim());
	if (!d || !t) return new Date(Number.NaN);

	const naive = Date.UTC(
		Number(d[1]),
		Number(d[2]) - 1,
		Number(d[3]),
		Number(t[1]),
		Number(t[2]),
	);

	// Two passes settle the offset across a DST change: the offset at the naive
	// guess can differ from the offset at the real instant by the shift itself.
	const first = naive - offsetAt(timeZone, new Date(naive));
	const second = naive - offsetAt(timeZone, new Date(first));
	return new Date(second);
}

/** The wall-clock date ("YYYY-MM-DD") and time ("HH:mm") in `timeZone`. */
export function wallClockIn(
	timeZone: string,
	instant: Date = new Date(),
): { date: string; time: string } {
	const p = partsIn(timeZone, instant);
	const pad = (value: number) => String(value).padStart(2, "0");
	return {
		date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
		time: `${pad(p.hour)}:${pad(p.minute)}`,
	};
}

/** Formats an instant for a guest, always in the restaurant's timezone. */
export function formatInTimeZone(
	instant: Date,
	timeZone: string,
	options: Intl.DateTimeFormatOptions = {
		dateStyle: "medium",
		timeStyle: "short",
	},
	locale = "en-NG",
) {
	try {
		return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(
			instant,
		);
	} catch {
		return new Intl.DateTimeFormat(locale, {
			...options,
			timeZone: FALLBACK_TIMEZONE,
		}).format(instant);
	}
}
