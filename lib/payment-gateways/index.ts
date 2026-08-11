import type { PaymentGateway } from "@prisma/client";
import { flutterwaveAdapter } from "./flutterwave";
import { monnifyAdapter } from "./monnify";
import { paystackAdapter } from "./paystack";
import type { PaymentGatewayAdapter } from "./types";

export type * from "./types";

/**
 * Registry of supported providers.
 *
 * Adding a provider is: write an adapter implementing `PaymentGatewayAdapter`,
 * add it here, and add the enum value in the schema. Nothing in checkout,
 * settings, or onboarding needs to change.
 */
const ADAPTERS: Record<PaymentGateway, PaymentGatewayAdapter> = {
	PAYSTACK: paystackAdapter,
	MONNIFY: monnifyAdapter,
	FLUTTERWAVE: flutterwaveAdapter,
};

export function getGatewayAdapter(
	gateway: PaymentGateway,
): PaymentGatewayAdapter {
	return ADAPTERS[gateway];
}

export function listGatewayAdapters(): PaymentGatewayAdapter[] {
	return Object.values(ADAPTERS);
}

/** Providers that can back AwaMenu Pay (i.e. settle direct to a sub-merchant). */
export function listAwamenuPayProviders(): PaymentGatewayAdapter[] {
	return listGatewayAdapters().filter((a) => a.supportsSubaccounts);
}

/**
 * Client-safe descriptors for the settings UI.
 *
 * Deliberately a plain array of primitives: the adapters themselves close over
 * server-only concerns, so they must never be imported into a client component.
 */
export const GATEWAY_OPTIONS = listGatewayAdapters().map((adapter) => ({
	id: adapter.id,
	label: adapter.label,
	supportsSubaccounts: adapter.supportsSubaccounts,
	dashboardUrl: adapter.dashboardUrl,
	keysHelpUrl: adapter.keysHelpUrl,
	credentialFields: adapter.credentialFields.map((f) => ({ ...f })),
}));

export type GatewayOption = (typeof GATEWAY_OPTIONS)[number];
