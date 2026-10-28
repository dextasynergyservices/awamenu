import { PaymentStatus, ReservationStatus } from "@prisma/client";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
	cancelReservationAsGuestAction,
	payReservationAction,
} from "@/actions/reservation.actions";
import { ReceiptActions } from "@/components/orders/ReceiptActions";
import { LiveStatusPoller } from "@/components/shared/LiveStatusPoller";
import { TrackingUnavailable } from "@/components/tracking/TrackingUnavailable";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { db } from "@/lib/db";
import {
	referenceFromReturnParams,
	verifyReservationPaymentReference,
} from "@/lib/payments";
import {
	getCustomerReservationLabel,
	getReservationPaymentLabel,
} from "@/lib/reservation-status";
import { privateStorefrontMetadata } from "@/lib/storefront-share";
import { resolveTrackingCode } from "@/lib/tracking-code";
import { formatInTimeZone } from "@/lib/zoned-time";

/** The restaurant's name in the tab and link preview; never indexed. */
export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	return privateStorefrontMetadata(slug, "Your booking");
}

type ReservationStatusPageProps = {
	params: Promise<{ slug: string; reservationId: string }>;
	searchParams?: Promise<Record<string, string>>;
};

export const dynamic = "force-dynamic";

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

/** In the restaurant's timezone — the server's (UTC on Vercel) is meaningless
 *  to a guest. */
function formatDateTime(date: Date, timeZone: string) {
	return formatInTimeZone(date, timeZone);
}

