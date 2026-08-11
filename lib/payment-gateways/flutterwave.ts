import type {
	Bank,
	ChargeVerification,
	GatewayCredentials,
	InitializeChargeInput,
	PaymentGatewayAdapter,
} from "./types";

const API = "https://api.flutterwave.com/v3";

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
		signal: AbortSignal.timeout(15_000),
	});
	const payload = (await res.json().catch(() => null)) as {
		status?: string;
		message?: string;
		data?: T;
	} | null;

	if (!res.ok || payload?.status !== "success") {
		throw new Error(
			payload?.message ?? `Flutterwave request failed (${path}).`,
		);
	}
	return payload.data as T;
}

/**
 * Flutterwave adapter — own-gateway only.
 *
 * Flutterwave's equivalent of subaccounts settles differently from Paystack's
 * and Monnify's, so it is deliberately not offered as an AwaMenu Pay backend
 * (`supportsSubaccounts: false`). Restaurants can still connect their own
 * Flutterwave account, where funds land in their own balance directly and no
 * split is involved.
 */
export const flutterwaveAdapter: PaymentGatewayAdapter = {
	id: "FLUTTERWAVE",
	label: "Flutterwave",
	supportsSubaccounts: false,
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
	dashboardUrl: "https://app.flutterwave.com/dashboard/settings/apis",
	keysHelpUrl:
		"https://www.youtube.com/results?search_query=how+to+get+flutterwave+api+keys",

	async listBanks(credentials) {
		const data = await call<Array<{ name: string; code: string }>>(
			credentials,
			"/banks/NG",
		);
		return data.map((b) => ({ name: b.name, code: b.code })) satisfies Bank[];
	},

	async resolveAccount(credentials, { bankCode, accountNumber }) {
		const data = await call<{ account_number: string; account_name: string }>(
			credentials,
			"/accounts/resolve",
			{
				method: "POST",
				body: JSON.stringify({
					account_number: accountNumber,
					account_bank: bankCode,
				}),
			},
		);
		return {
			accountNumber: data.account_number,
			accountName: data.account_name,
		};
	},

	async createSubaccount() {
		throw new Error(
			"Flutterwave isn't available as an AwaMenu Pay provider. Connect it as your own gateway instead.",
		);
	},

	async initializeCharge(credentials, input: InitializeChargeInput) {
		const reference =
			input.reference ??
			`awamenu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

		const data = await call<{ link: string }>(credentials, "/payments", {
			method: "POST",
			body: JSON.stringify({
				tx_ref: reference,
				// Flutterwave works in major units.
				amount: input.amountKobo / 100,
				currency: "NGN",
				redirect_url: input.callbackUrl,
				customer: { email: input.email },
				meta: input.metadata,
			}),
		});

		return { authorizationUrl: data.link, reference };
	},

	async verifyCharge(credentials, reference) {
		const data = await call<{
			status?: string;
			amount?: number;
			tx_ref?: string;
		}>(
			credentials,
			`/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
		);
		return {
			paid: data.status === "successful",
			reference: data.tx_ref ?? reference,
			amountKobo: Math.round((data.amount ?? 0) * 100),
			raw: data,
		} satisfies ChargeVerification;
	},

	async testCredentials(credentials) {
		try {
			await call(credentials, "/banks/NG");
			return true;
		} catch {
			return false;
		}
	},
};
