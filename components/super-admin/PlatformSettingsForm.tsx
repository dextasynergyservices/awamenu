import { updatePlatformSettingsAction } from "@/actions/super-admin.actions";
import { SubmitButton } from "@/components/ui/action-button";
import {
	AWAMENU_PAY_PROVIDERS,
	GATEWAY_CATALOG,
	type GatewayId,
} from "@/lib/payment-gateways/catalog";

type PlatformSettingsFormProps = {
	platformName: string;
	logoUrl: string | null;
	paystackPublicKey: string | null;
	hasSecretKey: boolean;
	maintenanceMode: boolean;
	awamenuPayCommissionPercent: number;
	enabledPaymentChannels: string[];
	awamenuPayProviders: GatewayId[];
	ownGatewayProviders: GatewayId[];
};

/** The four things a restaurant can offer, in the order they appear to owners. */
const PAYMENT_CHANNELS = [
	{
		value: "AWAMENU_PAY",
		label: "AwaMenu Pay",
		help: "Online payments settled direct to the restaurant via a platform subaccount.",
	},
	{
		value: "OWN_GATEWAY",
		label: "Connect your own gateway",
		help: "Restaurant supplies their own provider keys.",
	},
	{
		value: "BANK_TRANSFER",
		label: "Bank transfer",
		help: "Account details shown at checkout; the restaurant confirms manually.",
	},
	{
		value: "CASH",
		label: "Cash",
		help: "Pay on delivery, pickup, or at the table.",
	},
] as const;

function CheckboxCard({
	name,
	value,
	label,
	help,
	defaultChecked,
	disabledReason,
}: {
	name: string;
	value: string;
	label: string;
	help: string;
	defaultChecked: boolean;
	/** Shown instead of `help` when the option can't be switched on at all. */
	disabledReason?: string;
}) {
	const disabled = Boolean(disabledReason);

	return (
		<label
			className={`flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 p-3 transition-colors ${
				disabled
					? "cursor-not-allowed bg-slate-50 opacity-70"
					: "cursor-pointer hover:bg-slate-50"
			}`}
		>
			<input
				type="checkbox"
				name={name}
				value={value}
				defaultChecked={defaultChecked && !disabled}
				disabled={disabled}
				className="mt-0.5 size-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
			/>
			<span className="min-w-0">
				<span className="block text-sm font-black text-slate-900">{label}</span>
				<span className="block text-xs font-medium leading-5 text-slate-500">
					{disabledReason ?? help}
				</span>
			</span>
		</label>
	);
}

const inputClassName =
	"h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
const labelClassName =
	"mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500";
const sectionClassName =
	"grid gap-4 rounded-2xl border border-slate-100 bg-white p-6";

