import { format } from "date-fns";
import { CheckCircle2, Cpu, UserCircle2, X } from "lucide-react";

export type OrderEventDTO = {
	id: string;
	description: string;
	isAutomatic: boolean;
	createdAt: Date;
	staff: { name: string; staffId?: string | null } | null;
};

interface OrderTimelineProps {
	events: OrderEventDTO[];
	showHeader?: boolean;
	fallback?: {
		createdAt: string | Date;
		status: string;
		paymentStatus: string;
		paymentMethod?: string | null;
		attendingStaff?: { name: string; staffId?: string | null } | null;
	};
}

export function OrderTimeline({
	events,
	showHeader = true,
	fallback,
}: OrderTimelineProps) {
	let displayEvents = events || [];

	// Synthesize events for old orders that lack timeline records
	if (displayEvents.length === 0 && fallback) {
		const baseDate = new Date(fallback.createdAt);
		displayEvents = [
			{
				id: "fallback-placed",
				description: "Order placed by customer",
				isAutomatic: true,
				createdAt: baseDate,
				staff: null,
			},
		];

		if (fallback.paymentStatus === "PAID") {
			let paymentDesc = "Payment confirmed";
			if (fallback.paymentMethod) {
				const methodStr =
					fallback.paymentMethod === "CASH"
						? "Cash"
						: fallback.paymentMethod === "POS"
							? "POS"
							: fallback.paymentMethod === "TRANSFER"
								? "Transfer"
								: fallback.paymentMethod;
				paymentDesc = `Recorded ${methodStr} payment`;
			}

			displayEvents.push({
				id: "fallback-paid",
				description: paymentDesc,
				isAutomatic: false, // fallback payment is usually manual if staff is present
				createdAt: new Date(baseDate.getTime() + 1000), // add 1 second for visual ordering
				staff: fallback.attendingStaff || null,
			});
		}

		if (
			fallback.status !== "PENDING" &&
			fallback.status !== "PENDING_APPROVAL"
		) {
			displayEvents.push({
				id: "fallback-status",
				description: `Status changed to ${fallback.status.replace(/_/g, " ")}`,
				isAutomatic: false,
				createdAt: new Date(baseDate.getTime() + 2000), // add 2 seconds
				staff: fallback.attendingStaff || null,
			});
		}

		// Sort descending (newest first)
		displayEvents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
	}

	if (!displayEvents || displayEvents.length === 0) {
		return (
			<div
				className={
					showHeader
						? "rounded-xl border border-slate-100 bg-slate-50/50 p-5 mt-4"
						: ""
				}
			>
				{showHeader && (
					<h3 className="mb-4 text-sm font-black text-slate-800">
						Order Timeline
					</h3>
				)}
				<p className="text-xs font-semibold text-slate-500">
					No events recorded for this order yet.
				</p>
			</div>
		);
	}

	return (
		<div
			className={
				showHeader
					? "rounded-xl border border-slate-100 bg-slate-50/50 p-5 mt-4"
					: ""
			}
		>
			{showHeader && (
				<h3 className="mb-4 text-sm font-black text-slate-800">
					Order Timeline
				</h3>
			)}
			<div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
				{displayEvents.map((event) => (
					<div
						key={event.id}
						className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
					>
						<div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
							{event.isAutomatic ? (
								<Cpu className="size-4" />
							) : event.staff ? (
								<UserCircle2 className="size-4" />
							) : (
								<CheckCircle2 className="size-4" />
							)}
						</div>

						<div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
							<div className="mb-1 flex items-center justify-between">
								<p className="text-xs font-black text-slate-800">
									{event.isAutomatic
										? "System"
										: event.staff
											? `${event.staff.name} ${event.staff.staffId ? `(#${event.staff.staffId})` : ""}`
											: "System"}
								</p>
								<time className="text-[10px] font-semibold text-slate-500">
									{format(new Date(event.createdAt), "MMM d, h:mm a")}
								</time>
							</div>
							<p className="text-xs font-medium text-slate-600">
								{event.description}
							</p>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

interface OrderTimelineModalProps {
	events: OrderEventDTO[];
	fallback?: {
		createdAt: string | Date;
		status: string;
		paymentStatus: string;
		paymentMethod?: string | null;
		attendingStaff?: { name: string; staffId?: string | null } | null;
	};
	onClose: () => void;
}

export function OrderTimelineModal({
	events,
	fallback,
	onClose,
}: OrderTimelineModalProps) {
	return (
		<div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
			<div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
				<div className="flex items-center justify-between border-b border-slate-100 p-4 shrink-0">
					<h2 className="text-sm font-black text-slate-950">Order Timeline</h2>
					<button
						type="button"
						onClick={onClose}
						className="grid size-8 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
					>
						<X className="size-4" />
					</button>
				</div>
				<div className="p-4 overflow-y-auto min-h-32">
					<OrderTimeline
						events={events}
						fallback={fallback}
						showHeader={false}
					/>
				</div>
			</div>
		</div>
	);
}
