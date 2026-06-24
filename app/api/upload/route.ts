import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createCloudinarySignedUpload } from "@/lib/cloudinary";
import { db } from "@/lib/db";

const uploadSchema = z.object({
	restaurantId: z.string().cuid(),
	kind: z.enum(["logo", "cover", "item"]),
	contentType: z.enum(["image/webp", "image/jpeg", "image/png"]),
});

export async function POST(request: Request) {
	const session = await getSession();

	if (!session?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const input = uploadSchema.parse(await request.json());
	const restaurant = await db.restaurant.findFirst({
		where: {
			id: input.restaurantId,
			ownerId: session.user.id,
		},
		select: { id: true },
	});

	if (!restaurant) {
		return NextResponse.json({ error: "Not found" }, { status: 404 });
	}

	const publicId = input.kind === "logo" ? input.kind : randomUUID();
	const folder =
		input.kind === "item"
			? `restaurants/${restaurant.id}/items`
			: `restaurants/${restaurant.id}`;
	const signedUpload = createCloudinarySignedUpload({ folder, publicId });

	return NextResponse.json({
		...signedUpload,
	});
}
