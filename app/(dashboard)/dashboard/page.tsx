import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";

/**
 * Canonical "take me to my dashboard" URL.
 *
 * Nothing linked here before — the only dashboard routes were slug-scoped, so
 * anywhere that wanted to point a signed-in owner at their dashboard had to
 * already know their restaurant's slug. The marketing header needs exactly
 * this (it runs on a static page and can't look the slug up server-side).
 */
export default async function DashboardIndexPage() {
	const user = await requireUser();

	const restaurant = await db.restaurant.findFirst({
		where: { ownerId: user.id },
		orderBy: { createdAt: "asc" },
		select: { slug: true },
	});

	if (!restaurant) redirect("/onboarding/choose-plan");

	redirect(`/dashboard/${restaurant.slug}`);
}
