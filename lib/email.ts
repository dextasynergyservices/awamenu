import { Resend } from "resend";
import { RestaurantWelcome } from "@/emails/RestaurantWelcome";
import { VerifyEmail } from "@/emails/VerifyEmail";
import { env, requireEnv } from "@/env";

export function getResendClient() {
	return new Resend(requireEnv("RESEND_API_KEY"));
}

/**
 * Signup, verification, and billing emails send from a dedicated address,
 * separate from `RESEND_FROM_EMAIL` (which stays reserved for order
 * confirmations to keep that inbox exclusively about orders). Falls back to
 * `RESEND_FROM_EMAIL` if the dedicated one hasn't been configured yet.
 */
export function getAccountsFromEmail() {
	return env.RESEND_ACCOUNTS_FROM_EMAIL ?? requireEnv("RESEND_FROM_EMAIL");
}

export async function sendVerificationEmail(input: {
	to: string;
	verifyUrl: string;
	code: string;
}) {
	await getResendClient().emails.send({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: "Verify your AwaMenu email address",
		react: VerifyEmail({ verifyUrl: input.verifyUrl, code: input.code }),
	});
}

export async function sendRestaurantWelcomeEmail(input: {
	to: string;
	restaurantName: string;
	dashboardUrl: string;
}) {
	await getResendClient().emails.send({
		from: getAccountsFromEmail(),
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
		from: getAccountsFromEmail(),
		to: input.to,
		subject: "AwaMenu subscription confirmed",
		text: `Your ${input.planName} subscription is confirmed. Continue setup from your AwaMenu onboarding page.`,
	});
}

export async function sendOrderConfirmationEmail(input: {
	to: string;
	restaurantName: string;
	restaurantReplyToEmail: string;
	orderId: string;
	orderUrl: string;
	total: string;
}) {
	await getResendClient().emails.send({
		// Displays as the restaurant, but still sends from our own verified
		// domain — restaurants don't have their own domain verified with
		// Resend, so this can't literally send "from" them. Reply-To points
		// at the restaurant's own email so a customer reply reaches them,
		// not us.
		from: `${input.restaurantName} via AwaMenu <${requireEnv("RESEND_FROM_EMAIL")}>`,
		replyTo: input.restaurantReplyToEmail,
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
		from: getAccountsFromEmail(),
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
		from: getAccountsFromEmail(),
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
		from: getAccountsFromEmail(),
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
		from: getAccountsFromEmail(),
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
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `Alert: ${input.restaurantName} Menu is Offline`,
		text: `Hello,\n\nThe grace period for ${input.restaurantName} has ended, and your public menu is now offline.\n\nCustomers can no longer view your menu or place orders.\n\nTo restore access immediately, please renew your subscription: ${input.manageBillingUrl}\n\nThank you,\nThe AwaMenu Team`,
	});
}

export async function sendCustomerOtpEmail(input: {
	to: string;
	code: string;
	restaurantName: string;
}) {
	await getResendClient().emails.send({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `${input.code} is your ${input.restaurantName} verification code`,
		text: `Hello,\n\nYour verification code for ${input.restaurantName} is:\n\n${input.code}\n\nIt expires in 10 minutes. If you didn't request this, you can safely ignore this email.\n\nThank you,\n${input.restaurantName} (via AwaMenu)`,
	});
}

export async function sendSuspensionEmail(input: {
	to: string;
	restaurantName: string;
	manageBillingUrl: string;
}) {
	await getResendClient().emails.send({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `${input.restaurantName} has been suspended`,
		text: `Hello,\n\nThe 3-day grace period for ${input.restaurantName} has now passed without a renewal, so the account has been suspended.\n\nWhat this means:\n  • Your public menu is offline and customers cannot place orders.\n  • You and your staff cannot access the dashboard.\n  • Nothing has been deleted — your menu, orders and settings are all safe.\n\nRenewing restores everything immediately: ${input.manageBillingUrl}\n\nIf you believe this is a mistake, just reply to this email and we'll help.\n\nThank you,\nThe AwaMenu Team`,
	});
}

export async function sendReactivationEmail(input: {
	to: string;
	restaurantName: string;
	dashboardUrl: string;
}) {
	await getResendClient().emails.send({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `${input.restaurantName} is back online`,
		text: `Hello,\n\nThanks for renewing — ${input.restaurantName} has been reactivated.\n\nYour public menu is live again, and you and your staff can access the dashboard as normal.\n\nGo to your dashboard: ${input.dashboardUrl}\n\nThank you,\nThe AwaMenu Team`,
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
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `Receipt: ${input.restaurantName} Subscription Renewed`,
		text: `Hello,\n\nYour ${input.planName} subscription for ${input.restaurantName} has been successfully renewed!\n\nWe have successfully debited ${input.amount} from your saved payment method.\n\n${input.receiptUrl ? `You can view your receipt here: ${input.receiptUrl}\n\n` : ""}Thank you for using AwaMenu!\n\nThe AwaMenu Team`,
	});
}
