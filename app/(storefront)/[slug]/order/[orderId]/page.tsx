import { OrderStatus, PaymentPolicy, PaymentStatus } from "@prisma/client";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { listPublicCheckoutProviders } from "@/actions/payment-settings.actions";
import { SubscriptionInactive } from "@/components/menu/SubscriptionInactive";
import { DineInPayNowButton } from "@/components/orders/DineInPayNowButton";
import { OrderCartFinalizer } from "@/components/orders/OrderCartFinalizer";
import { OrderStatusPoller } from "@/components/orders/OrderStatusPoller";
import { ReceiptActions } from "@/components/orders/ReceiptActions";
import { TrackingUnavailable } from "@/components/tracking/TrackingUnavailable";
import { db } from "@/lib/db";
import { verifyOrderPaymentReference } from "@/lib/payments";
import { isOrderRatingEligible } from "@/lib/rating";
import { isSubscriptionActive } from "@/lib/subscription";

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

function getOrderNumberMessage(type: string) {
	if (type === "PICKUP") {
		return "Copy this order number or save the receipt. You may be asked for it when picking up your order.";
	}

	if (type === "DELIVERY") {
		return "Copy this order number or save the receipt. Use it to track your delivery or contact the restaurant about this order.";
	}

	if (type === "DINE_IN") {
		return "Copy this order number or save the receipt. Keep it for your receipt or any question about your order.";
	}

	return "Copy this order number or save the receipt. Keep it for tracking or any question about your order.";
}

const orderProgressSteps = [
	{ status: OrderStatus.CONFIRMED, label: "Confirmed" },
	{ status: OrderStatus.PREPARING, label: "Preparing" },
	{ status: OrderStatus.READY, label: "Ready" },
	{ status: OrderStatus.COMPLETED, label: "Completed" },
];

function getOrderProgressIndex(status: OrderStatus) {
	if (status === OrderStatus.CONFIRMED) return 0;
	if (status === OrderStatus.PREPARING) return 1;
	if (status === OrderStatus.READY || status === OrderStatus.DELIVERED)
		return 2;
	if (status === OrderStatus.COMPLETED) return 3;
	return -1;
}

