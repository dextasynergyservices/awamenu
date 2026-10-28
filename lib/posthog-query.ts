import { unstable_cache } from "next/cache";
import { env } from "@/env";

/**
 * Reads website traffic back from PostHog (HogQL query API) for the Super
 * Admin's Traffic tab. Needs a personal API key with the Query read scope and
 * the project id; without them the tab explains how to connect.
 *
 * Results are cached for 10 minutes per range: PostHog's query API is
 * rate-limited and traffic doesn't need to be live to the second.
 */

export type TrafficResult =
	| { status: "not_configured" }
	| { status: "error"; message: string }
	| { status: "ok"; data: TrafficData };

export type TrafficData = {
	totals: { visitors: number; pageviews: number; sessions: number };
	previous: { visitors: number; pageviews: number; sessions: number };
	daily: Array<{ day: string; visitors: number; pageviews: number }>;
	pages: Array<{ path: string; views: number; visitors: number }>;
	sections: Array<{ section: string; visitors: number; views: number }>;
	referrers: Array<{ source: string; visitors: number }>;
	devices: Array<{ device: string; visitors: number }>;
	countries: Array<{ country: string; visitors: number }>;
	events: Array<{ event: string; count: number }>;
};

const KEY_EVENTS = [
	"restaurant_signup_completed",
	"subscription_completed",
	"subscription_renewed",
	"order_placed",
	"reservation_created",
];

function apiHost() {
	if (env.POSTHOG_API_HOST) return env.POSTHOG_API_HOST.replace(/\/$/, "");
	// Derive the app host from the ingestion host (us.i.posthog.com → us.posthog.com).
	const ingest = env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
	return ingest.replace(".i.posthog.com", ".posthog.com").replace(/\/$/, "");
}

async function hogql<T extends unknown[]>(query: string): Promise<T[]> {
	const res = await fetch(
		`${apiHost()}/api/projects/${env.POSTHOG_PROJECT_ID}/query/`,
		{
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.POSTHOG_PERSONAL_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ query: { kind: "HogQLQuery", query } }),
			cache: "no-store",
		},
	);
	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		throw new Error(
			res.status === 401 || res.status === 403
				? "PostHog refused the API key. Check POSTHOG_PERSONAL_API_KEY has the Query read scope for this project."
				: `PostHog returned ${res.status}${detail ? `: ${detail.slice(0, 160)}` : ""}`,
		);
	}
	const json = (await res.json()) as { results?: T[] };
	return json.results ?? [];
}

