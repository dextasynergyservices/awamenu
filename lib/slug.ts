/**
 * Converts a restaurant name into a URL-safe slug — lowercase, alphanumeric
 * words joined by single hyphens. Shared between the client-side live
 * preview (onboarding, settings) and any server-side normalization.
 */
export function slugify(input: string): string {
	return input
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 60);
}

/**
 * First path segments the app itself uses.
 *
 * A restaurant at /dashboard or /login would be unreachable — the app's own
 * route wins — and /login or /maintenance would even slip past maintenance
 * mode. Includes a few likely future routes so they stay available.
 */
const RESERVED_SLUGS = new Set([
	"about",
	"admin",
	"api",
	"app",
	"auth",
	"blog",
	"contact",
	"dashboard",
	"docs",
	"favicon-ico",
	"forgot-password",
	"help",
	"icons",
	"login",
	"logout",
	"maintenance",
	"manifest",
	"onboarding",
	"pricing",
	"privacy",
	"refunds",
	"register",
	"reset-password",
	"robots",
	"signup",
	"sitemap",
	"staff",
	"static",
	"super-admin",
	"support",
	"sw",
	"terms",
	"verify-email",
	"www",
]);

export function isReservedSlug(slug: string): boolean {
	return RESERVED_SLUGS.has(slug.toLowerCase());
}
