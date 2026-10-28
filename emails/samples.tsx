import type { ReactElement } from "react";
import { type EmailBrand, platformBrand, restaurantBrand } from "./brand";
import {
	type BookingFacts,
	CustomerCodeEmail,
	OrderCancelledEmail,
	OrderCompletedEmail,
	OrderConfirmedEmail,
	OrderReceiptEmail,
	ReservationAwaitingPaymentEmail,
	ReservationCancelledEmail,
	ReservationConfirmedEmail,
	ReservationDeclinedEmail,
	ReservationReleasedEmail,
	ReservationRequestedEmail,
} from "./customer";
import {
	AutoRenewalUpcomingEmail,
	ExpiryUpcomingEmail,
	GracePeriodEmail,
	LapsedEmail,
	NewOrderEmail,
	OwnerBookingRequestEmail,
	OwnerGuestCancelledEmail,
	OwnerPaymentReceivedEmail,
	PasswordResetEmail,
	PayoutChangedEmail,
	ReactivatedEmail,
	RenewalReceiptEmail,
	SubscriptionConfirmedEmail,
	VerifyEmail,
	WelcomeEmail,
} from "./owner";

/**
 * Every email with sample data, for the Super Admin preview page. Guest emails
 * can be shown in three restaurant brands to check colour handling and the
 * "Powered by AwaMenu" line.
 */

export const SAMPLE_BRANDS = {
	branded: "Own branding (paid plan)",
	powered: "With AwaMenu badge (free plan)",
	light: "Pale brand colour",
} as const;
export type SampleBrandKey = keyof typeof SAMPLE_BRANDS;

function sampleRestaurant(key: SampleBrandKey, appUrl: string): EmailBrand {
	const base = {
		slug: "mamas-kitchen",
		logoUrl: null,
		address: "12 Admiralty Way, Lekki Phase 1, Lagos",
		phone: "+234 801 234 5678",
		appUrl,
	};
	if (key === "powered") {
		return restaurantBrand({
			...base,
			name: "Mama's Kitchen",
			primaryColor: null,
			poweredBy: true,
		});
	}
	if (key === "light") {
		return restaurantBrand({
			...base,
			name: "Sunny Side Café",
			primaryColor: "#facc15",
			poweredBy: false,
		});
	}
	return restaurantBrand({
		...base,
		name: "Edis Bar & Grill",
		primaryColor: "#7c2d12",
		poweredBy: false,
	});
}

export type EmailSample = {
	key: string;
	group:
		| "Guest: orders"
		| "Guest: bookings"
		| "Guest: sign-in"
		| "Owner: activity"
		| "Owner: account and billing";
	label: string;
	subject: string;
	/** Guest emails follow the selected restaurant brand. */
	branded: boolean;
	render: (brand: EmailBrand) => ReactElement;
};

const items = [
	{ name: "Jollof rice with chicken", quantity: 2, amount: "₦9,000" },
	{ name: "Peppered snail", quantity: 1, amount: "₦6,500" },
	{ name: "Chapman", quantity: 2, amount: "₦3,000" },
];
const booking: BookingFacts = {
	reference: "K7Q2ZD",
	when: "Friday, 6 November 2026 at 7:30 pm",
	table: "Table 4 (window)",
	partySize: 4,
	note: "Birthday dinner, a cake is coming",
	amount: ["Paid", "₦10,000"],
};

