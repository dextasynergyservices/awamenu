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
