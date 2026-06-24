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
