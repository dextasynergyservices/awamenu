"use client";

import {
	Ban,
	Bike,
	CheckCircle2,
	ChefHat,
	CircleDot,
	PackageCheck,
	ShoppingBag,
	ThumbsUp,
} from "lucide-react";
import { useRestaurantTimeZone } from "@/components/shared/RestaurantBrandContext";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";
import { formatClock, formatDay } from "@/lib/restaurant-time";
import { cn } from "@/lib/utils";

type When = Date | string | null | undefined;

/**
 * The times an order reached each stage, stamped by the database on every
 * status change (migration 8_order_status_times). Orders from before that
 * have only the time they were placed, and the timeline says so rather than
 * inventing times.
 */
export type OrderStageTimes = {
	type: string;
	status: string;
	createdAt: When;
	confirmedAt?: When;
	acceptedAt?: When;
	preparingAt?: When;
	readyAt?: When;
	deliveredAt?: When;
	completedAt?: When;
	cancelledAt?: When;
	attendingStaff?: { name: string; staffId?: string | null } | null;
};

const ms = (v: When) => (v ? new Date(v).getTime() : null);

function duration(from: When, to: When) {
	const a = ms(from);
	const b = ms(to);
	if (a === null || b === null || b < a) return null;
	const mins = Math.round((b - a) / 60_000);
	if (mins < 1) return "under a minute";
	if (mins < 60) return `${mins} min`;
	return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

function readyLabel(type: string) {
	if (type === "DELIVERY") return "Out for delivery";
	if (type === "PICKUP") return "Ready for pickup";
	if (type === "TABLE_RESERVATION") return "Table ready";
	return "Ready to serve";
}

export function OrderTimeline({ order }: { order: OrderStageTimes }) {
	const tz = useRestaurantTimeZone();
	const stages = [
		{
			key: "placed",
			label: "Order placed",
			at: order.createdAt,
			icon: ShoppingBag,
		},
		{
			key: "accepted",
			label: order.acceptedAt ? "Accepted" : "Confirmed",
			at: order.acceptedAt ?? order.confirmedAt,
			icon: ThumbsUp,
		},
		{
			key: "preparing",
			label: "Preparing",
			at: order.preparingAt,
			icon: ChefHat,
		},
		{
			key: "ready",
			label: readyLabel(order.type),
			at: order.readyAt,
			icon: PackageCheck,
		},
		{ key: "delivered", label: "Delivered", at: order.deliveredAt, icon: Bike },
		{
			key: "completed",
			label: "Completed",
			at: order.completedAt,
			icon: CheckCircle2,
		},
		{ key: "cancelled", label: "Cancelled", at: order.cancelledAt, icon: Ban },
	].filter((s) => s.at);

	const tracked =
		stages.length > 1 ||
		order.status === "PENDING_APPROVAL" ||
		order.status === "PENDING_PAYMENT";
	const sameDay = (v: When) =>
		v && formatDay(v, tz) === formatDay(order.createdAt ?? v, tz);

	const summary = [
		order.acceptedAt
			? ["Response", duration(order.createdAt, order.acceptedAt)]
			: null,
		order.readyAt
			? ["Prep", duration(order.confirmedAt ?? order.createdAt, order.readyAt)]
			: null,
		order.deliveredAt
			? ["Delivery", duration(order.readyAt, order.deliveredAt)]
			: null,
		order.type === "PICKUP" && order.completedAt && order.readyAt
			? ["Waited at counter", duration(order.readyAt, order.completedAt)]
			: null,
	].filter((s): s is [string, string] => Boolean(s?.[1]));

	return (
		<div className="grid gap-4">
			{summary.length ? (
				<dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
					{summary.map(([label, value]) => (
						<div key={label} className="rounded-xl bg-slate-50 px-3 py-2">
							<dt className="text-[11px] font-bold text-slate-500">{label}</dt>
							<dd className="text-sm font-black text-slate-950">{value}</dd>
						</div>
					))}
				</dl>
			) : null}

			<ol className="relative grid gap-0">
				{stages.map((stage, i) => {
					const Icon = stage.icon;
					const prev = stages[i - 1];
					const gap = prev ? duration(prev.at, stage.at) : null;
					const last = i === stages.length - 1;
					return (
						<li
							key={stage.key}
							className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3"
						>
							<div className="flex flex-col items-center">
								<span
									className={cn(
										"grid size-8 place-items-center rounded-full",
										stage.key === "cancelled"
											? "bg-red-50 text-red-600"
											: "bg-emerald-50 text-emerald-700",
									)}
								>
									<Icon className="size-4" aria-hidden="true" />
								</span>
								{!last ? <span className="w-px flex-1 bg-slate-200" /> : null}
							</div>
							<div className={cn("min-w-0", !last && "pb-4")}>
								<div className="flex items-baseline justify-between gap-2">
									<p className="text-sm font-black text-slate-900">
										{stage.label}
									</p>
									<time className="shrink-0 text-xs font-semibold text-slate-500">
										{stage.at ? formatClock(stage.at, tz) : ""}
										{stage.at && !sameDay(stage.at)
											? ` · ${formatDay(stage.at, tz)}`
											: ""}
									</time>
								</div>
								{gap ? (
									<p className="text-xs font-medium text-slate-500">
										{gap} after the previous step
									</p>
								) : stage.key === "placed" && order.attendingStaff ? (
									<p className="text-xs font-medium text-slate-500">
										Attended by {order.attendingStaff.name}
									</p>
								) : null}
							</div>
						</li>
					);
				})}
				{!tracked ? (
					<li className="flex items-center gap-2 pt-2 text-xs font-medium text-slate-500">
						<CircleDot className="size-3.5" aria-hidden="true" />
						Older order: only the time it was placed was recorded.
					</li>
				) : null}
			</ol>
		</div>
	);
}

export function OrderTimelineModal({
	order,
	onClose,
}: {
	order: OrderStageTimes;
	onClose: () => void;
}) {
	return (
		<Dialog
			open
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			size="md"
		>
			<DialogHeader title="Order timeline" bordered className="p-4" />
			<DialogBody className="min-h-32 p-4">
				<OrderTimeline order={order} />
			</DialogBody>
		</Dialog>
	);
}
