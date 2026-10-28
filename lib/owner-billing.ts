import { BILLING_INTERVAL_DETAILS, parseBillingInterval } from "@/lib/billing";
import {
	type BillingState,
	billingStateOf,
	daysLeft,
	isAutoRenewing,
	lapsedAt,
	subscriptionPrice,
} from "@/lib/billing-state";
import { db } from "@/lib/db";

/**
 * The owner's billing page and invoices: the current plan, what's due (or
 * next), and every subscription charge as an invoice. Built from the
 * subscription ledger (`SubscriptionPayment`), which records every charge
 * exactly once.
 */

export type InvoiceStatus = "PAID" | "REFUSED" | "REFUNDED";

export type Invoice = {
	id: string;
	number: string;
	issuedAt: string;
	planName: string;
	intervalLabel: string;
	description: string;
	amount: number;
	currency: string;
	status: InvoiceStatus;
	reference: string;
	gateway: string;
	paymentMethod: string | null;
	note: string | null;
};

export type BillingDue =
	| { kind: "none" }
	| { kind: "free" }
	/** Auto-renew on: the card is charged on this date. */
	| { kind: "next_charge"; amount: number; date: string }
	/** Auto-renew off and still in date: renew before it ends. */
	| { kind: "upcoming"; amount: number; date: string; daysLeft: number }
	/** Ended, inside grace: still working, pay now. */
	| { kind: "due"; amount: number; dueSince: string; readOnlyOn: string }
	/** Past grace: read-only until paid. */
	| { kind: "overdue"; amount: number; dueSince: string };

/** "INV-20261027-7K2M9Q": the payment date plus the record's tail, stable. */
export function invoiceNumber(id: string, createdAt: Date) {
	const d = createdAt.toISOString().slice(0, 10).replaceAll("-", "");
	return `INV-${d}-${id.slice(-6).toUpperCase()}`;
}

function paymentMethodOf(raw: unknown): string | null {
	if (!raw || typeof raw !== "object") return null;
	const auth = (raw as { authorization?: Record<string, unknown> })
		.authorization;
	if (!auth) return null;
	const last4 = typeof auth.last4 === "string" ? auth.last4 : null;
	const brand =
		typeof auth.card_type === "string"
			? auth.card_type.trim()
			: typeof auth.brand === "string"
				? auth.brand
				: null;
	if (last4) {
		const name = brand
			? brand.charAt(0).toUpperCase() + brand.slice(1)
			: "Card";
		return `${name} •••• ${last4}`;
	}
	const channel = typeof auth.channel === "string" ? auth.channel : null;
	return channel ? channel.replaceAll("_", " ") : null;
}

const STATUS: Record<string, InvoiceStatus> = {
	SUCCESS: "PAID",
	MISMATCH: "REFUSED",
	REVERSED: "REFUNDED",
};

async function loadInvoices(
	restaurantId: string,
	subscriptionId: string | null,
) {
	const payments = await db.subscriptionPayment.findMany({
		where: {
			OR: [
				{ restaurantId },
				// The first charge happens during onboarding, before the
				// restaurant exists; it's linked through the subscription.
				...(subscriptionId ? [{ subscriptionId }] : []),
			],
		},
		orderBy: { createdAt: "desc" },
		take: 100,
	});
	const planIds = [...new Set(payments.map((p) => p.planId))];
	const plans = planIds.length
		? await db.plan.findMany({
				where: { id: { in: planIds } },
				select: { id: true, name: true },
			})
		: [];
	const planName = new Map(plans.map((p) => [p.id, p.name]));

	return payments.map((p): Invoice => {
		const interval = parseBillingInterval(p.billingInterval);
		const intervalLabel = BILLING_INTERVAL_DETAILS[interval].label;
		const name = planName.get(p.planId) ?? "Subscription";
		return {
			id: p.id,
			number: invoiceNumber(p.id, p.createdAt),
			issuedAt: p.createdAt.toISOString(),
			planName: name,
			intervalLabel,
			description: `${name} plan · ${intervalLabel}${p.kind === "RENEWAL" ? " renewal" : ""}`,
			amount: Number(p.amount),
			currency: p.currency,
			status: STATUS[p.status] ?? "PAID",
			reference: p.reference,
			gateway: p.gateway,
			paymentMethod: paymentMethodOf(p.rawPayload),
			note: p.note,
		};
	});
}

