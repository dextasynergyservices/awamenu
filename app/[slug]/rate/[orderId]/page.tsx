import { redirect } from "next/navigation";
import { SubscriptionInactive } from "@/components/menu/SubscriptionInactive";
import { RatingForm } from "@/components/rating/RatingForm";
import { TrackingUnavailable } from "@/components/tracking/TrackingUnavailable";
import { db } from "@/lib/db";
import {
	getRatingContext,
	isOrderRatingEligible,
	RATING_METRICS_BY_CONTEXT,
} from "@/lib/rating";
import { isSubscriptionActive } from "@/lib/subscription";

export const dynamic = "force-dynamic";

type RatePageProps = {
	params: Promise<{ slug: string; orderId: string }>;
};

export default async function RateOrderPage({ params }: RatePageProps) {
	const { slug, orderId } = await params;
	const cleanOrderId = decodeURIComponent(orderId).replace(/^#/, "").trim();

	const order = await db.order.findFirst({
		where: { id: cleanOrderId, restaurant: { slug } },
		select: {
			id: true,
			type: true,
			status: true,
			dineInPaymentPolicy: true,
			customerName: true,
			customerPhone: true,
			restaurant: {
				select: {
					name: true,
					slug: true,
					subscription: { select: { status: true, currentPeriodEnd: true } },
				},
			},
			rating: { select: { id: true } },
		},
	});

	if (!order) {
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

	if (order.rating || !isOrderRatingEligible(order)) {
		redirect(`/${order.restaurant.slug}/order/${order.id}`);
	}

	const context = getRatingContext(order.type);
	const metrics = RATING_METRICS_BY_CONTEXT[context];
	const orderCode = `#${order.id.slice(-6).toUpperCase()}`;

	return (
		<main className="min-h-screen bg-[#f6faf7] px-4 py-5 text-slate-950">
			<div className="mx-auto max-w-2xl">
				<section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl shadow-slate-200/40 md:p-8">
					<RatingForm
						orderId={order.id}
						slug={order.restaurant.slug}
						orderCode={orderCode}
						restaurantName={order.restaurant.name}
						metrics={metrics}
						customerName={order.customerName}
						customerPhone={order.customerPhone}
					/>
				</section>
			</div>
		</main>
	);
}
