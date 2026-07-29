import { RestaurantTable } from "@/components/super-admin/RestaurantTable";
import { db } from "@/lib/db";

export default async function SuperAdminRestaurantsPage({
	searchParams,
}: {
	searchParams: Promise<{ q?: string }>;
}) {
	const { q } = await searchParams;
	const query = q?.trim();

	const restaurants = await db.restaurant.findMany({
		where: query
			? {
					OR: [
						{ name: { contains: query, mode: "insensitive" } },
						{ slug: { contains: query, mode: "insensitive" } },
					],
				}
			: undefined,
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			name: true,
			slug: true,
			isActive: true,
			createdAt: true,
			owner: { select: { email: true } },
			subscription: { select: { plan: { select: { name: true } } } },
		},
		take: 100,
	});

	return (
		<div className="grid gap-6">
			<div>
				<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
					Restaurants
				</h1>
				<p className="mt-1 text-sm font-medium text-slate-600">
					Search, activate/deactivate, and view restaurant details.
				</p>
			</div>
			<form className="flex gap-2">
				<input
					type="text"
					name="q"
					defaultValue={query ?? ""}
					placeholder="Search by name or slug..."
					className="h-11 w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
				/>
				<button
					type="submit"
					className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
				>
					Search
				</button>
			</form>
			<RestaurantTable
				restaurants={restaurants.map((r) => ({
					id: r.id,
					name: r.name,
					slug: r.slug,
					isActive: r.isActive,
					ownerEmail: r.owner.email,
					planName: r.subscription?.plan.name ?? "No Plan",
					createdAt: r.createdAt.toISOString(),
				}))}
			/>
		</div>
	);
}
