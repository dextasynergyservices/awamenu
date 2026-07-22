"use client";

import { PaymentStatus, ReservationStatus } from "@prisma/client";
import {
	Check,
	ChevronRight,
	Clock3,
	Eye,
	Search,
	User,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
	approveReservationAction,
	cancelReservationAction,
	checkInReservationAction,
	checkOutReservationAction,
	declineReservationAction,
} from "@/actions/reservation.actions";
import { ReservationActionForm } from "@/components/reservation/ReservationActionForm";
import { SubmitButton } from "@/components/ui/action-button";
import { cn } from "@/lib/utils";

type ReservationPreOrderItem = {
	id: string;
	name: string;
	qty: number;
	unitPrice: string | number;
	notes: string | null;
};

type Reservation = {
	id: string;
	customerName: string;
	customerPhone: string;
	customerEmail: string | null;
	partySize: number;
	startsAt: Date | string;
	expiresAt: Date | string;
	status: ReservationStatus;
	effectiveBookingMode: string;
	effectivePaymentTiming: string;
	effectiveInclusionType: string;
	effectiveTableFee: number | null;
	reservationPaymentStatus: PaymentStatus;
	reservationAmountPaid: number | null;
	specialRequests: string | null;
	declineReason: string | null;
	table: { label: string; capacity: number };
	preOrder: {
		id: string;
		total: number | string;
		status: string;
		paymentStatus: string;
		items: ReservationPreOrderItem[];
	} | null;
};

type ReservationsListProps = {
	reservations: Reservation[];
	currency: string;
	slug: string;
};

function formatMoney(value: unknown, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(Number(value ?? 0));
}

