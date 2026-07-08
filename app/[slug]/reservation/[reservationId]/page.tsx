import { PaymentStatus, ReservationStatus } from "@prisma/client";
import Link from "next/link";
import { redirect } from "next/navigation";
import { payReservationAction } from "@/actions/reservation.actions";
import { ReceiptActions } from "@/components/orders/ReceiptActions";
import { ReservationStatusPoller } from "@/components/reservation/ReservationStatusPoller";
import { TrackingUnavailable } from "@/components/tracking/TrackingUnavailable";
import { db } from "@/lib/db";
import { verifyReservationPaymentReference } from "@/lib/payments";

type ReservationStatusPageProps = {
	params: Promise<{ slug: string; reservationId: string }>;
	searchParams?: Promise<{ reference?: string; trxref?: string }>;
};

export const dynamic = "force-dynamic";

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

function formatDateTime(date: Date) {
	return new Intl.DateTimeFormat("en-NG", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

function statusClass(status: ReservationStatus) {
	switch (status) {
		case ReservationStatus.PENDING_APPROVAL:
			return "bg-yellow-50 text-yellow-800";
		case ReservationStatus.APPROVED:
		case ReservationStatus.ACTIVE:
		case ReservationStatus.CHECKED_IN:
			return "bg-emerald-50 text-emerald-800";
		case ReservationStatus.DECLINED:
		case ReservationStatus.CANCELLED:
			return "bg-red-50 text-red-800";
		default:
			return "bg-slate-100 text-slate-700";
	}
}

export default async function ReservationStatusPage({
	params,
	searchParams,
}: ReservationStatusPageProps) {
	const { slug, reservationId } = await params;
	const { reference, trxref } = (await searchParams) ?? {};
	const paystackReference = reference ?? trxref;
	const cleanReservationId = decodeURIComponent(reservationId)
		.replace(/^#/, "")
		.trim();

	const reservation = await db.reservation.findFirst({
		where: {
			OR: [
				{ id: cleanReservationId },
				{ id: cleanReservationId.toLowerCase() },
				{ id: { endsWith: cleanReservationId.toLowerCase() } },
			],
			restaurant: { slug, isActive: true },
		},
		select: {
			id: true,
			customerName: true,
			partySize: true,
			startsAt: true,
			expiresAt: true,
			status: true,
			reservationPaymentStatus: true,
			reservationAmountPaid: true,
			specialRequests: true,
			declineReason: true,
			createdAt: true,
			table: { select: { label: true, capacity: true } },
			restaurant: {
				select: {
					name: true,
					slug: true,
					currency: true,
					phone: true,
					address: true,
					whatsappNumber: true,
				},
			},
			preOrder: {
				select: {
					id: true,
					total: true,
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
	});

	if (!reservation) {
		const order = await db.order.findFirst({
			where: {
				restaurant: { slug, isActive: true },
				OR: [
					{ id: cleanReservationId },
					{ id: cleanReservationId.toLowerCase() },
					{ id: { endsWith: cleanReservationId.toLowerCase() } },
				],
			},
			select: { id: true },
		});

		if (order) {
			const searchParamsObj = await searchParams;
			const searchParamsString = searchParamsObj
				? new URLSearchParams(searchParamsObj).toString()
				: "";
			const queryString = searchParamsString ? `?${searchParamsString}` : "";
			redirect(`/${slug}/order/${order.id}${queryString}`);
		}

		return (
			<TrackingUnavailable
				restaurantSlug={slug}
				trackingCode={cleanReservationId}
				type="reservation"
			/>
		);
	}

	if (reservationId !== reservation.id) {
		const searchParamsObj = await searchParams;
		const searchParamsString = searchParamsObj
			? new URLSearchParams(searchParamsObj).toString()
			: "";
		const queryString = searchParamsString ? `?${searchParamsString}` : "";
		redirect(`/${slug}/reservation/${reservation.id}${queryString}`);
	}

	if (paystackReference) {
		await verifyReservationPaymentReference({
			reservationId: reservation.id,
			reference: paystackReference,
		});
	}

	const amountDue = Number(reservation.reservationAmountPaid ?? 0);
	const canPay =
		reservation.status === ReservationStatus.APPROVED &&
		reservation.reservationPaymentStatus !== PaymentStatus.PAID &&
		amountDue > 0;
	const contactNumber =
		reservation.restaurant.whatsappNumber ?? reservation.restaurant.phone;
	const declineReason =
		reservation.declineReason ??
		"This table is not available for the selected time. Please contact the restaurant so we can help you choose another table.";

	return (
		<main className="min-h-screen bg-[#f6faf7] px-4 py-5 text-slate-950">
			<ReservationStatusPoller />
			<div className="mx-auto max-w-2xl">
				<Link
					href={`/${reservation.restaurant.slug}`}
					className="text-sm font-black text-emerald-700"
				>
					Back to menu
				</Link>
				<section className="mt-5 rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
					<p className="text-sm font-bold text-slate-500">
						{reservation.restaurant.name}
					</p>
					<h1 className="mt-2 text-3xl font-black">
						Reservation #{reservation.id.slice(-6).toUpperCase()}
					</h1>
					<ReceiptActions
						receipt={{
							orderId: reservation.id,
							orderCode: `#${reservation.id.slice(-6).toUpperCase()}`,
							receiptTitle: "Reservation receipt",
							trackingLabel: "Reservation code",
							totalLabel: "Amount paid",
							itemsLabel: "Food for your table",
							restaurantName: reservation.restaurant.name,
							customerName: reservation.customerName,
							status: reservation.status,
							paymentStatus: reservation.reservationPaymentStatus,
							orderType: "TABLE RESERVATION",
							total:
								reservation.reservationPaymentStatus === PaymentStatus.PAID
									? Number(reservation.reservationAmountPaid ?? 0)
									: 0,
							currency: reservation.restaurant.currency,
							createdAt: reservation.createdAt.toISOString(),
							extraDetails: [
								{ label: "Table", value: reservation.table.label },
								{ label: "Guests", value: String(reservation.partySize) },
								{
									label: "Starts",
									value: formatDateTime(reservation.startsAt),
								},
								{
									label: "Held until",
									value: formatDateTime(reservation.expiresAt),
								},
							],
							items:
								reservation.preOrder?.items.map((item) => ({
									name: item.name,
									qty: item.qty,
									unitPrice: Number(item.unitPrice),
									notes: item.notes,
								})) ?? [],
						}}
					/>
					<p className="mt-2 break-all rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-600">
						Reservation code: {reservation.id}
					</p>

					<div className="mt-5 grid grid-cols-2 gap-3">
						<div
							className={`rounded-2xl p-4 ${statusClass(reservation.status)}`}
						>
							<p className="text-sm font-bold">Status</p>
							<p className="mt-1 text-lg font-black">
								{reservation.status.replace("_", " ")}
							</p>
						</div>
						<div className="rounded-2xl bg-yellow-50 p-4">
							<p className="text-sm font-bold text-yellow-800">Payment</p>
							<p className="mt-1 text-lg font-black">
								{reservation.reservationPaymentStatus}
							</p>
						</div>
					</div>

					{reservation.status === ReservationStatus.PENDING_APPROVAL ? (
						<p className="mt-5 rounded-2xl bg-yellow-50 p-4 text-sm font-bold leading-6 text-yellow-900">
							Your table request is pending. Please wait for admin to confirm
							that this table is free before making payment.
						</p>
					) : null}

					{canPay ? (
						<div className="mt-5 rounded-2xl bg-emerald-50 p-4">
							<p className="text-sm font-bold leading-6 text-emerald-900">
								Admin has approved this table. Complete your online payment to
								reserve it.
							</p>
							<form action={payReservationAction} className="mt-3">
								<input
									type="hidden"
									name="slug"
									value={reservation.restaurant.slug}
								/>
								<input
									type="hidden"
									name="reservationId"
									value={reservation.id}
								/>
								<button
									type="submit"
									className="min-h-12 w-full rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white"
								>
									Pay {formatMoney(amountDue, reservation.restaurant.currency)}
								</button>
							</form>
						</div>
					) : null}

					{reservation.status === ReservationStatus.DECLINED ? (
						<div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold leading-6 text-red-900">
							<p className="font-black">This table is not available.</p>
							<p className="mt-2">{declineReason}</p>
							{contactNumber || reservation.restaurant.address ? (
								<div className="mt-3 grid gap-1 text-red-800">
									{contactNumber ? <p>Call or chat: {contactNumber}</p> : null}
									{reservation.restaurant.address ? (
										<p>Address: {reservation.restaurant.address}</p>
									) : null}
								</div>
							) : null}
						</div>
					) : null}

					<div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
						<div className="flex justify-between gap-3">
							<span>Table</span>
							<span className="text-right text-slate-950">
								{reservation.table.label}
							</span>
						</div>
						<div className="flex justify-between gap-3">
							<span>Guests</span>
							<span className="text-slate-950">{reservation.partySize}</span>
						</div>
						<div className="flex justify-between gap-3">
							<span>Starts</span>
							<span className="text-right text-slate-950">
								{formatDateTime(reservation.startsAt)}
							</span>
						</div>
						<div className="flex justify-between gap-3">
							<span>Held until</span>
							<span className="text-right text-slate-950">
								{formatDateTime(reservation.expiresAt)}
							</span>
						</div>
					</div>

					{reservation.specialRequests ? (
						<p className="mt-4 rounded-2xl bg-yellow-50 p-4 text-sm font-bold text-yellow-800">
							{reservation.specialRequests}
						</p>
					) : null}

					{reservation.preOrder ? (
						<div className="mt-6 grid gap-3">
							<h2 className="text-lg font-black">Food for your table</h2>
							{reservation.preOrder.items.map((item) => (
								<div
									key={item.id}
									className="flex items-center justify-between gap-3 border-slate-100 border-b pb-3 last:border-b-0"
								>
									<div>
										<p className="font-black">{item.name}</p>
										<p className="text-sm font-medium text-slate-500">
											x{item.qty}
										</p>
									</div>
									<p className="font-black text-emerald-700">
										{formatMoney(
											Number(item.unitPrice) * item.qty,
											reservation.restaurant.currency,
										)}
									</p>
								</div>
							))}
						</div>
					) : null}

					<div className="mt-6 flex items-center justify-between border-slate-100 border-t pt-4">
						<span className="font-bold text-slate-600">Amount paid</span>
						<span className="text-2xl font-black">
							{reservation.reservationPaymentStatus === PaymentStatus.PAID
								? formatMoney(
										Number(reservation.reservationAmountPaid ?? 0),
										reservation.restaurant.currency,
									)
								: formatMoney(0, reservation.restaurant.currency)}
						</span>
					</div>

					{reservation.status === ReservationStatus.ACTIVE ? (
						<p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900">
							Your table is reserved. Please arrive on time and show this
							reservation code to the restaurant.
						</p>
					) : null}
				</section>
			</div>
		</main>
	);
}
