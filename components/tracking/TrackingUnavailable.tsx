import Link from "next/link";

type TrackingUnavailableProps = {
	restaurantSlug?: string;
	trackingCode?: string;
	type?: "order" | "reservation" | "tracking";
};

export function TrackingUnavailable({
	restaurantSlug,
	trackingCode,
	type = "tracking",
}: TrackingUnavailableProps) {
	const label =
		type === "order"
			? "order"
			: type === "reservation"
				? "reservation"
				: "tracking";
	const homeHref = restaurantSlug ? `/${restaurantSlug}` : "/";

	return (
		<main className="min-h-screen bg-[#f6faf7] px-4 py-8 text-slate-950">
			<section className="mx-auto max-w-lg rounded-3xl border border-emerald-100 bg-white p-5 text-center shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
				<p className="text-sm font-black uppercase tracking-wide text-emerald-700">
					{label} not found
				</p>
				<h1 className="mt-3 text-2xl font-black">
					We could not find that code
				</h1>
				<p className="mt-3 text-sm font-bold leading-6 text-slate-600">
					Please check the number and try again. It may have been typed
					incorrectly, or it may not be available in this restaurant yet.
				</p>
				{trackingCode ? (
					<p className="mt-4 break-all rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-600">
						Entered code: {trackingCode}
					</p>
				) : null}
				<div className="mt-5 grid gap-2 sm:grid-cols-2">
					<Link
						href={homeHref}
						className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white"
					>
						Try another code
					</Link>
					<Link
						href="/"
						className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
					>
						Go home
					</Link>
				</div>
			</section>
		</main>
	);
}