export function emailSamples(appUrl: string): EmailSample[] {
	const url = (path: string) => `${appUrl}${path}`;
	const order = {
		customerName: "Ada",
		reference: "A3F29C",
		orderUrl: url("/mamas-kitchen/order/x"),
	};
	const guest = {
		customerName: "Ada",
		booking,
		viewUrl: url("/mamas-kitchen/reservation/x"),
	};
	const dash = url("/dashboard/mamas-kitchen");
	return [
		{
			key: "order-confirmed",
			group: "Guest: orders",
			label: "Order accepted",
			subject: "Order #A3F29C confirmed",
			branded: true,
			render: (brand) =>
				OrderConfirmedEmail({
					brand,
					...order,
					orderType: "Delivery",
					items,
					total: "₦18,500",
				}),
		},
		{
			key: "order-receipt",
			group: "Guest: orders",
			label: "Payment receipt",
			subject: "Your receipt for order #A3F29C",
			branded: true,
			render: (brand) =>
				OrderReceiptEmail({
					brand,
					...order,
					orderType: "Dine-in",
					items,
					total: "₦18,500",
					paymentMethod: "Card (Paystack)",
					fulfilmentDetail: "Table 4",
				}),
		},
		{
			key: "order-completed",
			group: "Guest: orders",
			label: "Order complete",
			subject: "Thanks for your order #A3F29C",
			branded: true,
			render: (brand) =>
				OrderCompletedEmail({
					brand,
					...order,
					summary: "Your order has been delivered.",
					total: "₦18,500",
				}),
		},
		{
			key: "order-cancelled",
			group: "Guest: orders",
			label: "Order cancelled (paid)",
			subject: "Order #A3F29C was cancelled",
			branded: true,
			render: (brand) =>
				OrderCancelledEmail({
					brand,
					...order,
					reason: "We've run out of snails for today.",
					paid: true,
				}),
		},
		{
			key: "booking-requested",
			group: "Guest: bookings",
			label: "Request received",
			subject: "We've received your table request",
			branded: true,
			render: (brand) =>
				ReservationRequestedEmail({
					brand,
					...guest,
					booking: { ...booking, amount: null },
				}),
		},
		{
			key: "booking-awaiting-payment",
			group: "Guest: bookings",
			label: "Approved, pay now",
			subject: "Approved: pay now to secure your table",
			branded: true,
			render: (brand) =>
				ReservationAwaitingPaymentEmail({
					brand,
					...guest,
					booking: { ...booking, amount: ["Amount due", "₦10,000"] },
					payBy: "Wednesday, 4 November 2026 at 6:00 pm",
				}),
		},
		{
			key: "booking-confirmed",
			group: "Guest: bookings",
			label: "Table confirmed",
			subject: "Your table is confirmed",
			branded: true,
			render: (brand) => ReservationConfirmedEmail({ brand, ...guest }),
		},
		{
			key: "booking-declined",
			group: "Guest: bookings",
			label: "Request declined",
			subject: "We can't take your table booking",
			branded: true,
			render: (brand) =>
				ReservationDeclinedEmail({
					brand,
					customerName: "Ada",
					when: booking.when,
					reason: "We're fully booked for a private event.",
					paid: false,
					bookUrl: url("/mamas-kitchen/tables"),
				}),
		},
		{
			key: "booking-cancelled-restaurant",
			group: "Guest: bookings",
			label: "Cancelled by restaurant (refund)",
			subject: "Your table booking has been cancelled",
			branded: true,
			render: (brand) =>
				ReservationCancelledEmail({
					brand,
					...guest,
					by: "restaurant",
					reason: "The kitchen is closed for repairs that evening.",
					refund: "₦10,000",
				}),
		},
		{
			key: "booking-cancelled-guest",
			group: "Guest: bookings",
			label: "Cancelled by guest",
			subject: "Your booking is cancelled",
			branded: true,
			render: (brand) =>
				ReservationCancelledEmail({
					brand,
					...guest,
					by: "guest",
					reason: null,
					refund: null,
				}),
		},
		{
			key: "booking-released",
			group: "Guest: bookings",
			label: "Hold released (unpaid)",
			subject: "Your table is no longer held",
			branded: true,
			render: (brand) =>
				ReservationReleasedEmail({
					brand,
					customerName: "Ada",
					when: booking.when,
					reason: "PAYMENT_WINDOW_ENDED",
					bookUrl: url("/mamas-kitchen/tables"),
				}),
		},
		{
			key: "guest-code",
			group: "Guest: sign-in",
			label: "Sign-in code",
			subject: "482913 is your restaurant code",
			branded: true,
			render: (brand) => CustomerCodeEmail({ brand, code: "482913" }),
		},
		{
			key: "owner-new-order",
			group: "Owner: activity",
			label: "New order",
			subject: "New delivery order #A3F29C · ₦18,500",
			branded: false,
			render: (brand) =>
				NewOrderEmail({
					brand,
					restaurantName: "Mama's Kitchen",
					reference: "A3F29C",
					orderType: "Delivery",
					customerName: "Ada",
					items,
					total: "₦18,500",
					dashboardUrl: dash,
				}),
		},
		{
			key: "owner-payment",
			group: "Owner: activity",
			label: "Payment received",
			subject: "₦18,500 received for order #A3F29C",
			branded: false,
			render: (brand) =>
				OwnerPaymentReceivedEmail({
					brand,
					restaurantName: "Mama's Kitchen",
					reference: "A3F29C",
					orderType: "Delivery",
					customerName: "Ada",
					total: "₦18,500",
					paymentMethod: "Card (Paystack)",
					dashboardUrl: dash,
				}),
		},
		{
			key: "owner-booking-request",
			group: "Owner: activity",
			label: "Booking needs approval",
			subject: "Booking request: Ada, Friday 7:30 pm",
			branded: false,
			render: (brand) =>
				OwnerBookingRequestEmail({
					brand,
					restaurantName: "Mama's Kitchen",
					customerName: "Ada",
					when: booking.when,
					table: booking.table,
					partySize: 4,
					note: booking.note,
					dashboardUrl: dash,
				}),
		},
		{
			key: "owner-guest-cancelled",
			group: "Owner: activity",
			label: "Guest cancelled (refund)",
			subject: "Ada cancelled their booking",
			branded: false,
			render: (brand) =>
				OwnerGuestCancelledEmail({
					brand,
					restaurantName: "Mama's Kitchen",
					customerName: "Ada",
					when: booking.when,
					table: booking.table,
					refund: "₦10,000",
					dashboardUrl: dash,
				}),
		},
		{
			key: "verify",
			group: "Owner: account and billing",
			label: "Confirm email",
			subject: "Confirm your AwaMenu email address",
			branded: false,
			render: (brand) =>
				VerifyEmail({ brand, verifyUrl: url("/verify-email"), code: "381204" }),
		},
		{
			key: "password-reset",
			group: "Owner: account and billing",
			label: "Password reset code",
			subject: "381204 is your AwaMenu password reset code",
			branded: false,
			render: (brand) => PasswordResetEmail({ brand, code: "381204" }),
		},
		{
			key: "welcome",
			group: "Owner: account and billing",
			label: "Welcome",
			subject: "Welcome to AwaMenu, Mama's Kitchen",
			branded: false,
			render: (brand) =>
				WelcomeEmail({
					brand,
					restaurantName: "Mama's Kitchen",
					dashboardUrl: dash,
				}),
		},
		{
			key: "payout-changed",
			group: "Owner: account and billing",
			label: "Payout account changed",
			subject: "Payout account changed for Mama's Kitchen",
			branded: false,
			render: (brand) =>
				PayoutChangedEmail({
					brand,
					restaurantName: "Mama's Kitchen",
					previous: "GTBank ••••4821",
					next: "Access Bank ••••0937",
					settingsUrl: `${dash}/settings`,
				}),
		},
		{
			key: "subscription-confirmed",
			group: "Owner: account and billing",
			label: "Plan active",
			subject: "Your AwaMenu Pro plan is active",
			branded: false,
			render: (brand) =>
				SubscriptionConfirmedEmail({
					brand,
					planName: "Pro",
					continueUrl: url("/dashboard"),
				}),
		},
		{
			key: "renewal-receipt",
			group: "Owner: account and billing",
			label: "Renewal receipt",
			subject: "Receipt: Mama's Kitchen Pro plan renewed",
			branded: false,
			render: (brand) =>
				RenewalReceiptEmail({
					brand,
					restaurantName: "Mama's Kitchen",
					planName: "Pro",
					amount: "₦25,000",
					periodEnd: "27 November 2026",
					receiptUrl: `${dash}/billing`,
				}),
		},
		{
			key: "auto-renewal",
			group: "Owner: account and billing",
			label: "Auto-renewal coming",
			subject: "Mama's Kitchen renews in 7 days (₦25,000)",
			branded: false,
			render: (brand) =>
				AutoRenewalUpcomingEmail({
					brand,
					restaurantName: "Mama's Kitchen",
					daysLeft: 7,
					amount: "₦25,000",
					billingUrl: `${dash}/billing`,
				}),
		},
		{
			key: "expiry-upcoming",
			group: "Owner: account and billing",
			label: "Plan ending soon",
			subject: "Mama's Kitchen's plan ends in 3 days",
			branded: false,
			render: (brand) =>
				ExpiryUpcomingEmail({
					brand,
					restaurantName: "Mama's Kitchen",
					daysLeft: 3,
					renewUrl: `${dash}/renew`,
				}),
		},
		{
			key: "grace",
			group: "Owner: account and billing",
			label: "Plan ended (grace)",
			subject: "Action needed: Mama's Kitchen's plan has ended",
			branded: false,
			render: (brand) =>
				GracePeriodEmail({
					brand,
					restaurantName: "Mama's Kitchen",
					renewUrl: `${dash}/renew`,
				}),
		},
		{
			key: "lapsed",
			group: "Owner: account and billing",
			label: "Ordering paused (lapsed)",
			subject: "Mama's Kitchen has stopped taking orders",
			branded: false,
			render: (brand) =>
				LapsedEmail({
					brand,
					restaurantName: "Mama's Kitchen",
					renewUrl: `${dash}/renew`,
				}),
		},
		{
			key: "reactivated",
			group: "Owner: account and billing",
			label: "Reactivated",
			subject: "Mama's Kitchen is back online",
			branded: false,
			render: (brand) =>
				ReactivatedEmail({
					brand,
					restaurantName: "Mama's Kitchen",
					dashboardUrl: dash,
				}),
		},
	];
}

export function sampleBrandFor(
	sample: EmailSample,
	key: SampleBrandKey,
	appUrl: string,
) {
	return sample.branded ? sampleRestaurant(key, appUrl) : platformBrand(appUrl);
}