/** ISO timestamp safe to inline in HogQL (only digits, dashes, colons, T, Z). */
function ts(date: Date) {
	return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

async function load(
	fromIso: string,
	toIso: string,
	prevFromIso: string,
): Promise<TrafficData> {
	const range = `timestamp >= toDateTime('${fromIso}') AND timestamp < toDateTime('${toIso}')`;
	const prevRange = `timestamp >= toDateTime('${prevFromIso}') AND timestamp < toDateTime('${fromIso}')`;
	const pv = `event = '$pageview'`;
	const section = `multiIf(
		properties.$pathname IN ('/', '/pricing', '/about', '/privacy', '/terms', '/refunds'), 'Marketing site',
		properties.$pathname LIKE '/signup%' OR properties.$pathname LIKE '/login%' OR properties.$pathname LIKE '/verify-email%' OR properties.$pathname LIKE '/forgot-password%', 'Sign up and log in',
		properties.$pathname LIKE '/onboarding%', 'Onboarding',
		properties.$pathname LIKE '/dashboard%', 'Owner dashboard',
		properties.$pathname LIKE '/super-admin%', 'Super admin',
		properties.$pathname LIKE '%/staff%', 'Staff dashboard',
		'Restaurant menus and ordering')`;

	const [
		totals,
		previous,
		daily,
		pages,
		sections,
		referrers,
		devices,
		countries,
		events,
	] = await Promise.all([
		hogql<[number, number, number]>(
			`SELECT count(DISTINCT person_id), count(), count(DISTINCT properties.$session_id) FROM events WHERE ${pv} AND ${range}`,
		),
		hogql<[number, number, number]>(
			`SELECT count(DISTINCT person_id), count(), count(DISTINCT properties.$session_id) FROM events WHERE ${pv} AND ${prevRange}`,
		),
		hogql<[string, number, number]>(
			`SELECT toString(toDate(toTimeZone(timestamp, 'Africa/Lagos'))) AS day, count(DISTINCT person_id), count() FROM events WHERE ${pv} AND ${range} GROUP BY day ORDER BY day`,
		),
		hogql<[string, number, number]>(
			`SELECT properties.$pathname AS path, count() AS views, count(DISTINCT person_id) FROM events WHERE ${pv} AND ${range} AND path IS NOT NULL GROUP BY path ORDER BY views DESC LIMIT 12`,
		),
		hogql<[string, number, number]>(
			`SELECT ${section} AS section, count(DISTINCT person_id) AS visitors, count() FROM events WHERE ${pv} AND ${range} GROUP BY section ORDER BY visitors DESC`,
		),
		hogql<[string, number]>(
			`SELECT coalesce(nullIf(properties.$referring_domain, '$direct'), 'Direct') AS source, count(DISTINCT person_id) AS visitors FROM events WHERE ${pv} AND ${range} GROUP BY source ORDER BY visitors DESC LIMIT 8`,
		),
		hogql<[string, number]>(
			`SELECT coalesce(properties.$device_type, 'Unknown') AS device, count(DISTINCT person_id) AS visitors FROM events WHERE ${pv} AND ${range} GROUP BY device ORDER BY visitors DESC`,
		),
		hogql<[string, number]>(
			`SELECT coalesce(properties.$geoip_country_name, 'Unknown') AS country, count(DISTINCT person_id) AS visitors FROM events WHERE ${pv} AND ${range} GROUP BY country ORDER BY visitors DESC LIMIT 8`,
		),
		hogql<[string, number]>(
			`SELECT event, count() FROM events WHERE event IN (${KEY_EVENTS.map((e) => `'${e}'`).join(", ")}) AND ${range} GROUP BY event`,
		),
	]);

	const t = totals[0] ?? [0, 0, 0];
	const p = previous[0] ?? [0, 0, 0];
	return {
		totals: {
			visitors: Number(t[0]),
			pageviews: Number(t[1]),
			sessions: Number(t[2]),
		},
		previous: {
			visitors: Number(p[0]),
			pageviews: Number(p[1]),
			sessions: Number(p[2]),
		},
		daily: daily.map(([day, visitors, pageviews]) => ({
			day,
			visitors: Number(visitors),
			pageviews: Number(pageviews),
		})),
		pages: pages.map(([path, views, visitors]) => ({
			path,
			views: Number(views),
			visitors: Number(visitors),
		})),
		sections: sections.map(([section, visitors, views]) => ({
			section,
			visitors: Number(visitors),
			views: Number(views),
		})),
		referrers: referrers.map(([source, visitors]) => ({
			source,
			visitors: Number(visitors),
		})),
		devices: devices.map(([device, visitors]) => ({
			device,
			visitors: Number(visitors),
		})),
		countries: countries.map(([country, visitors]) => ({
			country,
			visitors: Number(visitors),
		})),
		events: KEY_EVENTS.map((event) => ({
			event,
			count: Number(events.find((e) => e[0] === event)?.[1] ?? 0),
		})),
	};
}

const cachedLoad = unstable_cache(load, ["posthog-traffic"], {
	revalidate: 600,
});

export async function getTraffic(from: Date, to: Date): Promise<TrafficResult> {
	if (!env.POSTHOG_PERSONAL_API_KEY || !env.POSTHOG_PROJECT_ID) {
		return { status: "not_configured" };
	}
	if (!/^\d+$/.test(env.POSTHOG_PROJECT_ID)) {
		return {
			status: "error",
			message: "POSTHOG_PROJECT_ID should be the number from your PostHog URL.",
		};
	}
	const prevFrom = new Date(from.getTime() - (to.getTime() - from.getTime()));
	try {
		// Rounded to the hour so the cache key is stable within a visit.
		const hour = (d: Date, up = false) =>
			new Date(
				(up ? Math.ceil : Math.floor)(d.getTime() / 3_600_000) * 3_600_000,
			);
		return {
			status: "ok",
			data: await cachedLoad(
				ts(hour(from)),
				ts(hour(to, true)),
				ts(hour(prevFrom)),
			),
		};
	} catch (error) {
		return {
			status: "error",
			message:
				error instanceof Error ? error.message : "Couldn't reach PostHog.",
		};
	}
}
