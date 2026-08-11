import { requireEnv } from "@/env";
import { getAccountsFromEmail, getResendClient } from "@/lib/email";

/**
 * The order journey's emails, sharing one shell so they read as one product.
 *
 * Tables and inline styles rather than modern CSS: Gmail strips `<style>`
 * blocks and Outlook's renderer has no flexbox, so anything cleverer collapses
 * to unstyled text in the two clients most customers actually use.
 */

export type ReceiptLine = { name: string; quantity: number; amount: string };

function renderShell(input: {
	heading: string;
	accent: string;
	intro: string;
	rows: Array<[string, string]>;
	items?: ReceiptLine[];
	total?: string;
	ctaLabel: string;
	ctaUrl: string;
	footer: string;
}) {
	const rows = input.rows
		.map(
			([label, value]) =>
				`<tr><td style="padding:4px 0;color:#64748b;font-size:13px">${label}</td><td style="padding:4px 0;text-align:right;color:#0f172a;font-size:13px;font-weight:700">${value}</td></tr>`,
		)
		.join("");

	const itemRows = (input.items ?? [])
		.map(
			(item) =>
				`<tr><td style="padding:8px 0;color:#0f172a;font-size:13px">${item.quantity} &times; ${item.name}</td><td style="padding:8px 0;text-align:right;color:#0f172a;font-size:13px">${item.amount}</td></tr>`,
		)
		.join("");

	const totalRow = input.total
		? `<tr><td style="padding:10px 0 0;border-top:1px solid #e2e8f0;font-size:14px;font-weight:800;color:#0f172a">Total</td><td style="padding:10px 0 0;border-top:1px solid #e2e8f0;text-align:right;font-size:14px;font-weight:800;color:${input.accent}">${input.total}</td></tr>`
		: "";

	const items = itemRows
		? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;border-top:1px solid #e2e8f0">${itemRows}${totalRow}</table>`
		: "";

	return `<div style="background:#f6faf7;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;border:1px solid #e2e8f0">
<tr><td style="padding:28px 28px 0">
<div style="height:5px;width:56px;border-radius:999px;background:${input.accent}"></div>
<h1 style="margin:18px 0 8px;font-size:21px;line-height:1.3;color:#0f172a">${input.heading}</h1>
<p style="margin:0;color:#475569;font-size:14px;line-height:1.6">${input.intro}</p>
</td></tr>
<tr><td style="padding:20px 28px 0">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px">
<tr><td style="padding:14px"><table width="100%" cellpadding="0" cellspacing="0">${rows}</table>${items}</td></tr>
</table>
</td></tr>
<tr><td style="padding:22px 28px 28px">
<a href="${input.ctaUrl}" style="display:inline-block;background:${input.accent};color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;padding:12px 20px;border-radius:12px">${input.ctaLabel}</a>
<p style="margin:18px 0 0;color:#94a3b8;font-size:12px;line-height:1.6">${input.footer}</p>
</td></tr>
</table>
</div>`;
}

/**
 * Restaurant-branded sender.
 *
 * It can't literally send *from* the restaurant — they have no domain verified
 * with Resend — so the display name carries the brand and Reply-To routes a
 * customer's reply to the restaurant rather than to us.
 */
function restaurantFrom(restaurantName: string) {
	return `${restaurantName} via AwaMenu <${requireEnv("RESEND_FROM_EMAIL")}>`;
}

function ref(orderId: string) {
	return orderId.slice(-6).toUpperCase();
}

// ─── Customer ─────────────────────────────────────────

