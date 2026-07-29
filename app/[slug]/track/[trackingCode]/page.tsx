import { redirect } from "next/navigation";
import { TrackingUnavailable } from "@/components/tracking/TrackingUnavailable";
import { db } from "@/lib/db";

type TrackPageProps = {
	params: Promise<{ slug: string; trackingCode: string }>;
};

export const dynamic = "force-dynamic";

function normalizeTrackingCode(value: string) {
	return decodeURIComponent(value).replace(/^#/, "").trim();
}

export default async function TrackPage({ params }: TrackPageProps) {
	const { slug, trackingCode } = await params;
	const cleanCode = normalizeTrackingCode(trackingCode);

	if (!cleanCode) {
		return (
			<TrackingUnavailable restaurantSlug={slug} trackingCode={trackingCode} />
		);
	}

	const lowerCode = cleanCode.toLowerCase();
	const order = await db.order.findFirst({
		where: {
			restaurant: { slug, isActive: true },
			OR: [
				{ id: cleanCode },
				{ id: lowerCode },
				{ id: { endsWith: lowerCode } },
			],
		},
		select: { id: true },
	});

	if (order) {
		redirect(`/${slug}/order/${order.id}`);
	}

	const reservation = await db.reservation.findFirst({
		where: {
			restaurant: { slug, isActive: true },
			OR: [
				{ id: cleanCode },
				{ id: lowerCode },
				{ id: { endsWith: lowerCode } },
			],
		},
		select: { id: true },
	});

	if (reservation) {
		redirect(`/${slug}/reservation/${reservation.id}`);
	}

	return <TrackingUnavailable restaurantSlug={slug} trackingCode={cleanCode} />;
}
