import { spawnSync } from "node:child_process";

/**
 * Vercel's build entry point (`vercel-build` in package.json).
 *
 * Production deployments apply pending migrations first, so new code never
 * runs against an old schema. Preview deployments skip it — they must never
 * migrate the production database a branch happens to point at.
 *
 * Needs DIRECT_DATABASE_URL in the production environment on Vercel (Neon's
 * non-pooled host); the app itself keeps using the pooled DATABASE_URL.
 */
function run(command, args) {
	const result = spawnSync(command, args, { stdio: "inherit", shell: false });
	if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.env.VERCEL_ENV === "production") {
	if (!process.env.DIRECT_DATABASE_URL) {
		console.error(
			"DIRECT_DATABASE_URL is not set — refusing to deploy without applying migrations.",
		);
		process.exit(1);
	}
	run("bun", ["x", "prisma", "migrate", "deploy"]);
} else {
	console.log(
		`Skipping migrations (VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}).`,
	);
}

run("bun", ["run", "build"]);
