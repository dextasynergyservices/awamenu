import { Resend } from "resend";
import { RestaurantWelcome } from "@/emails/RestaurantWelcome";
import { requireEnv } from "@/env";

function getResendClient() {
	return new Resend(requireEnv("RESEND_API_KEY"));
}

export async function sendRestaurantWelcomeEmail(input: {
	to: string;
	restaurantName: string;
	dashboardUrl: string;
}) {
	await getResendClient().emails.send({
		from: requireEnv("RESEND_FROM_EMAIL"),
		to: input.to,
		subject: `Welcome to AwaMenu, ${input.restaurantName}`,
		react: RestaurantWelcome(input),
	});
}

export async function sendSubscriptionConfirmationEmail(input: {
	to: string;
	planName: string;
}) {
	await getResendClient().emails.send({
		from: requireEnv("RESEND_FROM_EMAIL"),
		to: input.to,
		subject: "AwaMenu subscription confirmed",
		text: `Your ${input.planName} subscription is confirmed. Continue setup from your AwaMenu onboarding page.`,
	});
}

export async function sendOrderConfirmationEmail(input: {
	to: string;
	restaurantName: string;
	orderId: string;
	orderUrl: string;
	total: string;
}) {
	await getResendClient().emails.send({
		from: requireEnv("RESEND_FROM_EMAIL"),
		to: input.to,
		subject: `Order confirmed - ${input.restaurantName}`,
		text: `Your order #${input.orderId.slice(-6).toUpperCase()} from ${input.restaurantName} is confirmed. Total: ${input.total}. Track it here: ${input.orderUrl}`,
	});
}

export async function sendPasswordResetOtpEmail(input: {
	to: string;
	otp: string;
}) {
	await getResendClient().emails.send({
		from: requireEnv("RESEND_FROM_EMAIL"),
		to: input.to,
		subject: "AwaMenu - Your Password Reset Code",
		text: `Your password reset code is: ${input.otp}\n\nThis code is valid for 15 minutes. If you did not request a password reset, you can safely ignore this email.`,
	});
}

export async function sendAutoRenewalUpcomingEmail(input: {
	to: string;
	restaurantName: string;
	daysLeft: number;
	amount: string;
	manageBillingUrl: string;
}) {
	await getResendClient().emails.send({
		from: requireEnv("RESEND_FROM_EMAIL"),
		to: input.to,
		subject: `Upcoming Charge: ${input.restaurantName} Auto-Renewal in ${input.daysLeft} Days`,
		text: `Hello,\n\nYour subscription for ${input.restaurantName} will automatically renew in ${input.daysLeft} day(s).\n\nWe will auto-debit the amount of ${input.amount} from your saved payment method on your renewal date.\n\nTo manage your plan or billing details, visit: ${input.manageBillingUrl}\n\nThank you,\nThe AwaMenu Team`,
	});
}

export async function sendUpcomingExpiryEmail(input: {
	to: string;
	restaurantName: string;
	daysLeft: number;
	manageBillingUrl: string;
}) {
	await getResendClient().emails.send({
		from: requireEnv("RESEND_FROM_EMAIL"),
		to: input.to,
		subject: `Action Required: ${input.restaurantName} Menu Expires in ${input.daysLeft} Day(s)`,
		text: `Hello,\n\nThe subscription for ${input.restaurantName} will expire in ${input.daysLeft} day(s) because auto-renewal is turned off.\n\nPlease update your payment method or turn on auto-renewal to keep your menu online: ${input.manageBillingUrl}\n\nThank you,\nThe AwaMenu Team`,
	});
}

export async function sendGracePeriodEmail(input: {
	to: string;
	restaurantName: string;
	manageBillingUrl: string;
}) {
	await getResendClient().emails.send({
		from: requireEnv("RESEND_FROM_EMAIL"),
		to: input.to,
		subject: `Action Required: ${input.restaurantName} Subscription Expired (Grace Period Started)`,
		text: `Hello,\n\nThe subscription for ${input.restaurantName} has officially expired.\n\nWe have granted a 3-day grace period to keep your menu online. If you do not renew within the next 3 days, your public menu will be completely taken offline.\n\nPlease renew now: ${input.manageBillingUrl}\n\nThank you,\nThe AwaMenu Team`,
	});
}

export async function sendCutOffEmail(input: {
	to: string;
	restaurantName: string;
	manageBillingUrl: string;
}) {
	await getResendClient().emails.send({
		from: requireEnv("RESEND_FROM_EMAIL"),
		to: input.to,
		subject: `Alert: ${input.restaurantName} Menu is Offline`,
		text: `Hello,\n\nThe grace period for ${input.restaurantName} has ended, and your public menu is now offline.\n\nCustomers can no longer view your menu or place orders.\n\nTo restore access immediately, please renew your subscription: ${input.manageBillingUrl}\n\nThank you,\nThe AwaMenu Team`,
	});
}

export async function sendRenewalSuccessEmail(input: {
	to: string;
	restaurantName: string;
	amount: string;
	planName: string;
	receiptUrl?: string;
}) {
	await getResendClient().emails.send({
		from: requireEnv("RESEND_FROM_EMAIL"),
		to: input.to,
		subject: `Receipt: ${input.restaurantName} Subscription Renewed`,
		text: `Hello,\n\nYour ${input.planName} subscription for ${input.restaurantName} has been successfully renewed!\n\nWe have successfully debited ${input.amount} from your saved payment method.\n\n${input.receiptUrl ? `You can view your receipt here: ${input.receiptUrl}\n\n` : ""}Thank you for using AwaMenu!\n\nThe AwaMenu Team`,
	});
}
