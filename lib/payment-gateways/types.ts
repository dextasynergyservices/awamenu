import type { PaymentGateway } from "@prisma/client";

export type Bank = {
	name: string;
	code: string;
};

export type ResolvedAccount = {
	accountNumber: string;
	accountName: string;
};

export type GatewayCredentials = {
	secretKey: string;
	publicKey?: string;
	/** Monnify issues a contract code alongside the key pair. */
	contractCode?: string;
};

export type CreateSubaccountInput = {
	businessName: string;
	bankCode: string;
	accountNumber: string;
	/** Percentage of each transaction the *platform* keeps (0 = all to the
	 * restaurant). Adapters translate this into whatever the provider expects. */
	platformCommissionPercent: number;
	email?: string;
};

export type InitializeChargeInput = {
	amountKobo: number;
	email: string;
	reference?: string;
	callbackUrl: string;
	metadata?: Record<string, unknown>;
	/** Present for AwaMenu Pay: routes settlement to the restaurant. */
	subaccountCode?: string;
	/** Who absorbs the provider's fee when a subaccount is involved. */
	feeBearer?: "platform" | "subaccount";
	/** Amount in kobo routed to the platform account instead of the subaccount,
	 * overriding the split for this transaction. Used to recover the gateway fee
	 * (and any commission) from the restaurant's share. */
	platformChargeKobo?: number;
};

export type ChargeVerification = {
	paid: boolean;
	reference: string;
	amountKobo: number;
	raw: unknown;
};

/**
 * The contract every payment provider implements.
 *
 * Both "AwaMenu Pay" (platform credentials + a per-restaurant subaccount) and
 * "Own Gateway" (the restaurant's own credentials) go through this same
 * interface — which is why adding a provider means writing one adapter rather
 * than touching checkout, settings, or onboarding.
 */
export interface PaymentGatewayAdapter {
	readonly id: PaymentGateway;
	readonly label: string;
	/** Whether this provider can act as an AwaMenu Pay backend, i.e. supports
	 * subaccounts with settlement direct to the sub-merchant's bank. */
	readonly supportsSubaccounts: boolean;
	/** Shown in the UI so owners know exactly what to paste. */
	readonly credentialFields: Array<{
		key: keyof GatewayCredentials;
		label: string;
		secret: boolean;
		placeholder: string;
	}>;
	readonly dashboardUrl: string;
	readonly keysHelpUrl: string;

	listBanks(credentials: GatewayCredentials): Promise<Bank[]>;
	resolveAccount(
		credentials: GatewayCredentials,
		input: { bankCode: string; accountNumber: string },
	): Promise<ResolvedAccount>;
	createSubaccount(
		credentials: GatewayCredentials,
		input: CreateSubaccountInput,
	): Promise<{ subaccountCode: string }>;
	initializeCharge(
		credentials: GatewayCredentials,
		input: InitializeChargeInput,
	): Promise<{ authorizationUrl: string; reference: string }>;
	verifyCharge(
		credentials: GatewayCredentials,
		reference: string,
	): Promise<ChargeVerification>;
	/** Cheap authenticated call so a wrong key is caught on save rather than at
	 * a customer's first checkout. */
	testCredentials(credentials: GatewayCredentials): Promise<boolean>;
}
