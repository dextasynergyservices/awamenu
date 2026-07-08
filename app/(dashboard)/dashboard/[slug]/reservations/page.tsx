import { PaymentStatus, ReservationStatus } from "@prisma/client";
import { Calendar, ChevronDown, Filter, Search } from "lucide-react";
import Link from "next/link";
import { ReservationStatusPoller } from "@/components/reservation/ReservationStatusPoller";
import { ReservationsList } from "@/components/reservation/ReservationsList";
import { db } from "@/lib/db";

type ReservationsPageProps = {
	params: Promise<{ slug: string }>;
	searchParams?: Promise<{ reservationCode?: string }>;
};

export const dynamic = "force-dynamic";

function _formatMoney(value: unknown, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(Number(value ?? 0));
}

function _formatDate(value: Date) {
	return new Intl.DateTimeFormat("en-NG", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(value);
}

function _statusClass(status: ReservationStatus) {
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

function _paymentClass(status: PaymentStatus) {
	return status === PaymentStatus.PAID
		? "bg-emerald-50 text-emerald-700"
		: "bg-yellow-50 text-yellow-700";
}

export default async function ReservationsPage({
	params,
	searchParams,
}: ReservationsPageProps) {
	const { slug } = await params;
	const rawReservationCode = (await searchParams)?.reservationCode ?? "";
	const reservationCode = rawReservationCode
		.replace(/^#/, "")
		.trim()
		.toLowerCase();
	const reservationWhere = reservationCode
		? {
				OR: [{ id: reservationCode }, { id: { endsWith: reservationCode } }],
			}
		: undefined;
	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug },
		select: {
			id: true,
			slug: true,
			name: true,
			currency: true,
			reservations: {
				where: reservationWhere,
				orderBy: { startsAt: "desc" },
				take: reservationCode ? 10 : 40,
				select: {
					id: true,
					customerName: true,
					customerPhone: true,
					customerEmail: true,
					partySize: true,
					startsAt: true,
					expiresAt: true,
					status: true,
					effectiveBookingMode: true,
					effectivePaymentTiming: true,
					effectiveInclusionType: true,
					effectiveTableFee: true,
					reservationPaymentStatus: true,
					reservationAmountPaid: true,
					specialRequests: true,
					declineReason: true,
					table: { select: { label: true, capacity: true } },
					preOrder: {
						select: {
							id: true,
							total: true,
							status: true,
							paymentStatus: true,
							items: {
								select: {
									id: true,
									name: true,
									qty: true,
									unitPrice: true,
									notes: true,
								},
							},
						},
					},
				},
			},
		},
	});
	const serializedReservations = restaurant.reservations.map((reservation) => ({
		...reservation,
		effectiveTableFee: reservation.effectiveTableFee
			? Number(reservation.effectiveTableFee)
			: null,
		reservationAmountPaid: reservation.reservationAmountPaid
			? Number(reservation.reservationAmountPaid)
			: null,
		preOrder: reservation.preOrder
			? {
					...reservation.preOrder,
					total: Number(reservation.preOrder.total),
					items: reservation.preOrder.items.map((item) => ({
						...item,
						unitPrice: Number(item.unitPrice),
					})),
				}
			: null,
	}));

	return (
		<section className="grid gap-5">
			<ReservationStatusPoller />
			<div>
				<p className="text-sm font-medium text-slate-500">{restaurant.name}</p>
				<h1 className="mt-1 text-xl font-black text-slate-950 md:text-3xl">
					Reservations
				</h1>
				<p className="mt-1 text-xs font-medium text-slate-500 md:text-base">
					Manage table bookings, check-ins, cancellations, and pre-ordered
					items.
				</p>
			</div>

			<form
				action={`/dashboard/${restaurant.slug}/reservations`}
				className="grid gap-3"
			>
				<label className="relative block">
					<span className="sr-only">Search by code, name, phone or email</span>
					<Search
						className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 size-4 text-slate-400"
						aria-hidden="true"
					/>
					<input
						name="reservationCode"
						defaultValue={rawReservationCode}
						placeholder="Search by code, name, phone or email"
						className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pr-4 pl-11 text-sm font-medium text-slate-700 outline-none focus:border-emerald-700"
					/>
				</label>

				<div className="grid grid-cols-2 gap-3 md:flex md:items-center">
					<label className="relative block md:w-48">
						<span className="sr-only">Select date</span>
						<Calendar
							className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 size-4 text-slate-400"
							aria-hidden="true"
						/>
						<select className="min-h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white pr-10 pl-11 text-sm font-medium text-slate-700 outline-none focus:border-emerald-700">
							<option value="">Select date</option>
						</select>
						<ChevronDown
							className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 size-4 text-slate-400"
							aria-hidden="true"
						/>
					</label>
					<label className="relative block md:w-48">
						<span className="sr-only">All statuses</span>
						<Filter
							className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-4 size-4 text-slate-400"
							aria-hidden="true"
						/>
						<select className="min-h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white pr-10 pl-11 text-sm font-medium text-slate-700 outline-none focus:border-emerald-700">
							<option value="">All statuses</option>
						</select>
						<ChevronDown
							className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 size-4 text-slate-400"
							aria-hidden="true"
						/>
					</label>
				</div>

				<div className="flex flex-col md:flex-row items-center gap-2">
					<button
						type="submit"
						className="min-h-12 w-full md:w-auto rounded-xl bg-[#006644] px-6 text-sm font-medium text-white"
					>
						Find reservation
					</button>
					{reservationCode ? (
						<Link
							href={`/dashboard/${restaurant.slug}/reservations`}
							className="inline-flex min-h-12 w-full md:w-auto items-center justify-center rounded-xl border border-slate-200 bg-white px-6 text-sm font-medium text-slate-700"
						>
							Clear
						</Link>
					) : null}
				</div>
			</form>

			{reservationCode ? (
				<p className="text-xs font-bold text-slate-500">
					Showing reservations matching #{reservationCode.toUpperCase()}.
				</p>
			) : null}

			<div className="grid gap-4">
				{serializedReservations.length > 0 ? (
					<ReservationsList
						reservations={serializedReservations}
						currency={restaurant.currency}
						slug={restaurant.slug}
					/>
				) : (
					<div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
						<p className="text-lg font-black text-slate-950">
							{reservationCode
								? "No matching reservation found"
								: "No reservations yet"}
						</p>
					</div>
				)}
			</div>
		</section>
	);
}
