import Link from "next/link";
import { toggleRestaurantActiveAction } from "@/actions/super-admin.actions";
import { SubmitButton } from "@/components/ui/action-button";

type RestaurantRow = {
	id: string;
	name: string;
	slug: string;
	isActive: boolean;
	ownerEmail: string;
	planName: string;
	createdAt: string;
};

export function RestaurantTable({
	restaurants,
}: {
	restaurants: RestaurantRow[];
}) {
	if (restaurants.length === 0) {
		return (
			<div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm font-medium text-slate-500">
				No restaurants found.
			</div>
		);
	}

	return (
		<div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
			<table className="w-full min-w-[720px] text-left text-sm">
				<thead>
					<tr className="border-b border-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
						<th className="p-4">Restaurant</th>
						<th className="p-4">Owner</th>
						<th className="p-4">Plan</th>
						<th className="p-4">Status</th>
						<th className="p-4">Joined</th>
						<th className="p-4">Actions</th>
					</tr>
				</thead>
				<tbody>
					{restaurants.map((restaurant) => (
						<tr
							key={restaurant.id}
							className="border-b border-slate-50 last:border-0"
						>
							<td className="p-4">
								<Link
									href={`/super-admin/restaurants/${restaurant.id}`}
									className="font-black text-slate-900 hover:text-emerald-700"
								>
									{restaurant.name}
								</Link>
								<p className="text-xs font-medium text-slate-400">
									/{restaurant.slug}
								</p>
							</td>
							<td className="p-4 font-medium text-slate-600">
								{restaurant.ownerEmail}
							</td>
							<td className="p-4 font-semibold text-slate-700">
								{restaurant.planName}
							</td>
							<td className="p-4">
								<span
									className={`rounded-full px-2.5 py-1 text-xs font-black ${
										restaurant.isActive
											? "bg-emerald-100 text-emerald-700"
											: "bg-red-100 text-red-700"
									}`}
								>
									{restaurant.isActive ? "Active" : "Inactive"}
								</span>
							</td>
							<td className="p-4 font-medium text-slate-500">
								{new Date(restaurant.createdAt).toLocaleDateString()}
							</td>
							<td className="p-4">
								<form action={toggleRestaurantActiveAction}>
									<input
										type="hidden"
										name="restaurantId"
										value={restaurant.id}
									/>
									<input
										type="hidden"
										name="isActive"
										value={(!restaurant.isActive).toString()}
									/>
									<SubmitButton
										loadingText="Updating..."
										successText="Updated"
										className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-black ${
											restaurant.isActive
												? "border border-red-100 bg-white text-red-600 hover:bg-red-50"
												: "bg-emerald-700 text-white hover:bg-emerald-800"
										}`}
									>
										{restaurant.isActive ? "Deactivate" : "Activate"}
									</SubmitButton>
								</form>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
