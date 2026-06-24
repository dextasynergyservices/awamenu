import { redirect } from "next/navigation";
import { AdminDashboardShell } from "@/components/admin/admin-dashboard-shell";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";

export default async function DashboardLayout({
	children,
	params,
}: Readonly<{
	children: React.ReactNode;
	params: Promise<{ slug: string }>;
}>) {
	const user = await requireUser();
	const { slug } = await params;
	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		select: { id: true, name: true, slug: true, logoUrl: true },
	});

	if (!restaurant) redirect("/onboarding/choose-plan");

	return (
		<AdminDashboardShell
			restaurantName={restaurant.name}
			restaurantLogoUrl={restaurant.logoUrl}
			slug={restaurant.slug}
		>
			{children}
		</AdminDashboardShell>
	);
}
