import type { ReactElement } from "react";
import { Resend } from "resend";
import { CustomerCodeEmail } from "@/emails/customer";
import {
	AutoRenewalUpcomingEmail,
	ExpiryUpcomingEmail,
	GracePeriodEmail,
	LapsedEmail,
	PasswordResetEmail,
	PayoutChangedEmail,
	ReactivatedEmail,
	RenewalReceiptEmail,
	SubscriptionConfirmedEmail,
	VerifyEmail,
	WelcomeEmail,
} from "@/emails/owner";
import { renderEmail } from "@/emails/render";
import { env, requireEnv } from "@/env";
import {
	getPlatformBrand,
	getRestaurantEmailIdentity,
} from "@/lib/email-brand";
import { getQueuedMailer } from "@/lib/outbox";

/**
 * The real Resend client. Only for sends the person is waiting on (codes,
 * verification); everything else goes through the outbox (getQueuedMailer).
 */
export function getResendClient() {
	return new Resend(requireEnv("RESEND_API_KEY"));
}

/**
 * AwaMenu's own sender, for mail to restaurant owners (accounts, billing,
 * activity). `RESEND_FROM_EMAIL` stays for guest mail sent in a restaurant's
 * name. Falls back to it if the dedicated address isn't configured yet.
 */
export function getAccountsFromEmail() {
	const address =
		env.RESEND_ACCOUNTS_FROM_EMAIL ?? requireEnv("RESEND_FROM_EMAIL");
	return `AwaMenu <${address}>`;
}

/** HTML plus a plain-text part, for the sends that skip the outbox. */
async function sendNow(message: {
	from: string;
	to: string;
	subject: string;
	react: ReactElement;
}) {
	const { html, text } = await renderEmail(message.react);
	const { error } = await getResendClient().emails.send({
		from: message.from,
		to: message.to,
		subject: message.subject,
		html,
		text,
	});
	if (error) throw new Error(`Resend: ${error.message}`);
}

const app = (path: string) => `${env.NEXT_PUBLIC_APP_URL}${path}`;

// ─── Account (sent now: the person is waiting) ────────

export async function sendVerificationEmail(input: {
	to: string;
	verifyUrl: string;
	code: string;
}) {
	await sendNow({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: "Confirm your AwaMenu email address",
		react: VerifyEmail({ brand: await getPlatformBrand(), ...input }),
	});
}

export async function sendPasswordResetOtpEmail(input: {
	to: string;
	otp: string;
}) {
	await sendNow({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `${input.otp} is your AwaMenu password reset code`,
		react: PasswordResetEmail({
			brand: await getPlatformBrand(),
			code: input.otp,
		}),
	});
}

/**
 * A guest's sign-in code, in the restaurant's name and branding: the guest is
 * signing in to that restaurant, not to AwaMenu.
 */
export async function sendCustomerOtpEmail(input: {
	to: string;
	code: string;
	restaurantId: string;
}) {
	const identity = await getRestaurantEmailIdentity(input.restaurantId);
	await sendNow({
		from: identity.from,
		to: input.to,
		subject: `${input.code} is your ${identity.brand.name} code`,
		react: CustomerCodeEmail({ brand: identity.brand, code: input.code }),
	});
}

// ─── Account (queued) ─────────────────────────────────

export async function sendRestaurantWelcomeEmail(input: {
	to: string;
	restaurantName: string;
	dashboardUrl: string;
}) {
	await getQueuedMailer().emails.send({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `Welcome to AwaMenu, ${input.restaurantName}`,
		react: WelcomeEmail({ brand: await getPlatformBrand(), ...input }),
	});
}

/**
 * Tells the owner their settlement account changed.
 *
 * Sent unconditionally rather than behind a preference. Redirecting payouts is
 * how money is stolen from a business like this, and the only reliable defence
 * is that the owner hears about it even when the person who made the change
 * would rather they didn't. Banks send this for the same reason.
 */