export async function sendOrderConfirmedEmail(input: {
	to: string;
	restaurantName: string;
	restaurantReplyToEmail: string;
	orderId: string;
	orderType: string;
	customerName: string;
	total: string;
	items: ReceiptLine[];
	orderUrl: string;
}) {
	const reference = ref(input.orderId);
	await getResendClient().emails.send({
		from: restaurantFrom(input.restaurantName),
		replyTo: input.restaurantReplyToEmail,
		to: input.to,
		subject: `Order #${reference} confirmed — ${input.restaurantName}`,
		html: renderShell({
			heading: "Your order is confirmed",
			accent: "#047857",
			intro: `Hi ${input.customerName}, ${input.restaurantName} has accepted your order and started working on it.`,
			rows: [
				["Order", `#${reference}`],
				["Type", input.orderType],
			],
			items: input.items,
			total: input.total,
			ctaLabel: "Track your order",
			ctaUrl: input.orderUrl,
			footer: `Questions? Reply to this email and it reaches ${input.restaurantName} directly.`,
		}),
		text: `Hi ${input.customerName}, ${input.restaurantName} accepted your order #${reference} (${input.orderType}). Total: ${input.total}. Track it: ${input.orderUrl}`,
	});
}

export async function sendOrderReceiptEmail(input: {
	to: string;
	restaurantName: string;
	restaurantReplyToEmail: string;
	orderId: string;
	orderType: string;
	customerName: string;
	items: ReceiptLine[];
	total: string;
	paymentMethod: string;
	orderUrl: string;
	fulfilmentDetail?: string;
}) {
	const reference = ref(input.orderId);
	const rows: Array<[string, string]> = [
		["Receipt", `#${reference}`],
		["Type", input.orderType],
		["Paid with", input.paymentMethod],
	];
	if (input.fulfilmentDetail) rows.push(["Details", input.fulfilmentDetail]);

	await getResendClient().emails.send({
		from: restaurantFrom(input.restaurantName),
		replyTo: input.restaurantReplyToEmail,
		to: input.to,
		subject: `Receipt for order #${reference} — ${input.restaurantName}`,
		html: renderShell({
			heading: "Payment received",
			accent: "#047857",
			intro: `Thanks ${input.customerName} — ${input.restaurantName} has received your payment. Keep this as your receipt.`,
			rows,
			items: input.items,
			total: input.total,
			ctaLabel: "View your order",
			ctaUrl: input.orderUrl,
			footer: `This receipt covers order #${reference} only. Reply to reach ${input.restaurantName}.`,
		}),
		text: `Payment received. Receipt #${reference} (${input.orderType}) at ${input.restaurantName}. Paid with ${input.paymentMethod}. Total: ${input.total}. ${input.orderUrl}`,
	});
}

export async function sendOrderCompletedEmail(input: {
	to: string;
	restaurantName: string;
	restaurantReplyToEmail: string;
	orderId: string;
	customerName: string;
	summary: string;
	total: string;
	orderUrl: string;
}) {
	const reference = ref(input.orderId);
	await getResendClient().emails.send({
		from: restaurantFrom(input.restaurantName),
		replyTo: input.restaurantReplyToEmail,
		to: input.to,
		subject: `Order #${reference} complete — ${input.restaurantName}`,
		html: renderShell({
			heading: "All done",
			accent: "#047857",
			intro: `${input.summary} Thanks for choosing ${input.restaurantName}, ${input.customerName}.`,
			rows: [
				["Order", `#${reference}`],
				["Total", input.total],
			],
			ctaLabel: "View or rate your order",
			ctaUrl: input.orderUrl,
			footer:
				"We would love to hear how it went — you can leave a rating from your order page.",
		}),
		text: `${input.summary} Order #${reference} at ${input.restaurantName}. Total: ${input.total}. ${input.orderUrl}`,
	});
}

