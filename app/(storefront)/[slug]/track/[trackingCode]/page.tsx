import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TrackingUnavailable } from "@/components/tracking/TrackingUnavailable";
import { privateStorefrontMetadata } from "@/lib/storefront-share";
import {
	normalizeTrackingCode,
	resolveTrackingCode,
} from "@/lib/tracking-code";

/** The restaurant's name in the tab and link preview; never indexed. */
export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	return privateStorefrontMetadata(slug, "Track your delivery");
}

type TrackPageProps = {
	params: Promise<{ slug: string; trackingCode: string }>;
};

export const dynamic = "force-dynamic";

/**
 * "Track my order" by the code on the receipt. Accepts the full id or the exact
 * 6-character code, nothing shorter (see lib/tracking-code.ts).
 */
export default async function TrackPage({ params }: TrackPageProps) {
	const { slug, trackingCode } = await params;
	const cleanCode = normalizeTrackingCode(trackingCode);

	if (cleanCode) {
		const orderId = await resolveTrackingCode("order", slug, cleanCode);
		if (orderId) redirect(`/${slug}/order/${orderId}`);

		const reservationId = await resolveTrackingCode(
			"reservation",
			slug,
			cleanCode,
		);
		if (reservationId) redirect(`/${slug}/reservation/${reservationId}`);
	}

	return (
		<TrackingUnavailable
			restaurantSlug={slug}
			trackingCode={cleanCode || trackingCode}
		/>
	);
}
