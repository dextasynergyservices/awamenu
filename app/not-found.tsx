import Link from "next/link";

export default function NotFoundPage() {
	return (
		<main className="min-h-screen bg-[#f6faf7] px-4 py-8 text-slate-950">
			<section className="mx-auto max-w-lg rounded-3xl border border-emerald-100 bg-white p-5 text-center shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
				<p className="text-sm font-black uppercase tracking-wide text-emerald-700">
					Page not found
				</p>
				<h1 className="mt-3 text-2xl font-black">
					We could not find that page
				</h1>
				<p className="mt-3 text-sm font-bold leading-6 text-slate-600">
					The link may be wrong, expired, or unavailable. Please check the code
					or go back to the restaurant page and try again.
				</p>
				<Link
					href="/"
					className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-black text-white"
				>
					Go home
				</Link>
			</section>
		</main>
	);
}
