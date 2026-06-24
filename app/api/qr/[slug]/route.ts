import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/env";
import { db } from "@/lib/db";

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

	if (!restaurant) {
		return NextResponse.redirect(redirectUrl, 301);
	}

	await db.scanEvent.create({
		data: {
			restaurantId: restaurant.id,
			userAgent: request.headers.get("user-agent"),
			country: request.headers.get("cf-ipcountry"),
		},
	});

	return NextResponse.redirect(redirectUrl, 301);
}
