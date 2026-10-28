import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { PaymentsTable } from "@/components/super-admin/PaymentsTable";
import { Pagination } from "@/components/ui/Pagination";
import { db } from "@/lib/db";
import { clampPage, pageInfo, parsePage, withQuery } from "@/lib/pagination";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const METHOD_LABEL: Record<string, string> = {
	BANK_TRANSFER: "Bank transfer",
	CASH: "Cash",
	COMPLIMENTARY: "Complimentary",
};

const FILTERS = [
	{ key: "", label: "All" },
	{ key: "SUCCESS", label: "Paid" },
	{ key: "MISMATCH", label: "Needs review" },
	{ key: "offline", label: "Recorded offline" },
] as const;

/**
 * Subscription charges as they actually landed, from the SubscriptionPayment
 * ledger. This used to list subscriptions with their plan's *list* price, which
 * showed what a restaurant would pay, not what anyone had paid.
 */
export default async function SuperAdminPaymentsPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | undefined>>;
}) {
	const params = await searchParams;
	const filter = FILTERS.some((f) => f.key === params.show) ? params.show : "";
	const where: Prisma.SubscriptionPaymentWhereInput =
		filter === "offline"
			? { method: { not: null } }
			: filter === "SUCCESS" || filter === "MISMATCH"
				? { status: filter }
				: {};

	const [total, paidSum] = await Promise.all([
		db.subscriptionPayment.count({ where }),
		db.subscriptionPayment.aggregate({
			where: { ...where, status: "SUCCESS" },
			_sum: { amount: true },
		}),
	]);
	const page = clampPage(parsePage(params), total);
	const payments = await db.subscriptionPayment.findMany({
		where,
		orderBy: { createdAt: "desc" },
		skip: page.skip,
		take: page.take,
		select: {
			id: true,
			amount: true,
			status: true,
			method: true,
			createdAt: true,
			planId: true,
			restaurantId: true,
			subscriptionId: true,
		},
	});

	// The ledger keeps plain ids so it survives deletions; names are looked up
	// for display, and a missing one reads as such rather than failing.
	const [plans, restaurants, subscriptions] = await Promise.all([
		db.plan.findMany({
			where: { id: { in: [...new Set(payments.map((p) => p.planId))] } },
			select: { id: true, name: true },
		}),
		db.restaurant.findMany({
			where: {
				id: {
					in: [
						...new Set(
							payments
								.map((p) => p.restaurantId)
								.filter((id): id is string => Boolean(id)),
						),
					],
				},
			},
			select: { id: true, name: true },
		}),
		// An onboarding charge is paid before the restaurant exists; its
		// subscription is attached to the restaurant afterwards.
		db.subscription.findMany({
			where: {
				id: {
					in: payments
						.filter((p) => !p.restaurantId && p.subscriptionId)
						.map((p) => p.subscriptionId as string),
				},
			},
			select: { id: true, restaurant: { select: { name: true } } },
		}),
	]);
	const subscriptionRestaurant = new Map(
		subscriptions.map((sub) => [sub.id, sub.restaurant?.name ?? null]),
	);
	const planName = new Map(plans.map((plan) => [plan.id, plan.name]));
	const restaurantName = new Map(restaurants.map((r) => [r.id, r.name]));

	return (
		<div className="grid gap-6">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
						Payments
					</h1>
					<p className="mt-1 text-sm font-medium text-slate-600">
						Subscription charges across all restaurants
						{filter
							? ""
							: `: ₦${Number(paidSum._sum.amount ?? 0).toLocaleString()} received in total`}
						.
					</p>
				</div>
				<nav aria-label="Filter payments" className="flex flex-wrap gap-1.5">
					{FILTERS.map((f) => (
						<Link
							key={f.key}
							href={withQuery("/super-admin/payments", params, {
								show: f.key || null,
								page: null,
							})}
							aria-current={filter === f.key ? "page" : undefined}
							className={cn(
								"rounded-full border px-3 py-1.5 text-xs font-bold",
								filter === f.key
									? "border-slate-900 bg-slate-900 text-white"
									: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
							)}
						>
							{f.label}
						</Link>
					))}
				</nav>
			</div>

			<PaymentsTable
				payments={payments.map((payment) => ({
					id: payment.id,
					restaurantName: payment.restaurantId
						? (restaurantName.get(payment.restaurantId) ?? "Deleted restaurant")
						: ((payment.subscriptionId &&
								subscriptionRestaurant.get(payment.subscriptionId)) ??
							"Onboarding"),
					planName: `${planName.get(payment.planId) ?? "Deleted plan"}${
						payment.method
							? ` · ${METHOD_LABEL[payment.method] ?? payment.method}`
							: ""
					}`,
					amount: Number(payment.amount),
					status: payment.status,
					paidAt: payment.createdAt.toISOString(),
				}))}
			/>
			<Pagination
				info={pageInfo(page, total)}
				basePath="/super-admin/payments"
				query={params}
				noun="payments"
			/>
		</div>
	);
}
