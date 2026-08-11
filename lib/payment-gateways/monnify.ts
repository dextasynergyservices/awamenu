import type {
	Bank,
	ChargeVerification,
	GatewayCredentials,
	InitializeChargeInput,
	PaymentGatewayAdapter,
} from "./types";

/**
 * Monnify adapter.
 *
 * Two things differ from Paystack and shape this file:
 *
 *  1. Auth is OAuth2 — the API key/secret pair is exchanged for a short-lived
 *     bearer token, so every call goes through `token()` first.
 *  2. A contract code identifies the merchant on transaction calls, which is
 *     why `contractCode` exists on the credentials type.
 *
 * Subaccounts must be activated by Monnify support before they work in either
 * sandbox or live, so the AwaMenu Pay path here cannot be exercised until that
 * request is granted — the code is complete but unverified against a live
 * account.
 */
// Sandbox: https://sandbox.monnify.com — live: https://api.monnify.com.
// Credentials are environment-specific, so sandbox keys against the live host
// fail authentication outright.
const API = process.env.MONNIFY_BASE_URL ?? "https://api.monnify.com";

type TokenCache = { token: string; expiresAt: number };
const tokenCache = new Map<string, TokenCache>();

async function token(credentials: GatewayCredentials): Promise<string> {
	// `secretKey` holds the API key and secret joined as "apiKey:secretKey";
	// Monnify authenticates with both, unlike the single-key providers.
	const cacheKey = credentials.secretKey;
	const cached = tokenCache.get(cacheKey);
	if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

	const basic = Buffer.from(credentials.secretKey).toString("base64");
	const res = await fetch(`${API}/api/v1/auth/login`, {
		method: "POST",
		headers: { Authorization: `Basic ${basic}` },
		signal: AbortSignal.timeout(15_000),
	});
	const payload = (await res.json().catch(() => null)) as {
		requestSuccessful?: boolean;
		responseMessage?: string;
		responseBody?: { accessToken?: string; expiresIn?: number };
	} | null;

	const accessToken = payload?.responseBody?.accessToken;
	if (!res.ok || !payload?.requestSuccessful || !accessToken) {
		throw new Error(
			payload?.responseMessage ?? "Monnify authentication failed.",
		);
	}

	tokenCache.set(cacheKey, {
		token: accessToken,
		expiresAt: Date.now() + (payload.responseBody?.expiresIn ?? 3600) * 1000,
	});
	return accessToken;
}

async function call<T>(
	credentials: GatewayCredentials,
	path: string,
	init?: RequestInit,
): Promise<T> {
	const bearer = await token(credentials);
	const res = await fetch(`${API}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${bearer}`,
			"Content-Type": "application/json",
			...init?.headers,
		},
		cache: "no-store",
		signal: AbortSignal.timeout(15_000),
	});
	const payload = (await res.json().catch(() => null)) as {
		requestSuccessful?: boolean;
		responseMessage?: string;
		responseBody?: T;
	} | null;

	if (!res.ok || !payload?.requestSuccessful) {
		throw new Error(
			payload?.responseMessage ?? `Monnify request failed (${path}).`,
		);
	}
	return payload.responseBody as T;
}

export const monnifyAdapter: PaymentGatewayAdapter = {
	id: "MONNIFY",
	label: "Monnify",
	supportsSubaccounts: true,
	credentialFields: [
		{
			key: "secretKey",
			label: "API key and secret",
			secret: true,
			placeholder: "MK_PROD_XXXX:SECRET",
		},
		{
			key: "contractCode",
			label: "Contract code",
			secret: false,
			placeholder: "1234567890",
		},
	],
	dashboardUrl: "https://app.monnify.com/",
	keysHelpUrl:
		"https://www.youtube.com/results?search_query=how+to+get+monnify+api+keys",

	async listBanks(credentials) {
		const data = await call<Array<{ name: string; code: string }>>(
			credentials,
			"/api/v1/banks",
		);
		return data.map((b) => ({ name: b.name, code: b.code })) satisfies Bank[];
	},

	async resolveAccount(credentials, { bankCode, accountNumber }) {
		const data = await call<{ accountNumber: string; accountName: string }>(
			credentials,
			`/api/v1/disbursements/account/validate?accountNumber=${encodeURIComponent(accountNumber)}&bankCode=${encodeURIComponent(bankCode)}`,
		);
		return {
			accountNumber: data.accountNumber,
			accountName: data.accountName,
		};
	},

	async createSubaccount(credentials, input) {
		// Monnify's create endpoint takes an array and returns an array.
		const data = await call<Array<{ subAccountCode: string }>>(
			credentials,
			"/api/v1/sub-accounts",
			{
				method: "POST",
				body: JSON.stringify([
					{
						currencyCode: "NGN",
						bankCode: input.bankCode,
						accountNumber: input.accountNumber,
						email: input.email,
						defaultSplitPercentage: Math.max(
							0,
							100 - input.platformCommissionPercent,
						),
					},
				]),
			},
		);

		const code = data[0]?.subAccountCode;
		if (!code) throw new Error("Monnify did not return a sub-account code.");
		return { subaccountCode: code };
	},

	async initializeCharge(credentials, input: InitializeChargeInput) {
		const reference =
			input.reference ??
			`awamenu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

		const data = await call<{
			checkoutUrl: string;
			transactionReference: string;
		}>(credentials, "/api/v1/merchant/transactions/init-transaction", {
			method: "POST",
			body: JSON.stringify({
				// Monnify works in major units, not kobo.
				amount: input.amountKobo / 100,
				customerEmail: input.email,
				paymentReference: reference,
				contractCode: credentials.contractCode,
				redirectUrl: input.callbackUrl,
				currencyCode: "NGN",
				metaData: input.metadata,
				...(input.subaccountCode
					? {
							incomeSplitConfig: [
								{
									subAccountCode: input.subaccountCode,
									feeBearer: input.feeBearer !== "platform",
								},
							],
						}
					: {}),
			}),
		});

		return {
			authorizationUrl: data.checkoutUrl,
			reference: data.transactionReference ?? reference,
		};
	},

	async verifyCharge(credentials, reference) {
		const data = await call<{
			paymentStatus?: string;
			amountPaid?: number;
			transactionReference?: string;
		}>(credentials, `/api/v2/transactions/${encodeURIComponent(reference)}`);
		return {
			paid: data.paymentStatus === "PAID",
			reference: data.transactionReference ?? reference,
			amountKobo: Math.round((data.amountPaid ?? 0) * 100),
			raw: data,
		} satisfies ChargeVerification;
	},

	async testCredentials(credentials) {
		try {
			await token(credentials);
			return true;
		} catch {
			return false;
		}
	},
};
