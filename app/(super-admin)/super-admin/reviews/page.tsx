import { ReviewsTable } from "@/components/super-admin/ReviewsTable";
import { db } from "@/lib/db";

export default async function SuperAdminReviewsPage({
	searchParams,
}: {
	searchParams: Promise<{ q?: string }>;
}) {
	const { q } = await searchParams;
	const query = q?.trim();

	const [totalReviews, ratingAgg, reviews] = await Promise.all([
		db.rating.count(),
		db.rating.aggregate({ _avg: { overallRating: true } }),
		db.rating.findMany({
			where: query
				? { restaurant: { name: { contains: query, mode: "insensitive" } } }
				: undefined,
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				overallRating: true,
				comment: true,
				customerName: true,
				isHidden: true,
				createdAt: true,
				restaurant: { select: { name: true } },
			},
			take: 100,
		}),
	]);

	const averageRating = ratingAgg._avg.overallRating ?? 0;

	return (
		<div className="grid gap-6">
			<div>
				<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
					Reviews & Ratings
				</h1>
				<p className="mt-1 text-sm font-medium text-slate-600">
					Monitor feedback across all restaurants.
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="rounded-2xl border border-slate-100 bg-white p-5">
					<p className="text-xs font-black uppercase tracking-wide text-slate-500">
						Total Reviews
					</p>
					<p className="mt-2 text-2xl font-black text-slate-950">
						{totalReviews.toLocaleString()}
					</p>
				</div>
				<div className="rounded-2xl border border-slate-100 bg-white p-5">
					<p className="text-xs font-black uppercase tracking-wide text-slate-500">
						Average Rating
					</p>
					<p className="mt-2 text-2xl font-black text-slate-950">
						{totalReviews > 0
							? `${averageRating.toFixed(1)} ★`
							: "No ratings yet"}
					</p>
				</div>
			</div>

			<form className="flex gap-2">
				<input
					type="text"
					name="q"
					defaultValue={query ?? ""}
					placeholder="Search by restaurant..."
					className="h-11 w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
				/>
				<button
					type="submit"
					className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
				>
					Search
				</button>
			</form>

			<ReviewsTable
				reviews={reviews.map((review) => ({
					id: review.id,
					restaurantName: review.restaurant.name,
					overallRating: review.overallRating,
					comment: review.comment,
					customerName: review.customerName,
					isHidden: review.isHidden,
					createdAt: review.createdAt.toISOString(),
				}))}
			/>
		</div>
	);
}
