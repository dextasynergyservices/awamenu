import { OrderStatus, PaymentPolicy, PaymentStatus } from "@prisma/client";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { initiateOrderPaymentAction } from "@/actions/order.actions";
import { OrderCartFinalizer } from "@/components/orders/OrderCartFinalizer";
import { OrderStatusPoller } from "@/components/orders/OrderStatusPoller";
import { ReceiptActions } from "@/components/orders/ReceiptActions";
import { db } from "@/lib/db";
import { verifyOrderPaymentReference } from "@/lib/payments";

type OrderStatusPageProps = {
	params: Promise<{ slug: string; orderId: string }>;
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

function getOrderStatusMessage(status: OrderStatus, type: string) {
	if (status === OrderStatus.PENDING_PAYMENT) {
		return "Your order has been received. The restaurant will review and accept it before payment becomes available.";
	}

	if (status === OrderStatus.CONFIRMED) {
		return "Your order has been successfully received and confirmed. We are reviewing it and will begin processing shortly.";
	}

	if (status === OrderStatus.PREPARING) {
		return "We're preparing your order with care. Freshly made and getting ready for you.";
	}

	if (status === OrderStatus.READY) {
		if (type === "PICKUP") return "Your order is ready for pickup.";
		if (type === "DELIVERY")
			return "Your order is packed and on its way to you.";
		if (type === "DINE_IN") {
			return "Your meal is ready and has been served or is ready to be served.";
		}
		return "Your order is ready.";
	}

	if (status === OrderStatus.COMPLETED) {
		return "Your order has been completed. We hope you enjoyed your meal and experience. We'd love to hear your feedback. Please take a moment to rate your meal and share your experience with our restaurant. Your review helps us serve you better.";
	}

	return null;
}

export default async function OrderStatusPage({
	params,
	searchParams,
}: OrderStatusPageProps) {
	const { slug, orderId } = await params;
	const { reference, trxref } = (await searchParams) ?? {};
	const paystackReference = reference ?? trxref;

	// Normalize input (e.g. remove leading '#' and trim)
	const cleanOrderId = decodeURIComponent(orderId).replace(/^#/, "").trim();

	const orderSelect = {
		id: true,
		customerName: true,
		type: true,
		status: true,
		statusNote: true,
		paymentStatus: true,
		dineInPaymentPolicy: true,
		dineInServiceMode: true,
		waiterName: true,
		total: true,
		createdAt: true,
		restaurant: { select: { name: true, slug: true, currency: true } },
		items: {
			select: {
				id: true,
				name: true,
				qty: true,
				unitPrice: true,
				notes: true,
			},
		},
	} as const;

	const exactOrder = await db.order.findUnique({
		where: { id: cleanOrderId },
		select: orderSelect,
	});
	const order =
		exactOrder?.restaurant.slug === slug
			? exactOrder
			: await db.order.findFirst({
					where: {
						id: {
							endsWith: cleanOrderId.toLowerCase(),
						},
						restaurant: { slug },
					},
					select: orderSelect,
				});

	if (!order) notFound();

	// If the current orderId in the URL doesn't match the canonical full ID, redirect to the canonical URL
	if (orderId !== order.id) {
		const searchParamsObj = await searchParams;
		const searchParamsString = searchParamsObj
			? new URLSearchParams(searchParamsObj).toString()
			: "";
		const queryString = searchParamsString ? `?${searchParamsString}` : "";
		redirect(`/${slug}/order/${order.id}${queryString}`);
	}

	if (paystackReference) {
		await verifyOrderPaymentReference({
			orderId: order.id,
			reference: paystackReference,
		});
	}

	const canAddMore =
		order.status === OrderStatus.CONFIRMED &&
		order.paymentStatus === PaymentStatus.PENDING &&
		order.dineInPaymentPolicy === PaymentPolicy.PAY_AFTER_SERVICE;
	const canPayNow =
		order.status === OrderStatus.CONFIRMED &&
		order.paymentStatus === PaymentStatus.PENDING &&
		(order.type !== "DINE_IN" ||
			order.dineInPaymentPolicy === PaymentPolicy.PAY_BEFORE_SERVICE);
	const statusMessage = getOrderStatusMessage(order.status, order.type);

	return (
		<main className="min-h-screen bg-[#f6faf7] px-4 py-5 text-slate-950">
			<OrderStatusPoller />
			<OrderCartFinalizer
				restaurantSlug={order.restaurant.slug}
				orderId={order.id}
			/>
			<div className="mx-auto max-w-2xl">
				<Link
					href={`/${order.restaurant.slug}`}
					className="text-sm font-black text-emerald-700"
				>
					Back to menu
				</Link>
				<section className="mt-5 rounded-3xl border border-emerald-100 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
					<p className="text-sm font-bold text-slate-500">
						{order.restaurant.name}
					</p>
					<h1 className="mt-2 text-3xl font-black">
						Order #{order.id.slice(-6).toUpperCase()}
					</h1>
					<ReceiptActions
						receipt={{
							orderId: order.id,
							orderCode: `#${order.id.slice(-6).toUpperCase()}`,
							receiptTitle: "Receipt",
							copyLabel: "Copy order code",
							restaurantName: order.restaurant.name,
							customerName: order.customerName,
							status: order.status,
							paymentStatus: order.paymentStatus,
							orderType: order.type,
							total: Number(order.total),
							currency: order.restaurant.currency,
							createdAt: order.createdAt.toISOString(),
							extraDetails: order.statusNote
								? [{ label: "Restaurant update", value: order.statusNote }]
								: undefined,
							items: order.items.map((item) => ({
								name: item.name,
								qty: item.qty,
								unitPrice: Number(item.unitPrice),
								notes: item.notes,
							})),
						}}
					/>
					<p className="mt-2 break-all rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-600">
						Tracking ID: {order.id}
					</p>
					<div className="mt-5 grid grid-cols-2 gap-3">
						<div className="rounded-2xl bg-emerald-50 p-4">
							<p className="text-sm font-bold text-emerald-800">Status</p>
							<p className="mt-1 text-lg font-black">
								{order.status.replace("_", " ")}
							</p>
						</div>
						<div className="rounded-2xl bg-yellow-50 p-4">
							<p className="text-sm font-bold text-yellow-800">Payment</p>
							<p className="mt-1 text-lg font-black">{order.paymentStatus}</p>
						</div>
					</div>
					{statusMessage ? (
						<p className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-bold leading-6 text-emerald-900">
							{statusMessage}
						</p>
					) : null}
					{order.statusNote ? (
						<div className="mt-4 rounded-2xl border border-emerald-100 bg-white p-4">
							<p className="text-xs font-black uppercase tracking-wide text-emerald-700">
								Restaurant update
							</p>
							<p className="mt-2 text-sm font-bold leading-6 text-slate-700">
								{order.statusNote}
							</p>
						</div>
					) : null}
					{order.type === "DINE_IN" ? (
						<p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
							{order.dineInServiceMode === "SERVED_BY_WAITER"
								? `Served by ${order.waiterName ?? "staff"}`
								: "Self-served"}
						</p>
					) : null}
					{canPayNow ? (
						<form action={initiateOrderPaymentAction} className="mt-5">
							<input type="hidden" name="slug" value={order.restaurant.slug} />
							<input type="hidden" name="orderId" value={order.id} />
							<button
								type="submit"
								className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white"
							>
								Pay now
							</button>
						</form>
					) : null}
					<div className="mt-6 grid gap-3">
						{order.items.map((item) => (
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
										order.restaurant.currency,
									)}
								</p>
							</div>
						))}
					</div>
					<div className="mt-6 flex items-center justify-between border-slate-100 border-t pt-4">
						<span className="font-bold text-slate-600">Total</span>
						<span className="text-2xl font-black">
							{formatMoney(Number(order.total), order.restaurant.currency)}
						</span>
					</div>
					{canAddMore ? (
						<Link
							href={`/${order.restaurant.slug}?orderId=${order.id}`}
							className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white"
						>
							Add More Items
						</Link>
					) : null}
				</section>
			</div>
		</main>
	);
}
