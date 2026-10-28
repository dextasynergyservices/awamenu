import { type NextRequest, NextResponse } from "next/server";
import { isMaintenanceMode } from "@/lib/maintenance";
import { getSlugAliases } from "@/lib/slug-aliases";

/**
 * Two jobs, in order:
 *
 * 1. **Maintenance mode** (Super Admin → Settings → Maintenance).
 * 2. **Old restaurant addresses.** A restaurant that changed its slug keeps
 *    its printed QR codes and old email links working: `/old-slug/...` and
 *    `/api/qr/old-slug` redirect to the current slug.
 *
 * Maintenance mode:
 * While it is on, every page renders the maintenance screen with a 503, and
 * every write — form posts and server actions — is refused, so nobody can
 * place an order or change a menu mid-maintenance.
 *
 * Deliberately left running (see `config.matcher`):
 * - Payment confirmation and scheduled jobs (`/api/cron`, `/api/webhooks`):
 *   customers who already paid must still be confirmed, and holds must still
 *   be released on time.
 * - Sign-in and the Super Admin panel, so the switch can be turned back off.
 * - Static assets, the service worker and the manifest.
 */
export async function proxy(request: NextRequest) {
	if (!(await isMaintenanceMode())) return redirectOldSlug(request);

	const { pathname } = request.nextUrl;
	const isWrite =
		request.method !== "GET" && request.method !== "HEAD"
			? true
			: request.headers.has("next-action");

	// QR scans are opened in a browser, so they get the page, not JSON.
	const isApi =
		pathname.startsWith("/api/") && !pathname.startsWith("/api/qr/");

	if (isWrite || isApi) {
		return NextResponse.json(
			{ error: "AwaMenu is down for maintenance. Please try again shortly." },
			{ status: 503, headers: { "Retry-After": "300" } },
		);
	}

	return NextResponse.rewrite(new URL("/maintenance", request.url), {
		status: 503,
		headers: { "Retry-After": "300", "Cache-Control": "no-store" },
	});
}

/** Redirects a path that starts with a restaurant's previous slug. */
async function redirectOldSlug(request: NextRequest) {
	// Reads only: redirecting a form post or server action would drop its body.
	if (request.method !== "GET" && request.method !== "HEAD") {
		return NextResponse.next();
	}

	const segments = request.nextUrl.pathname.split("/");
	// "/old/..." → segment 1; "/api/qr/old" → segment 3.
	const index = segments[1] === "api" && segments[2] === "qr" ? 3 : 1;
	const candidate = segments[index];
	if (!candidate || (index === 1 && segments[1] === "api")) {
		return NextResponse.next();
	}

	const current = (await getSlugAliases()).get(candidate);
	if (!current) return NextResponse.next();

	const url = request.nextUrl.clone();
	segments[index] = current;
	url.pathname = segments.join("/");
	// Temporary (307), not permanent: a browser caches a 308 for good, and an
	// owner renaming A → B and later back to A would then loop forever.
	return NextResponse.redirect(url, 307);
}

export const config = {
	matcher: [
		/*
		 * Everything except: Next internals and static files, the maintenance
		 * page itself, payment/cron/auth endpoints, the Super Admin panel and the
		 * pages needed to sign in to it.
		 */
		// Each exclusion ends at a path boundary, so a restaurant slug that merely
		// starts with one of these words is still covered.
		"/((?!(?:_next/static|_next/image|icons|maintenance|api/cron|api/webhooks|api/auth|super-admin|login|forgot-password)(?:/|$)|favicon\\.ico$|sw\\.js$|manifest\\.webmanifest$).*)",
	],
};
