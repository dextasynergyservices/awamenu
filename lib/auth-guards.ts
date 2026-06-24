import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function requireUser() {
	const session = await getSession();

	if (!session?.user) {
		redirect("/login");
	}

	return session.user;
}

export async function redirectCompletedOnboarding(userId: string) {
	const user = await db.user.findUnique({
		where: { id: userId },
		select: {
			onboardingStatus: true,
			restaurants: {
				select: { slug: true },
				orderBy: { createdAt: "asc" },
				take: 1,
			},
		},
	});

	if (user?.onboardingStatus === "COMPLETE" && user.restaurants[0]) {
		redirect(`/dashboard/${user.restaurants[0].slug}`);
	}
}
