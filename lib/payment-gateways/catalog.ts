/**
 * Client-safe descriptions of the supported providers.
 *
 * Deliberately free of any adapter import: the adapters use Node built-ins
 * (Monnify base64-encodes credentials with `Buffer`), so pulling the registry
 * into a client component would drag those into the browser bundle and break
 * the build. Mirrors the `lib/menu-templates.ts` split for the same reason.
 *
 * Keep in step with the adapter registry in ./index.ts.
 */
export type GatewayId = "PAYSTACK" | "FLUTTERWAVE" | "MONNIFY";

export type AwamenuPayProvider = GatewayId;

export type GatewayCredentialField = {
	key: "publicKey" | "secretKey" | "contractCode";
	label: string;
	secret: boolean;
	placeholder: string;
	help?: string;
};

/**
 * Published local-card pricing, used only to show an owner roughly what lands
 * in their account. Providers change pricing without notice, so this is
 * presented as an estimate in the UI and should be re-checked against each
 * provider's pricing page periodically.
 */
export type GatewayFees = {
	percent: number;
	/** Flat component in naira. */
	flat: number;
	/** Orders below this amount are not charged the flat component. */
	flatWaivedBelow: number;
	/** Maximum total fee in naira. */
	cap: number;
	summary: string;
};

export type GatewayDescriptor = {
	id: GatewayId;
	label: string;
	/** Whether it can back AwaMenu Pay (settles direct to a sub-merchant). */
	supportsSubaccounts: boolean;
	dashboardUrl: string;
	keysHelpUrl: string;
	credentialFields: GatewayCredentialField[];
	fees: GatewayFees;
	/** How long after a payment the money reaches their bank. */
	settlementNote: string;
	/** What the customer can pay with inside this provider's checkout. */
	checkoutMethods: string;
};

/** Shared fee maths so every surface computes the deduction identically. */
export function estimateGatewayFee(amount: number, fees: GatewayFees) {
	const flat = amount >= fees.flatWaivedBelow ? fees.flat : 0;
	return Math.min(fees.cap, Math.round((amount * fees.percent) / 100) + flat);
}

export const GATEWAY_CATALOG: GatewayDescriptor[] = [
	{
		id: "PAYSTACK",
		label: "Paystack",
		supportsSubaccounts: true,
		dashboardUrl: "https://dashboard.paystack.com/#/settings/developers",
		keysHelpUrl:
			"https://www.youtube.com/results?search_query=how+to+get+paystack+api+keys",
		credentialFields: [
			{
				key: "publicKey",
				label: "Public key",
				secret: false,
				placeholder: "pk_live_...",
			},
			{
				key: "secretKey",
				label: "Secret key",
				secret: true,
				placeholder: "sk_live_...",
			},
		],
		fees: {
			percent: 1.5,
			flat: 100,
			flatWaivedBelow: 2500,
			cap: 2000,
			summary: "1.5% + ₦100 (₦100 waived under ₦2,500), capped at ₦2,000",
		},
		settlementNote: "Next business day (T+1)",
		checkoutMethods: "card, bank transfer, USSD and mobile money",
	},
	{
		id: "FLUTTERWAVE",
		label: "Flutterwave",
		supportsSubaccounts: false,
		dashboardUrl: "https://app.flutterwave.com/dashboard/settings/apis",
		keysHelpUrl:
			"https://www.youtube.com/results?search_query=how+to+get+flutterwave+api+keys",
		credentialFields: [
			{
				key: "publicKey",
				label: "Public key",
				secret: false,
				placeholder: "FLWPUBK-...",
			},
			{
				key: "secretKey",
				label: "Secret key",
				secret: true,
				placeholder: "FLWSECK-...",
			},
		],
		fees: {
			percent: 1.4,
			flat: 0,
			flatWaivedBelow: 0,
			cap: 2000,
			summary: "1.4% on local cards, capped at ₦2,000",
		},
		settlementNote: "Next business day (T+1)",
		checkoutMethods: "card, bank transfer, USSD and mobile money",
	},
	{
		id: "MONNIFY",
		label: "Monnify",
		supportsSubaccounts: true,
		dashboardUrl: "https://app.monnify.com/",
		keysHelpUrl:
			"https://www.youtube.com/results?search_query=how+to+get+monnify+api+keys",
		credentialFields: [
			{
				key: "secretKey",
				label: "API key & secret",
				secret: true,
				placeholder: "MK_PROD_XXXX:YOUR_SECRET",
				help: "Monnify signs in with both values. Paste them joined by a colon.",
			},
			{
				key: "contractCode",
				label: "Contract code",
				secret: false,
				placeholder: "1234567890",
			},
		],
		fees: {
			percent: 1.5,
			flat: 0,
			flatWaivedBelow: 0,
			cap: 2000,
			summary: "1.5% on local cards, capped at ₦2,000",
		},
		settlementNote: "Next business day (T+1)",
		checkoutMethods: "card, bank transfer and USSD",
	},
];

export function getGatewayDescriptor(id: GatewayId) {
	return GATEWAY_CATALOG.find((g) => g.id === id) ?? GATEWAY_CATALOG[0];
}

/**
 * Providers that can back AwaMenu Pay.
 *
 * Derived from the catalog rather than hand-listed, so adding a provider is one
 * catalog entry plus its adapter — it then appears in the super-admin's
 * AwaMenu Pay list automatically, with nothing else to remember to update.
 *
 * The gate is `supportsSubaccounts`: AwaMenu Pay settles direct to the
 * restaurant's own sub-merchant account, which a provider without sub-merchant
 * support simply cannot do. That's a capability, not a policy — it isn't
 * something a super-admin can switch on.
 *
 * Lives here rather than beside the actions because a `"use server"` file may
 * only export async functions.
 */
export const AWAMENU_PAY_PROVIDERS: GatewayId[] = GATEWAY_CATALOG.filter(
	(gateway) => gateway.supportsSubaccounts,
).map((gateway) => gateway.id);