function formatDate(value: Date | string) {
	const date = typeof value === "string" ? new Date(value) : value;
	return new Intl.DateTimeFormat("en-NG", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

function statusClass(status: ReservationStatus) {
	switch (status) {
		case ReservationStatus.PENDING_APPROVAL:
			return "bg-yellow-50 text-yellow-700";
		case ReservationStatus.APPROVED:
			return "bg-emerald-50 text-emerald-700";
		case ReservationStatus.ACTIVE:
			return "bg-emerald-50 text-emerald-700";
		case ReservationStatus.CHECKED_IN:
			return "bg-blue-50 text-blue-700";
		case ReservationStatus.DECLINED:
			return "bg-red-50 text-red-700";
		case ReservationStatus.CANCELLED:
			return "bg-red-50 text-red-700";
		case ReservationStatus.EXPIRED:
			return "bg-slate-100 text-slate-600";
		default:
			return "bg-slate-100 text-slate-600";
	}
}

function paymentClass(status: PaymentStatus) {
	return status === PaymentStatus.PAID
		? "bg-emerald-50 text-emerald-700"
		: "bg-yellow-50 text-yellow-700";
}

const mobileFilters = [
	{ value: "ALL", label: "All" },
	{ value: "PENDING", label: "Pending" },
	{ value: "ACTIVE", label: "Active" },
	{ value: "COMPLETED", label: "Completed" },
] as const;

type MobileFilter = (typeof mobileFilters)[number]["value"];

export function ReservationsList({
	reservations,
	currency,
	slug,
}: ReservationsListProps) {
	const [selectedReservationId, setSelectedReservationId] = useState<
		string | null
	>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [activeFilter, setActiveFilter] = useState<MobileFilter>("ALL");

	const selectedReservation = selectedReservationId
		? (reservations.find((r) => r.id === selectedReservationId) ?? null)
		: null;

	const filteredReservations = useMemo(() => {
		let list = reservations;

		if (activeFilter === "PENDING") {
			list = list.filter(
				(r) => r.status === ReservationStatus.PENDING_APPROVAL,
			);
		} else if (activeFilter === "ACTIVE") {
			const activeStatuses: ReservationStatus[] = [
				ReservationStatus.APPROVED,
				ReservationStatus.ACTIVE,
				ReservationStatus.CHECKED_IN,
			];
			list = list.filter((r) => activeStatuses.includes(r.status));
		} else if (activeFilter === "COMPLETED") {
			list = list.filter((r) => r.status === ReservationStatus.COMPLETED);
		}

		const query = searchTerm.trim().toLowerCase();
		if (query) {
			list = list.filter(
				(r) =>
					r.customerName.toLowerCase().includes(query) ||
					r.customerPhone.includes(query) ||
					(r.customerEmail?.toLowerCase().includes(query) ?? false) ||
					r.id.toLowerCase().includes(query),
			);
		}

		return list;
	}, [reservations, activeFilter, searchTerm]);

	return (
		<>
			{reservations.length > 0 ? (
				<div className="grid gap-2.5 md:hidden">
					<label className="flex min-h-10 items-center gap-2 rounded-[1rem] border border-slate-200 bg-white px-3 text-sm font-bold text-slate-500">
						<Search className="size-4 shrink-0" aria-hidden="true" />
						<input
							type="search"
							placeholder="Search reservations..."
							value={searchTerm}
							onChange={(event) => setSearchTerm(event.currentTarget.value)}
							className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
						/>
					</label>
					<div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
						{mobileFilters.map((filter) => (
							<button
								key={filter.value}
								type="button"
								onClick={() => setActiveFilter(filter.value)}
								className={cn(
									"shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
									activeFilter === filter.value
										? "border-emerald-700 bg-emerald-700 text-white"
										: "border-slate-200 bg-white text-slate-700",
								)}
							>
								{filter.label}
							</button>
						))}
					</div>
				</div>
			) : null}

			{reservations.length > 0 ? (
				<>
					{/* Mobile Card View */}
					<div className="grid gap-2.5 md:hidden">
						{filteredReservations.length > 0 ? (
							filteredReservations.map((reservation) => (
								<ReservationMobileCard
									key={reservation.id}
									reservation={reservation}
									currency={currency}
									onSelect={() => setSelectedReservationId(reservation.id)}
								/>
							))
						) : (
							<div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs font-bold text-slate-500">
								No reservations match your search.
							</div>
						)}
					</div>

					{/* Desktop Table View */}
					<div className="hidden md:block overflow-x-auto rounded-[24px] bg-white border border-slate-100 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
						<table className="w-full text-left text-xs md:text-sm whitespace-nowrap">
							<thead className="border-b border-slate-100 text-xs font-black text-slate-500 uppercase">
								<tr>
									<th className="px-2 md:px-6 py-3 md:py-5 tracking-wider hidden md:table-cell">
										CODE
									</th>
									<th className="px-2 md:px-6 py-3 md:py-5 tracking-wider">
										CUSTOMER
									</th>
									<th className="px-2 md:px-6 py-3 md:py-5 tracking-wider hidden md:table-cell">
										TABLE
									</th>
									<th className="px-2 md:px-6 py-3 md:py-5 tracking-wider">
										DATE &amp; TIME
									</th>
									<th className="px-2 md:px-6 py-3 md:py-5 tracking-wider hidden md:table-cell">
										GUESTS
									</th>
									<th className="px-2 md:px-6 py-3 md:py-5 tracking-wider">
										STATUS
									</th>
									<th className="px-2 md:px-6 py-3 md:py-5 tracking-wider hidden md:table-cell">
										AMOUNT
									</th>
									<th className="px-2 md:px-6 py-3 md:py-5 text-right"></th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100">
								{reservations.map((reservation) => {
									return (
										<tr
											key={reservation.id}
											onClick={() => setSelectedReservationId(reservation.id)}
											className="hover:bg-slate-50/50 transition-colors cursor-pointer group text-xs md:text-sm"
										>
											<td className="px-2 md:px-6 py-3 md:py-4 font-black text-slate-950 hidden md:table-cell">
												#{reservation.id.slice(-6).toUpperCase()}
											</td>
											<td className="px-2 md:px-6 py-3 md:py-4">
												<p className="font-bold text-slate-700 uppercase whitespace-normal wrap-break-words max-w-[100px] md:max-w-none">
													{reservation.customerName}
												</p>
												<p className="text-xs md:text-sm font-medium text-slate-500 mt-0.5 md:mt-1">
													{reservation.customerPhone}
												</p>
											</td>
											<td className="px-2 md:px-6 py-3 md:py-4 font-medium text-slate-700 hidden md:table-cell">
												{reservation.table.label}
											</td>
											<td className="px-2 md:px-6 py-3 md:py-4">
												<p className="font-medium text-slate-700 whitespace-nowrap">
													{formatDate(reservation.startsAt).split(",")[0]}
												</p>
												<p className="text-xs md:text-sm font-medium text-slate-500 mt-0.5 md:mt-1 whitespace-nowrap">
													{formatDate(reservation.startsAt)
														.split(",")[1]
														?.trim()}
												</p>
											</td>
											<td className="px-2 md:px-6 py-3 md:py-4 font-medium text-slate-700 hidden md:table-cell">
												{reservation.partySize}
											</td>
											<td className="px-2 md:px-6 py-3 md:py-4">
												<span
													className={`inline-flex rounded-full px-2 py-0.5 md:px-3 md:py-1 text-xs font-black whitespace-nowrap ${statusClass(reservation.status)}`}
												>
													{reservation.status.replaceAll("_", " ")}
												</span>
											</td>
											<td className="px-2 md:px-6 py-3 md:py-4 font-black text-slate-950 hidden md:table-cell">
												{formatMoney(
													reservation.reservationAmountPaid ?? 0,
													currency,
												)}
											</td>
											<td className="px-1 md:px-6 py-3 md:py-4 text-right">
												<ChevronRight
													className="size-3.5 md:size-5 text-slate-400 group-hover:text-slate-600 inline-block"
													aria-hidden="true"
												/>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				</>
			) : null}

			{selectedReservation && (
				<ReservationDetailsModal
					reservation={selectedReservation}
					currency={currency}
					slug={slug}
					onClose={() => setSelectedReservationId(null)}
				/>
			)}
		</>
	);
}

function ReservationMobileCard({
	reservation,
	currency,
	onSelect,
}: {
	reservation: Reservation;
	currency: string;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
		>
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-bold text-slate-950 uppercase">
					{reservation.customerName}
				</p>
				<p className="mt-0.5 truncate text-xs font-medium text-slate-500">
					{formatDate(reservation.startsAt)}
				</p>
				<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
					<span
						className={`inline-flex rounded-full px-2 py-0.5 text-xs font-black whitespace-nowrap ${statusClass(reservation.status)}`}
					>
						{reservation.status.replaceAll("_", " ")}
					</span>
					<span className="text-xs font-black text-slate-950">
						{formatMoney(reservation.reservationAmountPaid ?? 0, currency)}
					</span>
				</div>
			</div>
			<ChevronRight
				className="size-4 shrink-0 text-slate-400"
				aria-hidden="true"
			/>
		</button>
	);
}

function InfoCard({
	icon,
	title,
	children,
}: {
	icon: React.ReactNode;
	title: string;
	children: React.ReactNode;
}) {
	return (
		<div className="rounded-2xl border border-slate-100 p-4">
			<div className="mb-3 flex items-center gap-2 text-xs md:text-sm font-black text-slate-800">
				<span className="text-slate-500">{icon}</span>
				{title}
			</div>
			<div className="grid gap-1 text-xs md:text-sm font-semibold leading-6 text-slate-600">
				{children}
			</div>
		</div>
	);
}

function ReservationDetailsModal({
	reservation,
	currency,
	slug,
	onClose,
}: {
	reservation: Reservation;
	currency: string;
	slug: string;
	onClose: () => void;
}) {
	const canApprove = reservation.status === ReservationStatus.PENDING_APPROVAL;
	const canDecline =
		reservation.status === ReservationStatus.PENDING_APPROVAL ||
		reservation.status === ReservationStatus.APPROVED;
	const canCheckIn = reservation.status === ReservationStatus.ACTIVE;
	const canCheckOut = reservation.status === ReservationStatus.CHECKED_IN;
	const canCancel = reservation.status === ReservationStatus.ACTIVE;
	const totalFood = Number(reservation.preOrder?.total ?? 0);

	return (
		<div className="fixed inset-0 z-100 flex items-end justify-center md:items-center bg-slate-950/45 md:p-5 backdrop-blur-[2px]">
			<button
				type="button"
				aria-label="Close reservation details"
				className="absolute inset-0 cursor-default"
				onClick={onClose}
			/>
			<section className="relative z-10 grid max-h-[90vh] md:max-h-[88vh] w-full md:max-w-136 overflow-hidden rounded-t-[1.5rem] md:rounded-[1rem] bg-white shadow-2xl animate-in slide-in-from-bottom duration-300">
				<header className="relative px-6 pb-4 pt-6 md:px-7">
					<div className="pr-12 md:pr-16 flex flex-col md:flex-row md:items-start md:justify-between gap-5">
						<div className="min-w-0">
							<div className="flex flex-wrap items-center gap-2">
								<h2 className="text-sm md:text-2xl font-black text-slate-950">
									Reservation #{reservation.id.slice(-6).toUpperCase()}
								</h2>
								<span
									className={`rounded-full px-2 py-0.5 md:px-3 md:py-1 text-xs font-black ${statusClass(reservation.status)}`}
								>
									{reservation.status.replaceAll("_", " ")}
								</span>
								<span
									className={`rounded-full px-2 py-0.5 md:px-3 md:py-1 text-xs font-black ${paymentClass(reservation.reservationPaymentStatus)}`}
								>
									{reservation.reservationPaymentStatus}
								</span>
							</div>
							<p className="mt-3 flex items-start gap-2 text-xs font-semibold text-slate-500">
								<Clock3
									className="size-3.5 md:size-4 shrink-0 mt-0.5"
									aria-hidden="true"
								/>
								<span>Requested on {formatDate(reservation.startsAt)}</span>
							</p>
						</div>
						<div className="text-left md:text-right shrink-0">
							<p className="text-lg md:text-2xl font-black text-emerald-700">
								{formatMoney(
									Number(reservation.reservationAmountPaid ?? 0),
									currency,
								)}
							</p>
							<span className="mt-1 md:mt-2 inline-flex rounded-full px-2 py-0.5 md:px-3 md:py-1 text-xs font-black bg-slate-50 text-slate-700">
								Food: {formatMoney(totalFood, currency)}
							</span>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="absolute top-6 right-5 md:right-7 grid size-9 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-50"
					>
						<X className="size-5" aria-hidden="true" />
						<span className="sr-only">Close</span>
					</button>
				</header>

				<div className="grid max-h-[calc(88vh-6.25rem)] gap-4 overflow-y-auto px-7 pb-6 md:grid-cols-[18rem_minmax(0,1fr)]">
					<div className="grid content-start gap-4">
						<InfoCard
							icon={<User className="size-3.5 md:size-4" />}
							title="Customer Details"
						>
							<p>{reservation.customerName}</p>
							<p>{reservation.customerPhone || "No phone provided"}</p>
							{reservation.customerEmail && <p>{reservation.customerEmail}</p>}
							<p className="mt-1 font-bold text-emerald-700">
								Party of {reservation.partySize}
							</p>
						</InfoCard>

						<InfoCard
							icon={<Eye className="size-3.5 md:size-4" />}
							title="Reservation Policy"
						>
							<p>Starts: {formatDate(reservation.startsAt)}</p>
							<p>Expires: {formatDate(reservation.expiresAt)}</p>
							<p>
								Table: {reservation.table.label} (Capacity:{" "}
								{reservation.table.capacity})
							</p>
							<p>
								Policy: {reservation.effectiveBookingMode.replaceAll("_", " ")}
							</p>
							<p>
								Payment:{" "}
								{reservation.effectivePaymentTiming.replaceAll("_", " ")}
							</p>
							<p>
								Inclusion:{" "}
								{reservation.effectiveInclusionType.replaceAll("_", " ")}
							</p>
							<p>
								Table fee:{" "}
								{formatMoney(reservation.effectiveTableFee ?? 0, currency)}
							</p>
						</InfoCard>

						{reservation.preOrder?.items.length ? (
							<div className="rounded-2xl border border-slate-100 p-4">
								<div className="mb-3 flex items-center gap-2 text-xs md:text-sm font-black text-slate-800">
									<Check className="size-3.5 md:size-4 text-slate-500" />
									Pre-ordered Items ({reservation.preOrder.items.length})
								</div>
								<div className="grid gap-2">
									{reservation.preOrder.items.map((item) => (
										<div
											key={item.id}
											className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] md:grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-100 p-2"
										>
											<span className="grid size-10 md:size-12 place-items-center rounded-xl bg-emerald-50 text-xs font-black text-emerald-700">
												{item.qty}x
											</span>
											<span className="min-w-0">
												<span className="block text-xs md:text-sm font-black text-slate-950">
													{item.name}
												</span>
												{item.notes ? (
													<span className="mt-1 block text-xs font-semibold text-slate-500">
														{item.notes}
													</span>
												) : null}
											</span>
											<span className="text-xs md:text-sm font-black text-slate-950">
												{formatMoney(
													Number(item.unitPrice) * item.qty,
													currency,
												)}
											</span>
										</div>
									))}
								</div>
							</div>
						) : (
							<div className="rounded-2xl bg-slate-50 p-4 text-xs md:text-sm font-bold text-slate-500 text-center">
								No pre-ordered food items
							</div>
						)}
					</div>

					<div className="grid content-start gap-4">
						{reservation.specialRequests ? (
							<div className="rounded-2xl border border-yellow-100 bg-yellow-50 p-4 text-xs md:text-sm">
								<h3 className="mb-1 font-black text-yellow-800">Guest Note</h3>
								<p className="font-semibold text-yellow-700">
									{reservation.specialRequests}
								</p>
							</div>
						) : null}

						{reservation.declineReason ? (
							<div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-xs md:text-sm">
								<h3 className="mb-1 font-black text-red-800">Decline Reason</h3>
								<p className="font-semibold text-red-700">
									{reservation.declineReason}
								</p>
							</div>
						) : null}

						<div className="rounded-2xl border border-slate-100 p-4">
							<div className="mb-4 flex items-center gap-2 text-xs md:text-sm font-black text-slate-800">
								<User className="size-3.5 md:size-4 text-slate-500" />
								Reservation Actions
							</div>

							<div className="grid gap-3 md:gap-4">
								{canApprove && (
									<ReservationActionForm
										action={approveReservationAction}
										className="grid gap-2.5 md:gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3 md:p-4"
										onSuccess={onClose}
									>
										<h4 className="text-xs md:text-sm font-black text-emerald-900">
											Approve Request
										</h4>
										<p className="text-xs font-semibold text-emerald-700">
											This will confirm the table reservation and notify the
											customer.
										</p>
										<input type="hidden" name="slug" value={slug} />
										<input
											type="hidden"
											name="reservationId"
											value={reservation.id}
										/>
										<SubmitButton className="min-h-10 md:min-h-11 w-full rounded-xl bg-emerald-700 px-4 md:px-5 text-xs md:text-sm font-black text-white">
											Approve table
										</SubmitButton>
									</ReservationActionForm>
								)}

								{canDecline && (
									<ReservationActionForm
										action={declineReservationAction}
										className="grid gap-2.5 md:gap-3 rounded-2xl border border-red-100 bg-red-50/50 p-3 md:p-4"
										onSuccess={onClose}
									>
										<h4 className="text-xs md:text-sm font-black text-red-900">
											Decline Request
										</h4>
										<input type="hidden" name="slug" value={slug} />
										<input
											type="hidden"
											name="reservationId"
											value={reservation.id}
										/>
										<label className="grid gap-1">
											<span className="text-xs font-black text-red-800">
												Add note to decline
											</span>
											<textarea
												name="declineReason"
												defaultValue="This table is not available for the selected time. Please contact the restaurant so we can help you choose another table."
												className="min-h-20 md:min-h-24 w-full rounded-xl border border-red-100 bg-white p-2.5 md:p-3 text-base md:text-sm font-bold text-slate-700 outline-none focus:border-red-300"
											/>
										</label>
										<SubmitButton className="min-h-10 md:min-h-11 w-full rounded-xl border border-red-100 bg-white px-4 md:px-5 text-xs md:text-sm font-black text-red-700">
											Decline request
										</SubmitButton>
									</ReservationActionForm>
								)}

								{canCheckIn && (
									<ReservationActionForm
										action={checkInReservationAction}
										className="grid gap-2.5 md:gap-3 rounded-2xl border border-slate-100 p-3 md:p-4"
										onSuccess={onClose}
									>
										<h4 className="text-xs md:text-sm font-black text-slate-900">
											Guest Check-In
										</h4>
										<input type="hidden" name="slug" value={slug} />
										<input
											type="hidden"
											name="reservationId"
											value={reservation.id}
										/>
										<SubmitButton className="min-h-10 md:min-h-11 w-full rounded-xl bg-emerald-700 px-4 md:px-5 text-xs md:text-sm font-black text-white">
											Check in
										</SubmitButton>
									</ReservationActionForm>
								)}

								{canCheckOut && (
									<ReservationActionForm
										action={checkOutReservationAction}
										className="grid gap-2.5 md:gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-3 md:p-4"
										onSuccess={onClose}
									>
										<h4 className="text-xs md:text-sm font-black text-blue-900">
											Guest Check-Out
										</h4>
										<p className="text-xs font-semibold text-blue-700">
											Checking out the guest makes the table available for new
											bookings.
										</p>
										<input type="hidden" name="slug" value={slug} />
										<input
											type="hidden"
											name="reservationId"
											value={reservation.id}
										/>
										<SubmitButton className="min-h-10 md:min-h-11 w-full rounded-xl bg-blue-700 px-4 md:px-5 text-xs md:text-sm font-black text-white">
											Complete & Check out
										</SubmitButton>
									</ReservationActionForm>
								)}

								{canCancel && (
									<ReservationActionForm
										action={cancelReservationAction}
										className="grid gap-2.5 md:gap-3 rounded-2xl border border-slate-100 p-3 md:p-4"
										onSuccess={onClose}
									>
										<h4 className="text-xs md:text-sm font-black text-slate-900">
											Cancel Reservation
										</h4>
										<input type="hidden" name="slug" value={slug} />
										<input
											type="hidden"
											name="reservationId"
											value={reservation.id}
										/>
										<SubmitButton className="min-h-10 md:min-h-11 w-full rounded-xl border border-red-100 bg-red-50 px-4 md:px-5 text-xs md:text-sm font-black text-red-700">
											Cancel reservation
										</SubmitButton>
									</ReservationActionForm>
								)}

								{!canApprove &&
									!canDecline &&
									!canCheckIn &&
									!canCheckOut &&
									!canCancel && (
										<div className="text-center text-xs md:text-sm font-semibold text-slate-500 py-4">
											No actions available for this reservation status.
										</div>
									)}
							</div>
						</div>
					</div>
				</div>
			</section>
		</div>
	);
}
