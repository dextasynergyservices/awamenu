import { OrderStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StaffOrderFeed } from "@/components/staff/StaffOrderFeed";
import { db } from "@/lib/db";

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

	const rawReservations = await db.reservation.findMany({
		where: {
			restaurantId: restaurant.id,
			status: "PENDING_APPROVAL",
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
		time: r.startsAt.toLocaleTimeString([], {
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
			<StaffOrderFeed
				orders={serializedOrders}
				reservations={pendingReservations}
				currency={restaurant.currency}
				slug={restaurant.slug}
			/>
		</Suspense>
	);
}
