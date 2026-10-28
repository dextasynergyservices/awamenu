import { getRedis } from "@/lib/redis";

/**
 * When each scheduled job last finished, for the Super Admin overview.
 *
 * Kept in Redis rather than the database: it's a status light, not a record,
 * and writing a row every few minutes would keep Neon's compute awake. Best
 * effort both ways — a failed write never fails the job, and a missing value
 * shows as "no record".
 */

export const CRON_JOBS = [
	{ name: "payments", label: "Payments & messages", expectedMinutes: 10 },
	{ name: "reservations", label: "Reservations", expectedMinutes: 10 },
	{ name: "subscriptions", label: "Subscriptions", expectedMinutes: 24 * 60 },
	{
		name: "reconcile-payments",
		label: "Payment reconciliation",
		expectedMinutes: 24 * 60,
	},
] as const;

export type CronJobName = (typeof CRON_JOBS)[number]["name"];

const key = (name: string) => `cron:last-run:${name}`;

export async function recordCronRun(name: CronJobName): Promise<void> {
	try {
		// Kept a week: older than that is "not running" either way.
		await getRedis()?.set(key(name), Date.now(), { ex: 7 * 24 * 60 * 60 });
	} catch (error) {
		console.error("[cron] could not record heartbeat", name, error);
	}
}

/** Last finish time per job, or null when unknown. */
export async function getCronRuns(): Promise<
	Array<{
		name: CronJobName;
		label: string;
		lastRunAt: Date | null;
		/** Not seen for over twice its expected interval. */
		late: boolean;
	}>
> {
	let values: (number | string | null)[] = CRON_JOBS.map(() => null);
	try {
		const redis = getRedis();
		if (redis) {
			values = await redis.mget<(number | string | null)[]>(
				...CRON_JOBS.map((job) => key(job.name)),
			);
		}
	} catch (error) {
		console.error("[cron] could not read heartbeats", error);
	}
	const now = Date.now();
	return CRON_JOBS.map((job, index) => {
		const raw = values[index];
		const lastRunAt =
			raw === null || raw === undefined ? null : new Date(Number(raw));
		const late =
			!lastRunAt ||
			now - lastRunAt.getTime() > job.expectedMinutes * 2 * 60_000;
		return { name: job.name, label: job.label, lastRunAt, late };
	});
}