export async function sendOrderCancelledEmail(input: {
	to: string;
	restaurantName: string;
	restaurantReplyToEmail: string;
	orderId: string;
	customerName: string;
	reason: string | null;
	orderUrl: string;
}) {
	const reference = ref(input.orderId);
	await getResendClient().emails.send({
		from: restaurantFrom(input.restaurantName),
		replyTo: input.restaurantReplyToEmail,
		to: input.to,
		subject: `Order #${reference} could not be completed — ${input.restaurantName}`,
		html: renderShell({
			heading: "Your order was cancelled",
			accent: "#b91c1c",
			intro: `Sorry ${input.customerName} — ${input.restaurantName} cannot complete order #${reference}.`,
			rows: [
				["Order", `#${reference}`],
				["Reason", input.reason ?? "Not given"],
			],
			ctaLabel: "View order",
			ctaUrl: input.orderUrl,
			footer: `If you already paid, reply to this email and ${input.restaurantName} will arrange your refund.`,
		}),
		text: `Order #${reference} at ${input.restaurantName} was cancelled. Reason: ${input.reason ?? "not given"}. ${input.orderUrl}`,
	});
}

// ─── Restaurant ───────────────────────────────────────
// Sent from the accounts address, not the restaurant-branded one: these go to
// the owner, and dressing them up as mail "from themselves" reads as spoofing.

export async function sendAdminNewOrderEmail(input: {
	to: string;
	restaurantName: string;
	orderId: string;
	orderType: string;
	customerName: string;
	total: string;
	items: ReceiptLine[];
	dashboardUrl: string;
}) {
	const reference = ref(input.orderId);
	await getResendClient().emails.send({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `New ${input.orderType.toLowerCase()} order #${reference} — ${input.total}`,
		html: renderShell({
			heading: "New order waiting",
			accent: "#047857",
			intro: `${input.customerName} placed a ${input.orderType.toLowerCase()} order at ${input.restaurantName}. It needs accepting before you start.`,
			rows: [
				["Order", `#${reference}`],
				["Customer", input.customerName],
				["Type", input.orderType],
			],
			items: input.items,
			total: input.total,
			ctaLabel: "Accept or decline",
			ctaUrl: input.dashboardUrl,
			footer:
				"The customer is not told their order is confirmed until you accept it.",
		}),
		text: `New ${input.orderType} order #${reference} from ${input.customerName}. Total: ${input.total}. ${input.dashboardUrl}`,
	});
}

export async function sendAdminPaymentReceivedEmail(input: {
	to: string;
	restaurantName: string;
	orderId: string;
	orderType: string;
	customerName: string;
	total: string;
	paymentMethod: string;
	dashboardUrl: string;
}) {
	const reference = ref(input.orderId);
	await getResendClient().emails.send({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `Payment received — ${input.total} for order #${reference}`,
		html: renderShell({
			heading: "Payment received",
			accent: "#047857",
			intro: `${input.customerName} has paid for order #${reference} at ${input.restaurantName}.`,
			rows: [
				["Order", `#${reference}`],
				["Type", input.orderType],
				["Method", input.paymentMethod],
				["Amount", input.total],
			],
			ctaLabel: "Open order",
			ctaUrl: input.dashboardUrl,
			footer:
				"When the money reaches your bank depends on your provider — see Payments in Settings.",
		}),
		text: `Payment received: ${input.total} for order #${reference} (${input.paymentMethod}). ${input.dashboardUrl}`,
	});
}

export async function sendAdminOrderCompletedEmail(input: {
	to: string;
	restaurantName: string;
	orderId: string;
	orderType: string;
	customerName: string;
	total: string;
	dashboardUrl: string;
}) {
	const reference = ref(input.orderId);
	await getResendClient().emails.send({
		from: getAccountsFromEmail(),
		to: input.to,
		subject: `Order #${reference} completed — ${input.total}`,
		html: renderShell({
			heading: "Order completed",
			accent: "#047857",
			intro: `Order #${reference} for ${input.customerName} at ${input.restaurantName} is complete.`,
			rows: [
				["Order", `#${reference}`],
				["Type", input.orderType],
				["Total", input.total],
			],
			ctaLabel: "View order",
			ctaUrl: input.dashboardUrl,
			footer: "The customer has been emailed and invited to leave a rating.",
		}),
		text: `Order #${reference} (${input.orderType}) completed. Total: ${input.total}. ${input.dashboardUrl}`,
	});
}