export function PlatformSettingsForm({
	platformName,
	logoUrl,
	paystackPublicKey,
	hasSecretKey,
	maintenanceMode,
	awamenuPayCommissionPercent,
	enabledPaymentChannels,
	awamenuPayProviders,
	ownGatewayProviders,
}: PlatformSettingsFormProps) {
	return (
		<form action={updatePlatformSettingsAction} className="grid gap-6">
			<div className={sectionClassName}>
				<h2 className="text-lg font-black text-slate-950">General</h2>
				<div className="grid gap-4 sm:grid-cols-2">
					<div>
						<label htmlFor="platformName" className={labelClassName}>
							Platform Name
						</label>
						<input
							id="platformName"
							type="text"
							name="platformName"
							defaultValue={platformName}
							required
							className={inputClassName}
						/>
					</div>
					<div>
						<label htmlFor="logoUrl" className={labelClassName}>
							Logo URL
						</label>
						<input
							id="logoUrl"
							type="url"
							name="logoUrl"
							defaultValue={logoUrl ?? ""}
							placeholder="https://..."
							className={inputClassName}
						/>
					</div>
				</div>
			</div>

			<div className={sectionClassName}>
				<h2 className="text-lg font-black text-slate-950">Payments</h2>
				<div className="grid gap-4 sm:grid-cols-2">
					<div>
						<label htmlFor="paystackPublicKey" className={labelClassName}>
							Paystack Public Key
						</label>
						<input
							id="paystackPublicKey"
							type="text"
							name="paystackPublicKey"
							defaultValue={paystackPublicKey ?? ""}
							placeholder="pk_..."
							className={inputClassName}
						/>
					</div>
					<div>
						<label htmlFor="paystackSecretKey" className={labelClassName}>
							Paystack Secret Key
						</label>
						<input
							id="paystackSecretKey"
							type="password"
							name="paystackSecretKey"
							placeholder={
								hasSecretKey
									? "•••••••• (saved — leave blank to keep)"
									: "sk_..."
							}
							autoComplete="off"
							className={inputClassName}
						/>
					</div>
				</div>
			</div>

			<div className={sectionClassName}>
				<h2 className="text-lg font-black text-slate-950">AwaMenu Pay</h2>
				<p className="mt-1 text-sm font-medium text-slate-600">
					The split applied to every AwaMenu Pay order. Which providers are on
					offer is set below.
				</p>

				<div className="mt-4 max-w-xs">
					<label
						htmlFor="awamenuPayCommissionPercent"
						className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500"
					>
						Commission (%)
					</label>
					<input
						id="awamenuPayCommissionPercent"
						type="number"
						name="awamenuPayCommissionPercent"
						min={0}
						max={100}
						step="0.01"
						defaultValue={awamenuPayCommissionPercent}
						className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					/>
					<p className="mt-1 text-xs text-slate-400">
						0 means restaurants keep everything except the provider&apos;s own
						fee.
					</p>
				</div>

				<p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
					Changing the commission only affects subaccounts created afterwards —
					existing restaurants keep the split agreed when they connected.
				</p>
			</div>

			<div className={sectionClassName}>
				<h2 className="text-lg font-black text-slate-950">
					What restaurants can offer
				</h2>
				<p className="text-sm font-medium text-slate-600">
					Unticked options disappear from every restaurant&apos;s payment
					settings and are refused server-side. Restaurants already using an
					option keep their connection — it simply stops being offered, and
					stops appearing at their customers&apos; checkout.
				</p>

				<div className="grid gap-3">
					<p className="text-xs font-black uppercase tracking-wide text-slate-500">
						Payment options
					</p>
					<div className="grid gap-2 sm:grid-cols-2">
						{PAYMENT_CHANNELS.map((channel) => (
							<CheckboxCard
								key={channel.value}
								name="enabledPaymentChannels"
								value={channel.value}
								label={channel.label}
								help={channel.help}
								defaultChecked={enabledPaymentChannels.includes(channel.value)}
							/>
						))}
					</div>
				</div>

				<div className="grid gap-3">
					<p className="text-xs font-black uppercase tracking-wide text-slate-500">
						AwaMenu Pay providers
					</p>
					<div className="grid gap-2 sm:grid-cols-2">
						{GATEWAY_CATALOG.map((descriptor) => (
							<CheckboxCard
								key={descriptor.id}
								name="awamenuPayProviders"
								value={descriptor.id}
								label={descriptor.label}
								help={descriptor.fees.summary}
								defaultChecked={awamenuPayProviders.includes(descriptor.id)}
								disabledReason={
									AWAMENU_PAY_PROVIDERS.includes(descriptor.id)
										? undefined
										: "Can't settle direct to a restaurant's own sub-merchant account, so it can't back AwaMenu Pay. Restaurants can still connect it themselves below."
								}
							/>
						))}
					</div>
					<p className="text-xs font-medium text-slate-400">
						A provider also needs platform credentials in the environment before
						restaurants see it — ticking it here can only make an
						already-configured provider available, never conjure one. Offering a
						provider that isn&apos;t listed at all needs its adapter built
						first.
					</p>
				</div>

				<div className="grid gap-3">
					<p className="text-xs font-black uppercase tracking-wide text-slate-500">
						Gateways a restaurant may connect themselves
					</p>
					<div className="grid gap-2 sm:grid-cols-2">
						{GATEWAY_CATALOG.map((descriptor) => (
							<CheckboxCard
								key={descriptor.id}
								name="ownGatewayProviders"
								value={descriptor.id}
								label={descriptor.label}
								help={descriptor.fees.summary}
								defaultChecked={ownGatewayProviders.includes(descriptor.id)}
							/>
						))}
					</div>
				</div>
			</div>

			<div className={sectionClassName}>
				<h2 className="text-lg font-black text-slate-950">Maintenance</h2>
				<label className="flex items-center gap-2 text-sm font-bold text-slate-700">
					<input
						type="checkbox"
						name="maintenanceMode"
						defaultChecked={maintenanceMode}
						className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
					/>
					Maintenance Mode
				</label>
			</div>

			<SubmitButton
				loadingText="Saving..."
				successText="Saved"
				className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 sm:w-auto sm:justify-self-end"
			>
				Save Settings
			</SubmitButton>
		</form>
	);
}