function OrderProgressTracker({ status }: { status: OrderStatus }) {
	const currentIndex = getOrderProgressIndex(status);

	return (
		<div className="mt-5 rounded-2xl bg-white p-4">
			<div className="grid grid-cols-4 items-start">
				{orderProgressSteps.map((step, index) => {
					const isComplete = currentIndex >= index;
					const isCurrent = currentIndex === index;

					return (
						<div
							key={step.status}
							className="relative grid justify-items-center"
						>
							{index > 0 ? (
								<span
									className={`absolute top-4 right-1/2 h-0.5 w-full ${
										currentIndex >= index ? "bg-emerald-500" : "bg-slate-200"
									}`}
									aria-hidden="true"
								/>
							) : null}
							<span
								className={`relative z-10 grid size-8 place-items-center rounded-full border-2 ${
									isComplete
										? "border-emerald-500 bg-emerald-500 text-white"
										: "border-slate-200 bg-white text-transparent"
								}`}
								aria-current={isCurrent ? "step" : undefined}
							>
								{isComplete ? (
									<Check className="size-4" aria-hidden="true" />
								) : null}
							</span>
							<span
								className={`mt-2 text-center text-xs font-black ${
									isComplete ? "text-emerald-700" : "text-slate-400"
								}`}
							>
								{step.label}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}

function getOrderNotice(
	status: OrderStatus,
	type: string,
	paymentStatus: PaymentStatus,
	reason: string | null,
	contact: { phone: string | null; address: string | null },
) {
	if (status === OrderStatus.CANCELLED) {
		return {
			title: "Declined",
			message:
				reason ??
				"Sorry, we cannot accept this order right now. Please contact the restaurant for more details.",
			className: "border-red-100 bg-red-50 text-red-900",
			titleClassName: "text-red-700",
			contact,
		};
	}

	if (status === OrderStatus.PENDING_PAYMENT) {
		return {
			title: "Pending",
			message:
				"Please wait for the admin to accept your order before making payment. The payment button will appear automatically after the order is accepted.",
			className: "border-yellow-100 bg-yellow-50 text-yellow-900",
			titleClassName: "text-yellow-700",
		};
	}

	if (status === OrderStatus.CONFIRMED) {
		return {
			title: "Confirmed",
			message:
				paymentStatus === PaymentStatus.PENDING
					? "Your order has been accepted. Please complete payment so the restaurant can start processing it."
					: "Your order has been accepted. The restaurant will begin processing it shortly.",
			className: "border-emerald-100 bg-emerald-50 text-emerald-900",
			titleClassName: "text-emerald-700",
		};
	}

	if (status === OrderStatus.PREPARING) {
		return {
			title: "Preparing",
			message: "We're preparing your order with care.",
			className: "border-emerald-100 bg-emerald-50 text-emerald-900",
			titleClassName: "text-emerald-700",
		};
	}

	if (status === OrderStatus.READY) {
		const message =
			type === "PICKUP"
				? "Your order is ready for pickup."
				: type === "DELIVERY"
					? "Your order is packed and on its way to you."
					: type === "DINE_IN"
						? "Your meal is ready and has been served or is ready to be served."
						: "Your order is ready.";

		return {
			title: "Ready",
			message,
			className: "border-emerald-100 bg-emerald-50 text-emerald-900",
			titleClassName: "text-emerald-700",
		};
	}

	if (status === OrderStatus.COMPLETED) {
		return {
			title: "Completed",
			message: "Your order has been completed. We hope you enjoyed your meal.",
			className: "border-emerald-100 bg-emerald-50 text-emerald-900",
			titleClassName: "text-emerald-700",
		};
	}

	return null;
}

function OrderStatusNotice({
	notice,
}: {
	notice: NonNullable<ReturnType<typeof getOrderNotice>>;
}) {
	const contact = "contact" in notice ? notice.contact : null;

	return (
		<div className={`mt-5 rounded-2xl border p-4 ${notice.className}`}>
			<p
				className={`text-xs font-black uppercase tracking-wide ${notice.titleClassName}`}
			>
				{notice.title}
			</p>
			<p className="mt-2 text-xs font-bold leading-6">{notice.message}</p>
			{contact ? (
				<div className="mt-3 grid gap-1 rounded-xl bg-white/70 p-3 text-xs font-bold leading-6">
					<p>Phone: {contact.phone ?? "Not provided"}</p>
					<p>Address: {contact.address ?? "Not provided"}</p>
				</div>
			) : null}
		</div>
	);
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
		cancellationNote: true,
		paymentStatus: true,
		dineInPaymentPolicy: true,
		dineInPaymentMethod: true,
		dineInServiceMode: true,
		waiterName: true,
		total: true,
		createdAt: true,
		restaurant: {
			select: {
				id: true,
				name: true,
				slug: true,
				currency: true,
				phone: true,
				address: true,
				subscription: {
					select: { status: true, currentPeriodEnd: true },
				},
				bankAccounts: {
					where: { isActive: true },
					select: {
						id: true,
						accountName: true,
						accountNumber: true,
						bankName: true,
					},
				},
			},
		},
		items: {
			select: {
				id: true,
				name: true,
				qty: true,
				unitPrice: true,
				notes: true,
			},
		},
		payments: {
			select: {
				amount: true,
				method: true,
			},
		},
		rating: { select: { id: true } },
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

	if (!order) {
		const reservation = await db.reservation.findFirst({
			where: {
				restaurant: { slug, isActive: true },
				OR: [
					{ id: cleanOrderId },
					{ id: cleanOrderId.toLowerCase() },
					{ id: { endsWith: cleanOrderId.toLowerCase() } },
				],
			},
			select: { id: true },
		});

		if (reservation) {
			const searchParamsObj = await searchParams;
			const searchParamsString = searchParamsObj
				? new URLSearchParams(searchParamsObj).toString()
				: "";
			const queryString = searchParamsString ? `?${searchParamsString}` : "";
			redirect(`/${slug}/reservation/${reservation.id}${queryString}`);
		}

		return (
			<TrackingUnavailable
				restaurantSlug={slug}
				trackingCode={cleanOrderId}
				type="order"
			/>
		);
	}

	if (!isSubscriptionActive(order.restaurant.subscription)) {
		return <SubscriptionInactive restaurantName={order.restaurant.name} />;
	}

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
		(order.dineInPaymentPolicy === PaymentPolicy.PAY_AFTER_SERVICE ||
			order.dineInPaymentPolicy === PaymentPolicy.FLEXIBLE);
	const needsInHousePaymentConfirmation =
		order.type === "DINE_IN" &&
		Boolean(order.dineInPaymentMethod) &&
		order.paymentStatus === PaymentStatus.PENDING;
	const canPayNow =
		order.paymentStatus === PaymentStatus.PENDING &&
		order.status !== OrderStatus.CANCELLED &&
		(order.type === "DINE_IN" ||
			order.status === OrderStatus.CONFIRMED ||
			order.status === OrderStatus.PENDING_PAYMENT);

	// A restaurant may have more than one online provider live; when it does the
	// customer picks. Only fetched when there's actually a payment to make.
	const onlineProviders = canPayNow
		? await listPublicCheckoutProviders(order.restaurant.id)
		: [];
	const statusNotice = getOrderNotice(
		order.status,
		order.type,
		order.paymentStatus,
		order.cancellationNote,
		{
			phone: order.restaurant.phone,
			address: order.restaurant.address,
		},
	);
	const isDeclined = order.status === OrderStatus.CANCELLED;
	const showProgress =
		!isDeclined && order.status !== OrderStatus.PENDING_PAYMENT;
	const orderCode = `#${order.id.slice(-6).toUpperCase()}`;
	const isPendingApproval = order.status === OrderStatus.PENDING_APPROVAL;
	const canRate = !order.rating && isOrderRatingEligible(order);

	if (isPendingApproval) {
		return (
			<main className="min-h-screen flex flex-col bg-[#f6faf7] px-4 py-5 text-slate-950">
				<OrderStatusPoller />
				<div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full text-center">
					<div className="size-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
						<Loader2 className="size-10 text-emerald-600 animate-spin" />
					</div>
					<h1 className="text-sm font-black text-slate-950 mb-3 sm:text-2xl">
						Waiting for staff to confirm availability...
					</h1>
					<p className="text-xs font-medium text-slate-600 mb-8 sm:text-sm">
						Please wait while we confirm your order.
					</p>

					<div className="w-full bg-white rounded-3xl p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)] border border-slate-100">
						<p className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">
							Order Code
						</p>
						<p className="text-2xl font-black text-slate-950">{orderCode}</p>
					</div>

					<Link
						href={`/${order.restaurant.slug}`}
						className="mt-8 text-xs font-black text-emerald-700 hover:underline sm:text-sm"
					>
						Back to menu
					</Link>
				</div>
			</main>
		);
	}

	if (needsInHousePaymentConfirmation) {
		return (
			<main className="min-h-screen flex flex-col bg-[#f6faf7] px-4 py-5 text-slate-950">
				<OrderStatusPoller />
				<div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full text-center">
					<div className="size-20 rounded-full bg-emerald-100 flex items-center justify-center mb-6">
						<Loader2 className="size-10 text-emerald-600 animate-spin" />
					</div>
					<h1 className="text-sm font-black text-slate-950 mb-3 sm:text-2xl">
						Waiting for Confirmation
					</h1>
					<p className="text-xs font-medium text-slate-600 mb-8 sm:text-sm">
						Please complete your{" "}
						<strong className="text-slate-900 font-bold">
							{order.dineInPaymentMethod === "CASH" ? "cash" : "POS/transfer"}
						</strong>{" "}
						payment in-house. Our staff will confirm your payment of{" "}
						<strong className="text-slate-900 font-bold">
							{formatMoney(Number(order.total), order.restaurant.currency)}
						</strong>{" "}
						shortly.
					</p>

					<div className="w-full bg-white rounded-3xl p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)] border border-slate-100">
						<p className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2">
							Order Code
						</p>
						<p className="text-2xl font-black text-slate-950">{orderCode}</p>
					</div>

					<Link
						href={`/${order.restaurant.slug}`}
						className="mt-8 text-xs font-black text-emerald-700 hover:underline sm:text-sm"
					>
						Back to menu
					</Link>
				</div>
			</main>
		);
	}

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
					className="text-xs font-black text-emerald-700 sm:text-sm"
				>
					Back to menu
				</Link>
				<section className="mt-5 rounded-[2rem] border border-slate-100 bg-white p-6 md:p-8 shadow-xl shadow-slate-200/40">
					<div className="mb-6">
						<p className="text-xs font-bold text-slate-500 sm:text-sm">
							{order.restaurant.name}
						</p>
						<h1 className="mt-1 text-sm font-black tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
							Order {orderCode}
						</h1>
						<p className="mt-2 text-xs font-medium leading-relaxed text-slate-600 sm:text-sm">
							{getOrderNumberMessage(order.type)}
						</p>
					</div>
					<ReceiptActions
						receipt={{
							orderId: order.id,
							orderCode,
							receiptTitle: "Receipt",
							restaurantName: order.restaurant.name,
							customerName: order.customerName,
							status: order.status,
							paymentStatus: order.paymentStatus,
							orderType: order.type,
							total: Number(order.total),
							currency: order.restaurant.currency,
							createdAt: order.createdAt.toISOString(),
							extraDetails: [
								...(order.status !== OrderStatus.CANCELLED && order.statusNote
									? [{ label: "Restaurant update", value: order.statusNote }]
									: []),
								...(order.status === OrderStatus.CANCELLED &&
								order.cancellationNote
									? [{ label: "Decline reason", value: order.cancellationNote }]
									: []),
								...(order.status === OrderStatus.CANCELLED
									? [
											{
												label: "Restaurant phone",
												value: order.restaurant.phone ?? "Not provided",
											},
											{
												label: "Restaurant address",
												value: order.restaurant.address ?? "Not provided",
											},
										]
									: []),
							],
							items: order.items.map((item) => ({
								name: item.name,
								qty: item.qty,
								unitPrice: Number(item.unitPrice),
								notes: item.notes,
							})),
						}}
						hidePrint={true}
					/>
					<div className="my-6 h-px w-full bg-slate-100" />

					{showProgress ? <OrderProgressTracker status={order.status} /> : null}
					{statusNotice ? <OrderStatusNotice notice={statusNotice} /> : null}
					{order.status !== OrderStatus.CANCELLED && order.statusNote ? (
						<div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
							<p className="text-xs font-black uppercase tracking-wider text-emerald-800">
								Restaurant update
							</p>
							<p className="mt-1.5 text-xs font-bold leading-relaxed text-slate-700">
								{order.statusNote}
							</p>
						</div>
					) : null}
					{order.type === "DINE_IN" ? (
						<p className="mt-4 rounded-2xl bg-slate-50 p-4 text-xs font-bold text-slate-700">
							{order.dineInServiceMode === "SERVED_BY_WAITER"
								? `Served by ${order.waiterName ?? "staff"}`
								: "Self-served"}
						</p>
					) : null}

					{canPayNow ? (
						<DineInPayNowButton
							orderId={order.id}
							slug={order.restaurant.slug}
							total={Number(order.total)}
							currency={order.restaurant.currency}
							policy={order.dineInPaymentPolicy}
							bankAccounts={order.restaurant.bankAccounts}
							orderType={order.type}
							onlineProviders={onlineProviders}
						/>
					) : null}
					<div className="mt-6 grid gap-3">
						{order.items.map((item) => (
							<div
								key={item.id}
								className="flex items-center justify-between gap-3 border-slate-100 border-b pb-3 last:border-b-0"
							>
								<div>
									<p className="text-sm font-black">{item.name}</p>
									<p className="text-xs font-medium text-slate-500">
										x{item.qty}
									</p>
								</div>
								<p className="text-sm font-black text-emerald-700">
									{formatMoney(
										Number(item.unitPrice) * item.qty,
										order.restaurant.currency,
									)}
								</p>
							</div>
						))}
					</div>
					<div className="mt-6 flex items-center justify-between border-slate-100 border-t pt-4">
						<span className="text-xs font-bold text-slate-600">Total</span>
						<span className="text-lg font-black sm:text-2xl">
							{formatMoney(Number(order.total), order.restaurant.currency)}
						</span>
					</div>
					{canAddMore ? (
						<Link
							href={`/${order.restaurant.slug}?orderId=${order.id}`}
							className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-xs font-semibold text-white sm:text-sm"
						>
							Add More Items
						</Link>
					) : null}
					{canRate ? (
						<Link
							href={`/${order.restaurant.slug}/rate/${order.id}`}
							className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-emerald-700 bg-white px-4 text-xs font-black text-emerald-700 hover:bg-emerald-50 sm:text-sm"
						>
							Rate your experience
						</Link>
					) : null}
					{order.rating ? (
						<div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center">
							<p className="text-xs font-black text-emerald-800">
								Thanks for rating your experience!
							</p>
						</div>
					) : null}
				</section>
			</div>
		</main>
	);
}
