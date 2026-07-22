import { OrderStatus } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
	assignRestaurantPlanAction,
	toggleRestaurantActiveAction,
} from "@/actions/super-admin.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { db } from "@/lib/db";

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-slate-100 bg-white p-5">
			<p className="text-xs font-black uppercase tracking-wide text-slate-500">
				{label}
			</p>
			<p className="mt-2 text-xl font-black text-slate-950">{value}</p>
		</div>
	);
}

export default async function SuperAdminRestaurantDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	const restaurant = await db.restaurant.findUnique({
		where: { id },
		select: {
			id: true,
			name: true,
			slug: true,
			isActive: true,
			currency: true,
			createdAt: true,
			owner: { select: { name: true, email: true } },
			subscription: {
				select: {
					status: true,
					currentPeriodEnd: true,
					plan: { select: { id: true, name: true } },
				},
			},
			_count: { select: { orders: true, staff: true, ratings: true } },
		},
	});

	if (!restaurant) notFound();

	const [revenueAgg, plans] = await Promise.all([
		db.order.aggregate({
			where: { restaurantId: restaurant.id, status: OrderStatus.COMPLETED },
			_sum: { total: true },
		}),
		db.plan.findMany({
			where: { isActive: true },
			orderBy: { monthlyPrice: "asc" },
		}),
	]);

	return (
		<div className="grid max-w-3xl gap-6">
			<div>
				<Link
					href="/super-admin/restaurants"
					className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900"
				>
					<ArrowLeft className="size-3.5" /> Back to Restaurants
				</Link>
				<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
					{restaurant.name}
				</h1>
				<p className="mt-1 text-sm font-medium text-slate-500">
					/{restaurant.slug} · Owned by{" "}
					{restaurant.owner.name ?? restaurant.owner.email}
				</p>
			</div>

			<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
				<Stat
					label="Orders"
					value={restaurant._count.orders.toLocaleString()}
				/>
				<Stat
					label="Revenue"
					value={formatMoney(
						Number(revenueAgg._sum.total ?? 0),
						restaurant.currency,
					)}
				/>
				<Stat label="Staff" value={restaurant._count.staff.toLocaleString()} />
				<Stat
					label="Ratings"
					value={restaurant._count.ratings.toLocaleString()}
				/>
			</div>

			<div className="rounded-2xl border border-slate-100 bg-white p-5">
				<h2 className="mb-4 text-sm font-black text-slate-800">Status</h2>
				<div className="flex items-center justify-between">
					<span
						className={`rounded-full px-3 py-1 text-xs font-black ${
							restaurant.isActive
								? "bg-emerald-100 text-emerald-700"
								: "bg-red-100 text-red-700"
						}`}
					>
						{restaurant.isActive ? "Active" : "Inactive"}
					</span>
					<form action={toggleRestaurantActiveAction}>
						<input type="hidden" name="restaurantId" value={restaurant.id} />
						<input
							type="hidden"
							name="isActive"
							value={(!restaurant.isActive).toString()}
						/>
						<SubmitButton
							loadingText="Updating..."
							successText="Updated"
							className={`inline-flex h-9 items-center justify-center rounded-lg px-4 text-xs font-black ${
								restaurant.isActive
									? "border border-red-100 bg-white text-red-600 hover:bg-red-50"
									: "bg-emerald-700 text-white hover:bg-emerald-800"
							}`}
						>
							{restaurant.isActive ? "Deactivate" : "Activate"}
						</SubmitButton>
					</form>
				</div>
			</div>

			<div className="rounded-2xl border border-slate-100 bg-white p-5">
				<h2 className="mb-4 text-sm font-black text-slate-800">
					Subscription Plan
				</h2>
				<p className="mb-4 text-sm font-medium text-slate-600">
					Current plan:{" "}
					<span className="font-black text-slate-900">
						{restaurant.subscription?.plan.name ?? "No Plan"}
					</span>
					{restaurant.subscription
						? ` · ${restaurant.subscription.status}`
						: ""}
				</p>
				<form
					action={assignRestaurantPlanAction}
					className="flex flex-wrap gap-2"
				>
					<input type="hidden" name="restaurantId" value={restaurant.id} />
					<select
						name="planId"
						defaultValue={restaurant.subscription?.plan.id ?? ""}
						required
						className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					>
						<option value="" disabled>
							Select a plan
						</option>
						{plans.map((plan) => (
							<option key={plan.id} value={plan.id}>
								{plan.name}
							</option>
						))}
					</select>
					<SubmitButton
						loadingText="Assigning..."
						successText="Assigned"
						className="inline-flex h-10 items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
					>
						Assign Plan
					</SubmitButton>
				</form>
			</div>
		</div>
	);
}
