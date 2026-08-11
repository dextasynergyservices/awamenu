/**
 * Fallback shown while `dashboard/[slug]/layout.tsx` itself is resolving.
 *
 * Deliberately brand-neutral. This boundary sits *above* the slug segment, so
 * it has no way to know whose dashboard is loading — it previously rendered the
 * generic AwaMenu loader, which meant every restaurant (including paid plans
 * that have branding removed) saw the AwaMenu logo first and their own logo
 * only afterwards, once the branded fallback below took over.
 *
 * A plain skeleton avoids showing the wrong brand at all while still giving
 * immediate feedback.
 */
export default function Loading() {
	return (
		<main className="min-h-screen bg-[#f6faf7] px-4 py-8">
			<div className="mx-auto w-full max-w-6xl animate-pulse space-y-6">
				<div className="flex items-center gap-3">
					<div className="size-11 rounded-2xl bg-slate-200" />
					<div className="space-y-2">
						<div className="h-4 w-40 rounded-full bg-slate-200" />
						<div className="h-3 w-24 rounded-full bg-slate-100" />
					</div>
				</div>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{[0, 1, 2, 3].map((cell) => (
						<div
							key={cell}
							className="h-24 rounded-3xl border border-slate-100 bg-white shadow-sm"
						/>
					))}
				</div>
				<div className="h-64 rounded-3xl border border-slate-100 bg-white shadow-sm" />
			</div>
		</main>
	);
}
