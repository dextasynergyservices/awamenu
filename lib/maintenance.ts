import { db } from "@/lib/db";

/**
 * Whether the platform is in maintenance mode (PlatformSetting.maintenanceMode).
 *
 * Read by proxy.ts on every page request, so it is cached in memory per server
 * instance for a short while. Turning the switch on or off therefore takes
 * effect within CACHE_MS everywhere (immediately on the instance that saved it,
 * via clearMaintenanceCache) — a fair trade for not querying the database on
 * every request.
 *
 * Fails open: if the setting can't be read, the site stays up. A database
 * outage already breaks the app; it should not also be reported to every
 * visitor as planned maintenance.
 */

const CACHE_MS = 30_000;

let cached: { value: boolean; at: number } | null = null;

export async function isMaintenanceMode(): Promise<boolean> {
	if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

	try {
		const settings = await db.platformSetting.findFirst({
			select: { maintenanceMode: true },
		});
		cached = { value: settings?.maintenanceMode ?? false, at: Date.now() };
	} catch (error) {
		console.error("[maintenance] could not read the setting", error);
		cached = { value: false, at: Date.now() };
	}
	return cached.value;
}

export function clearMaintenanceCache() {
	cached = null;
}
