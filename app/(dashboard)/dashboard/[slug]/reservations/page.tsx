import { PaymentStatus, ReservationStatus } from "@prisma/client";
import { Search } from "lucide-react";
import Link from "next/link";
import {
	cancelReservationAction,
	checkInReservationAction,
} from "@/actions/reservation.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";

type ReservationsPageProps = {
	params: Promise<{ slug: string }>;
	searchParams?: Promise<{ reservationCode?: string }>;
};

export const dynamic = "force-dynamic";

function formatMoney(value: unknown, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(Number(value ?? 0));
}

function formatDate(value: Date) {
	return new Intl.DateTimeFormat("en-NG", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(value);
}

function statusClass(status: ReservationStatus) {
	switch (status) {
		case ReservationStatus.ACTIVE:
			return "bg-emerald-50 text-emerald-700";
		case ReservationStatus.CHECKED_IN:
			return "bg-blue-50 text-blue-700";
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

export default async function ReservationsPage({
	params,
	searchParams,
}: ReservationsPageProps) {
	const user = await requireUser();
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
		where: { slug, ownerId: user.id },
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

	return (
		<section className="grid gap-5">
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
				className="grid gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_10px_28px_rgba(15,23,42,0.04)] md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center"
			>
				<label className="relative">
					<span className="sr-only">Find reservation by unique code</span>
					<Search
						className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-slate-400"
						aria-hidden="true"
					/>
					<input
						name="reservationCode"
						defaultValue={rawReservationCode}
						placeholder="Find reservation by code, e.g. #A1B2C3"
						className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-10 text-sm font-bold text-slate-700 outline-none focus:border-emerald-700"
					/>
				</label>
				<button
					type="submit"
					className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white"
				>
					Find reservation
				</button>
				{reservationCode ? (
					<Link
						href={`/dashboard/${restaurant.slug}/reservations`}
						className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700"
					>
						Clear
					</Link>
				) : null}
			</form>

			{reservationCode ? (
				<p className="text-xs font-bold text-slate-500">
					Showing reservations matching #{reservationCode.toUpperCase()}.
				</p>
			) : null}

			<div className="grid gap-4">
				{restaurant.reservations.length > 0 ? (
					restaurant.reservations.map((reservation) => {
						const canCheckIn = reservation.status === ReservationStatus.ACTIVE;
						const canCancel = reservation.status === ReservationStatus.ACTIVE;
						const totalFood = Number(reservation.preOrder?.total ?? 0);

						return (
							<article
								key={reservation.id}
								className="grid gap-4 rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)] md:p-5"
							>
								<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<h2 className="text-lg font-black text-slate-950 md:text-xl">
												#{reservation.id.slice(-6).toUpperCase()}
											</h2>
											<span
												className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(reservation.status)}`}
											>
												{reservation.status.replaceAll("_", " ")}
											</span>
											<span
												className={`rounded-full px-3 py-1 text-xs font-black ${paymentClass(reservation.reservationPaymentStatus)}`}
											>
												{reservation.reservationPaymentStatus}
											</span>
											<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
												{reservation.table.label}
											</span>
										</div>
										<p className="mt-2 text-sm font-bold text-slate-600">
											{reservation.customerName} · {reservation.customerPhone}
										</p>
										<p className="mt-1 text-sm font-bold text-slate-500">
											{reservation.partySize} guest
											{reservation.partySize === 1 ? "" : "s"} ·{" "}
											{formatDate(reservation.startsAt)}
										</p>
									</div>
									<div className="text-left md:text-right">
										<p className="text-lg font-black text-slate-950">
											{formatMoney(
												reservation.reservationAmountPaid ?? 0,
												restaurant.currency,
											)}
										</p>
										<p className="mt-1 text-sm font-bold text-slate-500">
											Food {formatMoney(totalFood, restaurant.currency)}
										</p>
									</div>
								</div>

								<details className="rounded-2xl border border-slate-100 bg-slate-50">
									<summary className="cursor-pointer px-4 py-3 text-sm font-black text-emerald-800">
										View reservation details and notes
									</summary>
									<div className="grid gap-4 border-slate-100 border-t bg-white px-4 py-4">
										<div className="grid gap-2 text-sm font-bold text-slate-600 md:grid-cols-2">
											<p>Reservation code: {reservation.id}</p>
											<p>
												Email: {reservation.customerEmail ?? "Not provided"}
											</p>
											<p>Starts: {formatDate(reservation.startsAt)}</p>
											<p>Expires: {formatDate(reservation.expiresAt)}</p>
											<p>Table capacity: {reservation.table.capacity}</p>
											<p>
												Policy:{" "}
												{reservation.effectiveBookingMode.replaceAll("_", " ")}
											</p>
											<p>
												Payment timing:{" "}
												{reservation.effectivePaymentTiming.replaceAll(
													"_",
													" ",
												)}
											</p>
											<p>
												Inclusion:{" "}
												{reservation.effectiveInclusionType.replaceAll(
													"_",
													" ",
												)}
											</p>
											<p>
												Table fee:{" "}
												{formatMoney(
													reservation.effectiveTableFee ?? 0,
													restaurant.currency,
												)}
											</p>
										</div>

										{reservation.preOrder?.items.length ? (
											<div className="grid gap-3">
												<h3 className="text-sm font-black text-slate-950">
													Pre-ordered items
												</h3>
												{reservation.preOrder.items.map((item) => (
													<div
														key={item.id}
														className="grid gap-1 rounded-xl border border-slate-100 p-3"
													>
														<div className="flex items-center justify-between gap-3">
															<p className="font-black text-slate-950">
																{item.name} x{item.qty}
															</p>
															<p className="font-black text-emerald-700">
																{formatMoney(
																	Number(item.unitPrice) * item.qty,
																	restaurant.currency,
																)}
															</p>
														</div>
														{item.notes ? (
															<p className="text-sm font-bold text-slate-500">
																Item note: {item.notes}
															</p>
														) : null}
													</div>
												))}
											</div>
										) : (
											<p className="rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-500">
												No pre-ordered food items.
											</p>
										)}

										{reservation.specialRequests ? (
											<div className="rounded-xl bg-yellow-50 p-3 text-sm font-bold text-yellow-800">
												Guest note: {reservation.specialRequests}
											</div>
										) : null}
									</div>
								</details>

								<div className="flex flex-wrap gap-2">
									<form action={checkInReservationAction}>
										<input type="hidden" name="slug" value={restaurant.slug} />
										<input
											type="hidden"
											name="reservationId"
											value={reservation.id}
										/>
										<SubmitButton
											disabled={!canCheckIn}
											className="min-h-11 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white"
										>
											Check in
										</SubmitButton>
									</form>
									<form action={cancelReservationAction}>
										<input type="hidden" name="slug" value={restaurant.slug} />
										<input
											type="hidden"
											name="reservationId"
											value={reservation.id}
										/>
										<SubmitButton
											disabled={!canCancel}
											className="min-h-11 rounded-xl border border-red-100 bg-red-50 px-5 text-sm font-black text-red-700"
										>
											Cancel reservation
										</SubmitButton>
									</form>
								</div>
							</article>
						);
					})
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
