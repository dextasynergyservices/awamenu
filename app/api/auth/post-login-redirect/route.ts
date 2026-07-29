import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
	const session = await getSession();

	if (!session?.user) {
		return NextResponse.json({ suspended: false, path: "/login" });
	}

	const record = await db.user.findUnique({
		where: { id: session.user.id },
		select: { role: true, isActive: true, suspensionReason: true },
	});

	if (record && !record.isActive) {
		// Invalidate the session that sign-in just created — a suspended
		// account should never end up with a usable session.
		await db.session.deleteMany({ where: { userId: session.user.id } });
		return NextResponse.json({
			suspended: true,
			reason: record.suspensionReason ?? "",
		});
	}

	const path =
		record?.role === UserRole.SUPER_ADMIN
			? "/super-admin"
			: "/onboarding/choose-plan";

	return NextResponse.json({ suspended: false, path });
}
