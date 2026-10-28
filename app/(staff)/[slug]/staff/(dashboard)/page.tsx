import { OrderStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StaffMenuAvailability } from "@/components/staff/StaffMenuAvailability";
import { StaffOrderFeed } from "@/components/staff/StaffOrderFeed";
import { db } from "@/lib/db";
import { isSoldOut } from "@/lib/menu-tags";
import { formatInTimeZone } from "@/lib/zoned-time";

export default async function StaffDashboardPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const restaurant = await db.restaurant.findUnique({
		where: { slug, isActive: true },
		select: {
			id: true,
			name: true,
			slug: true,
			currency: true,
			timezone: true,
			staffDefaultDineIn: true,
			staffDefaultPickup: true,
			staffDefaultDelivery: true,
			staffDefaultCashPayment: true,
			staffDefaultApproveReservations: true,
		},
	});

	if (!restaurant) {
		redirect(`/`);
	}

	// Published dishes, for the Menu (sold-out) panel.
	const menuCategories = await db.menuCategory.findMany({
		where: { restaurantId: restaurant.id, isActive: true },
		orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
		select: {
			id: true,
			name: true,
			items: {
				where: { isAvailable: true },
				orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
				select: { id: true, name: true, soldOutUntil: true },
			},
		},
	});
	const staffMenu = menuCategories
		.filter((c) => c.items.length > 0)
		.map((c) => ({
			id: c.id,
			name: c.name,
			items: c.items.map((i) => ({
				id: i.id,
				name: i.name,
				soldOut: isSoldOut(i.soldOutUntil),
			})),
		}));

	// Fetch active orders
	const orders = await db.order.findMany({
		where: {
			restaurantId: restaurant.id,
			status: {
				in: [
					OrderStatus.PENDING_APPROVAL,
					OrderStatus.PENDING_PAYMENT,
					OrderStatus.CONFIRMED,
					OrderStatus.PREPARING,
					OrderStatus.READY,
				],
			},
		},
		orderBy: { createdAt: "desc" },
		take: 100,
		select: {
			id: true,
			type: true,
			status: true,
			customerName: true,
			customerPhone: true,
			customerEmail: true,
			tableNumber: true,
			total: true,
			subtotal: true,
			paymentStatus: true,
			dineInPaymentPolicy: true,
			dineInPaymentMethod: true,
			deliveryAddress: true,
			deliveryNotes: true,
			createdAt: true,
			items: {
				select: {
					id: true,
					name: true,
					qty: true,
					unitPrice: true,
					notes: true,
				},
			},
			payments: {
				select: {
					amount: true,
					method: true,
				},
			},
		},
	});

	// Requests to approve, plus tonight's confirmed bookings so staff at the
	// door can see who's coming and check them in.
	const now = Date.now();
	const rawReservations = await db.reservation.findMany({
		where: {
			restaurantId: restaurant.id,
			OR: [
				{ status: "PENDING_APPROVAL" },
				{
					status: "ACTIVE",
					startsAt: {
						gte: new Date(now - 3 * 60 * 60 * 1000),
						lte: new Date(now + 24 * 60 * 60 * 1000),
					},
				},
			],
		},
		orderBy: { startsAt: "asc" },
		take: 50,
		select: {
			id: true,
			customerName: true,
			customerPhone: true,
			startsAt: true,
			partySize: true,
			status: true,
			table: { select: { label: true } },
		},
	});

	const pendingReservations = rawReservations.map((r) => ({
		id: r.id,
		customerName: r.customerName,
		customerPhone: r.customerPhone,
		date: r.startsAt.toISOString(),
		// In the restaurant's timezone. toLocaleTimeString() here used the
		// server's clock — UTC on Vercel — so staff saw every booking an hour
		// off.
		dateLabel: formatInTimeZone(r.startsAt, restaurant.timezone, {
			weekday: "short",
			day: "numeric",
			month: "short",
		}),
		time: formatInTimeZone(r.startsAt, restaurant.timezone, {
			hour: "2-digit",
			minute: "2-digit",
		}),
		guestCount: r.partySize,
		tableLabel: r.table.label,
		status: r.status,
	}));

	const serializedOrders = orders.map((o) => ({
		id: o.id,
		type: o.type,
		status: o.status,
		customerName: o.customerName,
		customerPhone: o.customerPhone,
		customerEmail: o.customerEmail,
		tableNumber: o.tableNumber,
		total: Number(o.total),
		subtotal: Number(o.subtotal),
		paymentStatus: o.paymentStatus,
		dineInPaymentPolicy: o.dineInPaymentPolicy,
		dineInPaymentMethod: o.dineInPaymentMethod,
		deliveryAddress: o.deliveryAddress,
		deliveryNotes: o.deliveryNotes,
		createdAt: o.createdAt.toISOString(),
		items: o.items.map((i) => ({
			id: i.id,
			name: i.name,
			qty: i.qty,
			unitPrice: Number(i.unitPrice),
			notes: i.notes,
		})),
		payments: o.payments.map((p) => ({
			method: p.method,
			amount: Number(p.amount),
		})),
	}));

	return (
		<Suspense
			fallback={
				<div className="p-8 text-center text-sm font-medium text-slate-500">
					Loading orders...
				</div>
			}
		>
			{/* ✅ Responsive container */}
			<div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:py-8 lg:px-8">
				<div className="mb-4 flex justify-end">
					<StaffMenuAvailability
						slug={restaurant.slug}
						categories={staffMenu}
					/>
				</div>
				<StaffOrderFeed
					orders={serializedOrders}
					reservations={pendingReservations}
					currency={restaurant.currency}
					slug={restaurant.slug}
				/>
			</div>
		</Suspense>
	);
}
