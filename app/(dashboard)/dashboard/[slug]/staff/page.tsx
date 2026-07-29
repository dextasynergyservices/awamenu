import { redirect } from "next/navigation";
import { StaffManager } from "@/components/admin/StaffManager";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";

export default async function StaffPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const user = await requireUser();
	const { slug } = await params;

	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		select: {
			id: true,
			slug: true,
			name: true,
			staffDefaultDineIn: true,
			staffDefaultPickup: true,
			staffDefaultDelivery: true,
			staffDefaultCashPayment: true,
			staffDefaultApproveReservations: true,
			staff: {
				orderBy: { createdAt: "desc" },
				select: {
					id: true,
					name: true,
					staffId: true,
					isActive: true,
					canHandleDineIn: true,
					canHandlePickup: true,
					canHandleDelivery: true,
					canRecordCashPayment: true,
					canApproveReservations: true,
					createdAt: true,
					_count: { select: { orders: true } },
				},
			},
		},
	});

	if (!restaurant) redirect("/onboarding/choose-plan");

	const staffList = restaurant.staff.map((s) => ({
		id: s.id,
		name: s.name,
		staffId: s.staffId,
		isActive: s.isActive,
		canHandleDineIn: s.canHandleDineIn,
		canHandlePickup: s.canHandlePickup,
		canHandleDelivery: s.canHandleDelivery,
		canRecordCashPayment: s.canRecordCashPayment,
		canApproveReservations: s.canApproveReservations,
		createdAt: s.createdAt.toISOString(),
		orderCount: s._count.orders,
	}));

	return (
		<StaffManager
			slug={restaurant.slug}
			staffList={staffList}
			globalPermissions={{
				staffDefaultDineIn: restaurant.staffDefaultDineIn,
				staffDefaultPickup: restaurant.staffDefaultPickup,
				staffDefaultDelivery: restaurant.staffDefaultDelivery,
				staffDefaultCashPayment: restaurant.staffDefaultCashPayment,
				staffDefaultApproveReservations:
					restaurant.staffDefaultApproveReservations,
			}}
		/>
	);
}
