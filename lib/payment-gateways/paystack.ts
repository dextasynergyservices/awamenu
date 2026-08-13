import type {
	Bank,
	ChargeVerification,
	CreateSubaccountInput,
	GatewayCredentials,
	InitializeChargeInput,
	PaymentGatewayAdapter,
	ResolvedAccount,
} from "./types";

const API = "https://api.paystack.co";

async function call<T>(
	credentials: GatewayCredentials,
	path: string,
	init?: RequestInit,
): Promise<T> {
	const res = await fetch(`${API}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${credentials.secretKey}`,
			"Content-Type": "application/json",
			...init?.headers,
		},
		cache: "no-store",
		// Paystack occasionally stalls; without a bound a checkout request would
		// hang until the platform kills the function.
		signal: AbortSignal.timeout(15_000),
	});

	const payload = (await res.json().catch(() => null)) as {
		status?: boolean;
		message?: string;
		data?: T;
	} | null;

	if (!res.ok || !payload?.status) {
		throw new Error(payload?.message ?? `Paystack request failed (${path}).`);
	}

	return payload.data as T;
}

export const paystackAdapter: PaymentGatewayAdapter = {
	id: "PAYSTACK",
	label: "Paystack",
	supportsSubaccounts: true,
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
	dashboardUrl: "https://dashboard.paystack.com/#/settings/developers",
	keysHelpUrl:
		"https://www.youtube.com/results?search_query=how+to+get+paystack+api+keys",

	async listBanks(credentials) {
		const data = await call<Array<{ name: string; code: string }>>(
			credentials,
			"/bank?currency=NGN&perPage=100",
		);
		return data.map((b) => ({ name: b.name, code: b.code })) satisfies Bank[];
	},

	async resolveAccount(credentials, { bankCode, accountNumber }) {
		const data = await call<{ account_number: string; account_name: string }>(
			credentials,
			`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`,
		);
		return {
			accountNumber: data.account_number,
			accountName: data.account_name,
		} satisfies ResolvedAccount;
	},

	async createSubaccount(credentials, input: CreateSubaccountInput) {
		// The subaccount keeps 100% by default and the platform's cut is applied
		// per transaction via `transaction_charge`. A fixed percentage can't
		// express Paystack's own fee (1.5% + ₦100, capped ₦2,000) — the flat
		// component and the cap both make it amount-dependent — so recovering it
		// through the split would over- or under-charge on nearly every order.
		const subaccountShare = 100;
		void input.platformCommissionPercent;
		const data = await call<{ subaccount_code: string }>(
			credentials,
			"/subaccount",
			{
				method: "POST",
				body: JSON.stringify({
					business_name: input.businessName,
					bank_code: input.bankCode,
					account_number: input.accountNumber,
					percentage_charge: subaccountShare,
					primary_contact_email: input.email,
				}),
			},
		);
		return { subaccountCode: data.subaccount_code };
	},

	async initializeCharge(credentials, input: InitializeChargeInput) {
		const data = await call<{ authorization_url: string; reference: string }>(
			credentials,
			"/transaction/initialize",
			{
				method: "POST",
				body: JSON.stringify({
					email: input.email,
					amount: input.amountKobo,
					reference: input.reference,
					callback_url: input.callbackUrl,
					metadata: input.metadata,
					...(input.subaccountCode
						? {
								subaccount: input.subaccountCode,
								// "subaccount" makes the restaurant absorb the gateway fee,
								// which is what the settings UI discloses to them.
								bearer:
									input.feeBearer === "subaccount" ? "subaccount" : "account",
								...(input.platformChargeKobo
									? { transaction_charge: input.platformChargeKobo }
									: {}),
							}
						: {}),
				}),
			},
		);
		return {
			authorizationUrl: data.authorization_url,
			reference: data.reference,
		};
	},

	async verifyCharge(credentials, reference) {
		const data = await call<{
			status?: string;
			reference?: string;
			amount?: number;
		}>(credentials, `/transaction/verify/${encodeURIComponent(reference)}`);
		return {
			paid: data.status === "success",
			reference: data.reference ?? reference,
			amountKobo: data.amount ?? 0,
			raw: data,
		} satisfies ChargeVerification;
	},

	async testCredentials(credentials) {
		try {
			await call(credentials, "/bank?currency=NGN&perPage=1");
			return true;
		} catch {
			return false;
		}
	},

	async refundCharge(credentials, input) {
		try {
			await call(credentials, "/refund", {
				method: "POST",
				body: JSON.stringify({
					transaction: input.reference,
					// Omitted for a full refund — Paystack then returns the whole
					// charge, which is what "refund this payment" should mean.
					...(input.amountKobo ? { amount: input.amountKobo } : {}),
					...(input.reason ? { merchant_note: input.reason } : {}),
				}),
			});
			return { ok: true as const };
		} catch (error) {
			return {
				ok: false as const,
				error:
					error instanceof Error
						? error.message
						: "Paystack rejected the refund.",
			};
		}
	},
};
