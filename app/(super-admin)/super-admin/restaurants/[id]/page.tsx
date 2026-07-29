import { OrderStatus } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
	assignRestaurantPlanAction,
	toggleRestaurantActiveAction,
} from "@/actions/super-admin.actions";
import { ChangePlanButton } from "@/components/super-admin/ChangePlanButton";
import { SubmitButton } from "@/components/ui/action-button";
import { db } from "@/lib/db";

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

function formatDate(value: Date | null) {
	if (!value) return "—";
	return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
		value,
	);
}

function Stat({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
			<p className="text-[11px] font-black uppercase tracking-wide text-slate-500 sm:text-xs">
				{label}
			</p>
			<p className="mt-1 text-lg font-black text-slate-950 sm:mt-2 sm:text-xl">
				{value}
			</p>
		</div>
	);
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-3">
			<span className="text-sm font-medium text-slate-500">{label}</span>
			<span className="text-sm font-black text-slate-900">{value}</span>
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
			phone: true,
			address: true,
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

	const [revenueAgg, plans, menuItemCount, categoryCount, lastOrder] =
		await Promise.all([
			db.order.aggregate({
				where: { restaurantId: restaurant.id, status: OrderStatus.COMPLETED },
				_sum: { total: true },
			}),
			db.plan.findMany({
				where: { isActive: true },
				orderBy: { monthlyPrice: "asc" },
			}),
			db.menuItem.count({
				where: { category: { restaurantId: restaurant.id } },
			}),
			db.menuCategory.count({ where: { restaurantId: restaurant.id } }),
			db.order.findFirst({
				where: { restaurantId: restaurant.id },
				orderBy: { createdAt: "desc" },
				select: { createdAt: true },
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

			<div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
				<h2 className="mb-3 text-sm font-black text-slate-800 sm:mb-4">
					Status
				</h2>
				<div className="flex items-center justify-between gap-2">
					<span
						className={`rounded-full px-2.5 py-1 text-[11px] font-black sm:px-3 sm:text-xs ${
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
							className={`inline-flex h-11 items-center justify-center rounded-lg px-4 text-xs font-black md:h-9 ${
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

			<div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
				<div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
					<h2 className="mb-3 text-sm font-black text-slate-800 sm:mb-4">
						Restaurant
					</h2>
					<div className="grid gap-2">
						<InfoRow label="Name" value={restaurant.name} />
						<InfoRow label="Contact" value={restaurant.phone ?? "—"} />
						<InfoRow label="Address" value={restaurant.address ?? "—"} />
					</div>
				</div>

				<div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
					<h2 className="mb-3 text-sm font-black text-slate-800 sm:mb-4">
						Owner
					</h2>
					<div className="grid gap-2">
						<InfoRow label="Name" value={restaurant.owner.name ?? "Unnamed"} />
						<InfoRow label="Email" value={restaurant.owner.email} />
					</div>
				</div>
			</div>

			<div className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5">
				<h2 className="mb-3 text-sm font-black text-slate-800 sm:mb-4">
					Subscription
				</h2>
				<div className="mb-4 grid gap-2">
					<InfoRow
						label="Current Plan"
						value={restaurant.subscription?.plan.name ?? "No Plan"}
					/>
					<InfoRow
						label="Status"
						value={restaurant.subscription?.status ?? "—"}
					/>
					<InfoRow
						label="Renewal Date"
						value={formatDate(
							restaurant.subscription?.currentPeriodEnd ?? null,
						)}
					/>
				</div>

				<ChangePlanButton
					restaurantId={restaurant.id}
					currentPlanId={restaurant.subscription?.plan.id}
					currentPlanName={restaurant.subscription?.plan.name ?? "No Plan"}
					plans={plans.map((plan) => ({ id: plan.id, name: plan.name }))}
				/>

				<form
					action={assignRestaurantPlanAction}
					className="hidden flex-wrap gap-2 md:flex"
				>
					<input type="hidden" name="restaurantId" value={restaurant.id} />
					<select
						name="planId"
						defaultValue={restaurant.subscription?.plan.id ?? ""}
						required
						className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
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
						Change Plan
					</SubmitButton>
				</form>
			</div>

			<div>
				<h2 className="mb-3 text-sm font-black text-slate-800">Usage</h2>
				<div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
					<Stat label="Menu Items" value={menuItemCount.toLocaleString()} />
					<Stat label="Categories" value={categoryCount.toLocaleString()} />
					<Stat
						label="Orders"
						value={restaurant._count.orders.toLocaleString()}
					/>
					<Stat
						label="Last Active"
						value={
							lastOrder ? formatDate(lastOrder.createdAt) : "No orders yet"
						}
					/>
				</div>
			</div>

			<div>
				<h2 className="mb-3 text-sm font-black text-slate-800">
					Additional Stats
				</h2>
				<div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
					<Stat
						label="Revenue"
						value={formatMoney(
							Number(revenueAgg._sum.total ?? 0),
							restaurant.currency,
						)}
					/>
					<Stat
						label="Staff"
						value={restaurant._count.staff.toLocaleString()}
					/>
					<Stat
						label="Ratings"
						value={restaurant._count.ratings.toLocaleString()}
					/>
				</div>
			</div>
		</div>
	);
}