export async function sendPayoutAccountChangedEmail(input: {
	to: string;
	restaurantName: string;
	restaurantSlug: string;
	previous: string;
	next: string;
}) {
	await getQueuedMailer().emails.send({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `Payout account changed for ${input.restaurantName}`,
		react: PayoutChangedEmail({
			brand: await getPlatformBrand(),
			restaurantName: input.restaurantName,
			previous: input.previous,
			next: input.next,
			settingsUrl: app(`/dashboard/${input.restaurantSlug}/settings`),
		}),
	});
}

// ─── Billing ──────────────────────────────────────────

export async function sendSubscriptionConfirmationEmail(input: {
	to: string;
	planName: string;
}) {
	await getQueuedMailer().emails.send({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `Your AwaMenu ${input.planName} plan is active`,
		react: SubscriptionConfirmedEmail({
			brand: await getPlatformBrand(),
			planName: input.planName,
			continueUrl: app("/dashboard"),
		}),
	});
}

export async function sendRenewalSuccessEmail(input: {
	to: string;
	restaurantName: string;
	restaurantSlug: string;
	amount: string;
	planName: string;
	periodEnd: string | null;
}) {
	await getQueuedMailer().emails.send({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `Receipt: ${input.restaurantName} ${input.planName} plan renewed`,
		react: RenewalReceiptEmail({
			brand: await getPlatformBrand(),
			restaurantName: input.restaurantName,
			planName: input.planName,
			amount: input.amount,
			periodEnd: input.periodEnd,
			receiptUrl: app(`/dashboard/${input.restaurantSlug}/billing`),
		}),
	});
}

export async function sendAutoRenewalUpcomingEmail(input: {
	to: string;
	restaurantName: string;
	daysLeft: number;
	amount: string;
	manageBillingUrl: string;
}) {
	await getQueuedMailer().emails.send({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `${input.restaurantName} renews in ${input.daysLeft} day${input.daysLeft === 1 ? "" : "s"} (${input.amount})`,
		react: AutoRenewalUpcomingEmail({
			brand: await getPlatformBrand(),
			restaurantName: input.restaurantName,
			daysLeft: input.daysLeft,
			amount: input.amount,
			billingUrl: input.manageBillingUrl,
		}),
	});
}

export async function sendUpcomingExpiryEmail(input: {
	to: string;
	restaurantName: string;
	daysLeft: number;
	manageBillingUrl: string;
}) {
	await getQueuedMailer().emails.send({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `${input.restaurantName}'s plan ends in ${input.daysLeft} day${input.daysLeft === 1 ? "" : "s"}`,
		react: ExpiryUpcomingEmail({
			brand: await getPlatformBrand(),
			restaurantName: input.restaurantName,
			daysLeft: input.daysLeft,
			renewUrl: input.manageBillingUrl,
		}),
	});
}

export async function sendGracePeriodEmail(input: {
	to: string;
	restaurantName: string;
	manageBillingUrl: string;
}) {
	await getQueuedMailer().emails.send({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `Action needed: ${input.restaurantName}'s plan has ended`,
		react: GracePeriodEmail({
			brand: await getPlatformBrand(),
			restaurantName: input.restaurantName,
			renewUrl: input.manageBillingUrl,
		}),
	});
}

export async function sendSuspensionEmail(input: {
	to: string;
	restaurantName: string;
	manageBillingUrl: string;
}) {
	await getQueuedMailer().emails.send({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `${input.restaurantName} has stopped taking orders`,
		react: LapsedEmail({
			brand: await getPlatformBrand(),
			restaurantName: input.restaurantName,
			renewUrl: input.manageBillingUrl,
		}),
	});
}

export async function sendReactivationEmail(input: {
	to: string;
	restaurantName: string;
	dashboardUrl: string;
}) {
	await getQueuedMailer().emails.send({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `${input.restaurantName} is back online`,
		react: ReactivatedEmail({ brand: await getPlatformBrand(), ...input }),
	});
}