export async function getOwnerBilling(slug: string, userId: string) {
	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: userId },
		select: {
			id: true,
			name: true,
			slug: true,
			subscription: {
				select: {
					id: true,
					currentPeriodStart: true,
					currentPeriodEnd: true,
					billingInterval: true,
					status: true,
					paystackSubscriptionCode: true,
					paystackCustomerCode: true,
					plan: {
						select: {
							id: true,
							name: true,
							monthlyPrice: true,
							quarterlyPrice: true,
							yearlyPrice: true,
						},
					},
				},
			},
		},
	});
	if (!restaurant) return null;

	const sub = restaurant.subscription;
	const state: BillingState = billingStateOf(sub);
	const price = sub ? subscriptionPrice(sub) : 0;
	const interval = sub ? parseBillingInterval(sub.billingInterval) : null;
	const autoRenew = isAutoRenewing(sub);

	let due: BillingDue = { kind: "none" };
	if (state === "FREE") due = { kind: "free" };
	else if (sub && price > 0) {
		const end = sub.currentPeriodEnd.toISOString();
		if (state === "LAPSED")
			due = { kind: "overdue", amount: price, dueSince: end };
		else if (state === "GRACE") {
			due = {
				kind: "due",
				amount: price,
				dueSince: end,
				readOnlyOn: lapsedAt(sub.currentPeriodEnd).toISOString(),
			};
		} else if (autoRenew)
			due = { kind: "next_charge", amount: price, date: end };
		else {
			due = {
				kind: "upcoming",
				amount: price,
				date: end,
				daysLeft: daysLeft(sub.currentPeriodEnd),
			};
		}
	}

	const invoices = await loadInvoices(restaurant.id, sub?.id ?? null);
	const paid = invoices.filter((i) => i.status === "PAID");

	return {
		restaurant: {
			id: restaurant.id,
			name: restaurant.name,
			slug: restaurant.slug,
		},
		plan: sub
			? {
					id: sub.plan.id,
					name: sub.plan.name,
					price,
					interval,
					intervalLabel: interval
						? BILLING_INTERVAL_DETAILS[interval].label
						: null,
					periodStart: sub.currentPeriodStart.toISOString(),
					periodEnd: sub.currentPeriodEnd.toISOString(),
					autoRenew,
					hasCard: Boolean(sub.paystackCustomerCode),
				}
			: null,
		state,
		due,
		invoices,
		totals: {
			paidCount: paid.length,
			paidTotal: paid.reduce((t, i) => t + i.amount, 0),
		},
	};
}

/** One invoice, scoped to the owner's restaurant. */
export async function getOwnerInvoice(
	slug: string,
	userId: string,
	id: string,
) {
	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: userId },
		select: {
			id: true,
			name: true,
			address: true,
			phone: true,
			owner: { select: { name: true, email: true } },
			subscription: { select: { id: true } },
		},
	});
	if (!restaurant) return null;
	const invoices = await loadInvoices(
		restaurant.id,
		restaurant.subscription?.id ?? null,
	);
	const invoice = invoices.find((i) => i.id === id);
	if (!invoice) return null;

	const settings = await db.platformSetting.findFirst({
		select: {
			platformName: true,
			legalCompanyName: true,
			legalAddress: true,
			legalRcNumber: true,
			legalContactEmail: true,
		},
	});
	return {
		invoice,
		billedTo: {
			restaurantName: restaurant.name,
			ownerName: restaurant.owner.name,
			email: restaurant.owner.email,
			address: restaurant.address,
			phone: restaurant.phone,
		},
		issuer: {
			name: settings?.legalCompanyName || settings?.platformName || "AwaMenu",
			tradingAs: settings?.platformName || "AwaMenu",
			address: settings?.legalAddress ?? null,
			rcNumber: settings?.legalRcNumber ?? null,
			email: settings?.legalContactEmail || "hello@awamenu.com",
		},
	};
}
