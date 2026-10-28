import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createCloudinarySignedUpload } from "@/lib/cloudinary";
import { db } from "@/lib/db";

const schema = z.object({
	kind: z.enum(["logo"]),
	contentType: z.enum(["image/webp", "image/jpeg", "image/png"]),
});

/** Signed Cloudinary upload for platform branding. Super admins only. */
export async function POST(request: Request) {
	const session = await getSession();
	if (!session?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	const user = await db.user.findUnique({
		where: { id: session.user.id },
		select: { role: true },
	});
	if (user?.role !== UserRole.SUPER_ADMIN) {
		return NextResponse.json({ error: "Forbidden" }, { status: 403 });
	}
	const parsed = schema.safeParse(await request.json());
	if (!parsed.success) {
		return NextResponse.json(
			{ error: "Use a PNG, JPG or WebP image." },
			{ status: 400 },
		);
	}
	return NextResponse.json(
		createCloudinarySignedUpload({
			folder: "platform",
			publicId: parsed.data.kind,
		}),
	);
}
