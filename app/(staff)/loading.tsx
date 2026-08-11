/**
 * Fallback while `[slug]/staff/layout.tsx` resolves the restaurant's branding.
 *
 * Deliberately brand-neutral: this boundary sits above the slug segment, so it
 * can't know whose staff area is loading. Without it the nearest boundary is
 * the root loader, which shows the AwaMenu logo — meaning staff at a paid
 * restaurant saw AwaMenu's mark before their employer's.
 */
export default function Loading() {
	return (
		<main className="min-h-screen bg-slate-50 px-4 py-8">
			<div className="mx-auto w-full max-w-3xl animate-pulse space-y-5">
				<div className="flex items-center gap-3">
					<div className="size-10 rounded-2xl bg-slate-200" />
					<div className="space-y-2">
						<div className="h-4 w-36 rounded-full bg-slate-200" />
						<div className="h-3 w-20 rounded-full bg-slate-100" />
					</div>
				</div>
				{[0, 1, 2].map((row) => (
					<div
						key={row}
						className="h-28 rounded-3xl border border-slate-100 bg-white shadow-sm"
					/>
				))}
			</div>
		</main>
	);
}