function statusClass(status: ReservationStatus) {
	switch (status) {
		case ReservationStatus.PENDING_APPROVAL:
			return "bg-yellow-50 text-yellow-800";
		// Approved but unpaid isn't confirmed yet, so it doesn't wear the
		// confirmed colour.
		case ReservationStatus.APPROVED:
			return "bg-amber-50 text-amber-800";
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
	const paystackReference = referenceFromReturnParams(await searchParams);
	const cleanReservationId = decodeURIComponent(reservationId)
		.replace(/^#/, "")
		.trim();

	// The full id, or exactly the 6-character receipt code — never a shorter
	// suffix, which used to resolve to someone else's booking (and, with guest
	// cancellation, let a stranger cancel it).
	const resolvedReservationId = await resolveTrackingCode(
		"reservation",
		slug,
		cleanReservationId,
	);
	const reservation = resolvedReservationId
		? await db.reservation.findFirst({
				where: {
					id: resolvedReservationId,
					restaurant: { slug },
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
					paymentDueAt: true,
					refundRequiredReason: true,
					refundedAt: true,
					cancelledBy: true,
					cancelledAt: true,
					cancellationReason: true,
					specialRequests: true,
					declineReason: true,
					createdAt: true,
					updatedAt: true,
					table: { select: { label: true, capacity: true } },
					restaurant: {
						select: {
							name: true,
							slug: true,
							currency: true,
							timezone: true,
							reservationSetting: { select: { cancellationPolicy: true } },
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
			})
		: null;

	if (!reservation) {
		const orderId = await resolveTrackingCode(
			"order",
			slug,
			cleanReservationId,
		);
		const order = orderId ? { id: orderId } : null;

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
		// Drop the reference from the URL. This page polls every few seconds, and
		// left in place it re-ran verification — a provider API call — on every
		// poll. The payments cron keeps checking a still-pending charge.
		redirect(`/${slug}/reservation/${reservation.id}`);
	}

	const amountDue = Number(reservation.reservationAmountPaid ?? 0);
	// The deadline is enforced on the server whatever this page shows; hiding the
	// button once it passes just stops a guest starting a payment that can no
	// longer hold the table.
	const holdLapsed =
		reservation.paymentDueAt !== null && reservation.paymentDueAt <= new Date();
	const canPay =
		reservation.status === ReservationStatus.APPROVED &&
		reservation.reservationPaymentStatus !== PaymentStatus.PAID &&
		amountDue > 0 &&
		!holdLapsed;
	const payByLabel = reservation.paymentDueAt
		? formatDateTime(reservation.paymentDueAt, reservation.restaurant.timezone)
		: null;
	// Guests can cancel their own booking until it starts (the confirmation
	// email offers it).
	const guestCanCancel =
		(reservation.status === ReservationStatus.PENDING_APPROVAL ||
			reservation.status === ReservationStatus.APPROVED ||
			reservation.status === ReservationStatus.ACTIVE) &&
		reservation.startsAt > new Date();
	const cancellationPolicy =
		reservation.restaurant.reservationSetting?.cancellationPolicy ?? null;
	const releasedForNonPayment =
		reservation.status === ReservationStatus.EXPIRED &&
		reservation.reservationPaymentStatus !== PaymentStatus.PAID &&
		amountDue > 0;
	const contactNumber =
		reservation.restaurant.whatsappNumber ?? reservation.restaurant.phone;
	const declineReason =
		reservation.declineReason ??
		"This table is not available for the selected time. Please contact the restaurant so we can help you choose another table.";

	return (
		<main className="min-h-screen bg-[#f6faf7] px-4 py-5 text-slate-950">
			<LiveStatusPoller
				url={`/api/live/reservation/${reservation.id}`}
				version={reservation.updatedAt.getTime()}
				active={
					reservation.status !== ReservationStatus.COMPLETED &&
					reservation.status !== ReservationStatus.CANCELLED &&
					reservation.status !== ReservationStatus.DECLINED &&
					reservation.status !== ReservationStatus.EXPIRED
				}
			/>
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
									value: formatDateTime(
										reservation.startsAt,
										reservation.restaurant.timezone,
									),
								},
								{
									label: "Held until",
									value: formatDateTime(
										reservation.expiresAt,
										reservation.restaurant.timezone,
									),
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
								{getCustomerReservationLabel(reservation.status)}
							</p>
						</div>
						<div className="rounded-2xl bg-yellow-50 p-4">
							<p className="text-sm font-bold text-yellow-800">Payment</p>
							<p className="mt-1 text-lg font-black">
								{getReservationPaymentLabel({
									reservationPaymentStatus:
										reservation.reservationPaymentStatus,
									amount: Number(reservation.reservationAmountPaid ?? 0),
									refundRequired: Boolean(reservation.refundRequiredReason),
								})}
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
							{payByLabel ? (
								<p className="mt-2 text-sm font-black text-emerald-950">
									Your table is held until {payByLabel}. After that it is
									released to other guests.
								</p>
							) : null}
							<ActionForm action={payReservationAction} className="mt-3">
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
							</ActionForm>
						</div>
					) : null}

					{releasedForNonPayment ? (
						<div className="mt-5 rounded-2xl bg-slate-100 p-4 text-sm font-bold leading-6 text-slate-800">
							<p className="font-black">This table is no longer held.</p>
							<p className="mt-2">
								Payment wasn't completed in time, so the table was released. You
								have not been charged. You're welcome to book again.
							</p>
							<Link
								href={`/${reservation.restaurant.slug}/tables`}
								className="mt-3 inline-flex min-h-11 items-center rounded-2xl bg-slate-900 px-4 text-sm font-black text-white"
							>
								Book a table
							</Link>
						</div>
					) : null}

					{reservation.status === ReservationStatus.CANCELLED &&
					reservation.cancelledBy === "RESTAURANT" ? (
						<div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-bold leading-6 text-red-900">
							<p className="font-black">
								{reservation.restaurant.name} cancelled this booking
								{reservation.cancelledAt
									? ` on ${formatDateTime(reservation.cancelledAt, reservation.restaurant.timezone)}`
									: ""}
								.
							</p>
							{reservation.cancellationReason ? (
								<p className="mt-1">Reason: {reservation.cancellationReason}</p>
							) : null}
							{contactNumber ? (
								<p className="mt-2 text-red-800">
									Questions? Call or chat: {contactNumber}
								</p>
							) : null}
						</div>
					) : null}

					{reservation.refundRequiredReason ? (
						<p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-900">
							{reservation.cancelledBy === "RESTAURANT"
								? `You'll get a full refund of ${formatMoney(amountDue, reservation.restaurant.currency)}. ${reservation.restaurant.name} pays it back to your original payment method; refunds usually reach you within 5–10 working days.`
								: reservation.cancelledBy === "GUEST"
									? `Your refund is being handled by ${reservation.restaurant.name} under their cancellation policy.`
									: `A refund of ${formatMoney(amountDue, reservation.restaurant.currency)} is being processed by ${reservation.restaurant.name}.`}{" "}
							If you have questions, contact {reservation.restaurant.name} with
							your reservation code.
						</p>
					) : reservation.refundedAt ? (
						<p className="mt-5 rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900">
							Refunded on{" "}
							{formatDateTime(
								reservation.refundedAt,
								reservation.restaurant.timezone,
							)}
							. It can take a few working days to show on your statement.
						</p>
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
								{formatDateTime(
									reservation.startsAt,
									reservation.restaurant.timezone,
								)}
							</span>
						</div>
						<div className="flex justify-between gap-3">
							<span>Held until</span>
							<span className="text-right text-slate-950">
								{formatDateTime(
									reservation.expiresAt,
									reservation.restaurant.timezone,
								)}
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

					{!guestCanCancel &&
					(reservation.status === ReservationStatus.ACTIVE ||
						reservation.status === ReservationStatus.CHECKED_IN ||
						reservation.status === ReservationStatus.COMPLETED ||
						reservation.status === ReservationStatus.EXPIRED) &&
					contactNumber ? (
						<div className="mt-5 border-slate-100 border-t pt-4 text-sm font-semibold text-slate-600">
							<p>
								Need help with this booking? Contact{" "}
								{reservation.restaurant.name}:{" "}
								<a
									href={`tel:${contactNumber.replace(/[^\d+]/g, "")}`}
									className="font-black text-emerald-700"
								>
									{contactNumber}
								</a>
							</p>
							{cancellationPolicy ? (
								<p className="mt-2 text-xs leading-5 text-slate-500">
									Cancellation policy: {cancellationPolicy}
								</p>
							) : null}
						</div>
					) : null}

					{guestCanCancel ? (
						<div className="mt-5 border-slate-100 border-t pt-4">
							{cancellationPolicy ? (
								<p className="mb-3 text-xs font-semibold leading-5 text-slate-500">
									Cancellation policy: {cancellationPolicy}
								</p>
							) : null}
							<ConfirmForm
								action={cancelReservationAsGuestAction}
								hiddenFields={{
									slug: reservation.restaurant.slug,
									reservationId: reservation.id,
								}}
								confirmMessage={
									reservation.reservationPaymentStatus === PaymentStatus.PAID &&
									amountDue > 0
										? "Cancel this booking? Any refund follows the restaurant's cancellation policy."
										: "Cancel this booking? The table will be released."
								}
							>
								<button
									type="submit"
									className="min-h-11 w-full rounded-2xl border border-red-200 px-5 text-sm font-black text-red-700 hover:bg-red-50"
								>
									Cancel booking
								</button>
							</ConfirmForm>
						</div>
					) : null}
				</section>
			</div>
		</main>
	);
}
