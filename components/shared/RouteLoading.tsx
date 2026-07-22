type RouteLoadingProps = {
	/** "page" — full-screen skeleton (public customer routes).
	 *  "panel" — fits inside an existing dashboard/staff/admin shell. */
	variant?: "page" | "panel";
};

/**
 * Shared route-level loading skeleton. Each route's `loading.tsx` is a thin
 * wrapper around this so the fallback UI stays visually consistent across
 * the app instead of every route hand-rolling its own.
 */
export function RouteLoading({ variant = "page" }: RouteLoadingProps) {
	const skeleton = (
		<div className="mx-auto max-w-lg animate-pulse space-y-4">
			<div className="h-7 w-2/3 rounded-xl bg-slate-200" />
			<div className="h-36 rounded-3xl border border-slate-100 bg-white shadow-sm" />
			<div className="h-24 rounded-3xl border border-slate-100 bg-white shadow-sm" />
			<div className="h-24 rounded-3xl border border-slate-100 bg-white shadow-sm" />
		</div>
	);

	if (variant === "panel") {
		return <div className="py-6">{skeleton}</div>;
	}

	return (
		<main className="min-h-screen bg-[#f6faf7] px-4 py-8">{skeleton}</main>
	);
}
