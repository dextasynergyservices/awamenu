import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/lib/db";
import { getClientIpFromRequest, getRatelimiter } from "@/lib/ratelimit";

type QrRouteProps = {
	params: Promise<{ slug: string }>;
};

export async function GET(request: NextRequest, { params }: QrRouteProps) {
	const { slug } = await params;
	const restaurant = await db.restaurant.findFirst({
		where: { slug, isActive: true },
		select: { id: true },
	});

	const redirectUrl = new URL(`/${slug}`, env.NEXT_PUBLIC_APP_URL);

	// 302, not 301: browsers cache a permanent redirect, so every repeat scan
	// from the same phone skipped this route and went uncounted.
	if (!restaurant) {
		return NextResponse.redirect(redirectUrl, 302);
	}

	const limiter = getRatelimiter("qrScan");
	const counted = limiter
		? await limiter
				.limit(`${getClientIpFromRequest(request)}:${restaurant.id}`)
				.then((result) => result.success)
				.catch(() => true)
		: true;

	if (counted) {
		await db.scanEvent.create({
			data: {
				restaurantId: restaurant.id,
				userAgent: request.headers.get("user-agent"),
				country: request.headers.get("cf-ipcountry"),
			},
		});
	}

	return NextResponse.redirect(redirectUrl, 302);
}
