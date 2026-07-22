import type { CSSProperties } from "react";

/**
 * Builds the CSS custom-property overrides that recolor every `emerald-*`
 * Tailwind utility to the restaurant's chosen brand color. Must cover every
 * shade actually used in the app (50–950) — missing a shade here means any
 * component using it silently ignores the admin's color choice.
 */
export function getThemeStyle(
	primaryColor: string | null | undefined,
): CSSProperties | undefined {
	if (!primaryColor) return undefined;

	return {
		"--color-emerald-50": `color-mix(in oklab, ${primaryColor} 10%, white)`,
		"--color-emerald-100": `color-mix(in oklab, ${primaryColor} 20%, white)`,
		"--color-emerald-200": `color-mix(in oklab, ${primaryColor} 35%, white)`,
		"--color-emerald-300": `color-mix(in oklab, ${primaryColor} 50%, white)`,
		"--color-emerald-400": `color-mix(in oklab, ${primaryColor} 65%, white)`,
		"--color-emerald-500": `color-mix(in oklab, ${primaryColor} 80%, white)`,
		"--color-emerald-600": `color-mix(in oklab, ${primaryColor} 90%, white)`,
		"--color-emerald-700": primaryColor,
		"--color-emerald-800": `color-mix(in oklab, ${primaryColor} 80%, black)`,
		"--color-emerald-900": `color-mix(in oklab, ${primaryColor} 60%, black)`,
		"--color-emerald-950": `color-mix(in oklab, ${primaryColor} 45%, black)`,
	} as CSSProperties;
}
