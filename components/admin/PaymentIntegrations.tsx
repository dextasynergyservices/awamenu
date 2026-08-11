"use client";

import {
	Banknote,
	ChevronDown,
	CreditCard,
	ExternalLink,
	Landmark,
	PlayCircle,
	Wallet,
} from "lucide-react";
import { useEffect, useId, useState, useTransition } from "react";
import {
	connectPayoutAccountAction,
	listAvailablePaymentOptionsAction,
	saveBankDetailsAction,
	saveOwnGatewayAction,
	togglePaymentChannelAction,
	togglePayoutProviderAction,
} from "@/actions/payment-settings.actions";
import {
	BankAccountPicker,
	type BankSelection,
} from "@/components/admin/BankAccountPicker";
import { SettingsCard } from "@/components/admin/SettingsCard";
import {
	estimateGatewayFee,
	GATEWAY_CATALOG,
	type GatewayId,
	getGatewayDescriptor,
} from "@/lib/payment-gateways/catalog";
import { cn } from "@/lib/utils";

export type PaymentMethodState = {
	channel: "AWAMENU_PAY" | "OWN_GATEWAY" | "BANK_TRANSFER" | "CASH";
	isEnabled: boolean;
	gateway: GatewayId | null;
	bankName: string | null;
	accountNumber: string | null;
	accountName: string | null;
	bankCode: string | null;
	hasSecretKey: boolean;
	isConnected: boolean;
};

/** One connected AwaMenu Pay provider. A restaurant may have several. */
export type PayoutAccountState = {
	gateway: GatewayId;
	isEnabled: boolean;
	bankName: string;
	accountNumber: string;
	accountName: string;
};

type Props = {
	slug: string;
	methods: PaymentMethodState[];
	payoutAccounts: PayoutAccountState[];
	/** Percentage AwaMenu keeps per order — shown in the fee breakdown. */
	commissionPercent: number;
};

const SAMPLE_ORDER = 5000;

function Toggle({
	checked,
	onChange,
	disabled,
	label,
}: {
	checked: boolean;
	onChange: (next: boolean) => void;
	disabled?: boolean;
	label: string;
}) {
	return (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			aria-label={label}
			disabled={disabled}
			onClick={() => onChange(!checked)}
			className={cn(
				"relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50",
				checked ? "bg-emerald-600" : "bg-slate-300",
			)}
		>
			<span
				className={cn(
					"absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform",
					checked ? "translate-x-[1.375rem]" : "translate-x-0.5",
				)}
			/>
		</button>
	);
}

/**
 * One payment channel: a header that's always visible and a body that isn't.
 *
 * Four channels expanded at once is a wall of forms, and only one is normally
 * being set up, so the body collapses. The on/off switch stays in the header —
 * enabling a channel shouldn't require opening it. The expander and the switch
 * are two sibling buttons rather than nested ones, which HTML forbids.
 */
function ChannelShell({
	icon: Icon,
	title,
	description,
	badge,
	poweredBy,
	status,
	checked,
	onToggle,
	disabled,
	children,
}: {
	icon: typeof Wallet;
	title: string;
	description: string;
	badge?: string;
	/** Provider actually processing the payment, named so it isn't a black box. */
	poweredBy?: string;
	/** Short state shown while collapsed, so the summary is readable shut. */
	status?: { label: string; tone: "connected" | "pending" };
	checked: boolean;
	onToggle: (next: boolean) => void;
	disabled?: boolean;
	children?: React.ReactNode;
}) {
	const bodyId = useId();
	const [open, setOpen] = useState(false);

	return (
		<div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
			<div className="flex items-start gap-3 p-4">
				{children ? (
					<button
						type="button"
						aria-expanded={open}
						aria-controls={bodyId}
						onClick={() => setOpen((value) => !value)}
						className="flex min-w-0 flex-1 items-start gap-3 text-left"
					>
						<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-700">
							<Icon className="size-5" aria-hidden="true" />
						</span>
						<span className="min-w-0 flex-1">
							<span className="flex flex-wrap items-center gap-2 font-black text-slate-950">
								{title}
								{poweredBy ? (
									<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
										via {poweredBy}
									</span>
								) : null}
								{badge ? (
									<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">
										{badge}
									</span>
								) : null}
								{status ? (
									<span
										className={cn(
											"rounded-full px-2 py-0.5 text-[11px] font-black",
											status.tone === "connected"
												? "bg-emerald-50 text-emerald-700"
												: "bg-amber-50 text-amber-700",
										)}
									>
										{status.label}
									</span>
								) : null}
							</span>
							<span className="mt-0.5 block text-xs font-medium leading-5 text-slate-500">
								{description}
							</span>
						</span>
						<ChevronDown
							className={cn(
								"mt-2.5 size-4 shrink-0 text-slate-400 transition-transform",
								open && "rotate-180",
							)}
							aria-hidden="true"
						/>
					</button>
				) : (
					<div className="flex min-w-0 flex-1 items-start gap-3">
						<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-700">
							<Icon className="size-5" aria-hidden="true" />
						</span>
						<div className="min-w-0">
							<p className="font-black text-slate-950">{title}</p>
							<p className="mt-0.5 text-xs font-medium leading-5 text-slate-500">
								{description}
							</p>
						</div>
					</div>
				)}
				<div className="mt-1 shrink-0">
					<Toggle
						checked={checked}
						onChange={onToggle}
						disabled={disabled}
						label={`Enable ${title}`}
					/>
				</div>
			</div>
			{children && open ? (
				<div id={bodyId} className="border-t border-slate-100 p-4">
					{children}
				</div>
			) : null}
		</div>
	);
}

/**
 * One AwaMenu Pay provider: its pricing, its settlement account, its switch.
 *
 * Each provider is a separate connection with its own subaccount, so this can't
 * be collapsed into a single form — and the fee table has to be per-provider
 * because Paystack and Monnify price differently, so one shared table would
 * misstate the payout on whichever provider it wasn't written for.
 */
function ProviderConnection({
	slug,
	provider,
	account,
	commissionPercent,
	isPending,
	run,
}: {
	slug: string;
	provider: GatewayId;
	account?: PayoutAccountState;
	commissionPercent: number;
	isPending: boolean;
	run: (fn: () => Promise<{ ok: true } | { error: string }>) => void;
}) {
	const [bank, setBank] = useState<BankSelection | null>(null);
	const [showForm, setShowForm] = useState(false);

	const descriptor = getGatewayDescriptor(provider);
	const fee = estimateGatewayFee(SAMPLE_ORDER, descriptor.fees);
	const commission = Math.round((SAMPLE_ORDER * commissionPercent) / 100);
	const payout = SAMPLE_ORDER - fee - commission;

	return (
		<div className="min-w-0 overflow-hidden rounded-xl border border-slate-200">
			<div className="flex items-start justify-between gap-3 bg-slate-50/60 p-3">
				<div className="min-w-0">
					<p className="flex flex-wrap items-center gap-2 font-black text-slate-900">
						{descriptor.label}
						{account ? (
							<span
								className={cn(
									"rounded-full px-2 py-0.5 text-[11px] font-black",
									account.isEnabled
										? "bg-emerald-50 text-emerald-700"
										: "bg-slate-200 text-slate-600",
								)}
							>
								{account.isEnabled ? "On at checkout" : "Off"}
							</span>
						) : null}
					</p>
					<p className="mt-0.5 text-xs font-medium leading-5 text-slate-500">
						{descriptor.fees.summary} · {descriptor.checkoutMethods}
					</p>
				</div>
				{account ? (
					<Toggle
						checked={account.isEnabled}
						onChange={(next) =>
							run(() =>
								togglePayoutProviderAction({
									slug,
									gateway: provider,
									isEnabled: next,
								}),
							)
						}
						disabled={isPending}
						label={`Offer ${descriptor.label} at checkout`}
					/>
				) : null}
			</div>

			<div className="min-w-0 p-3">
				{account && !showForm ? (
					<>
						<p className="font-black text-slate-900">{account.accountName}</p>
						<p className="text-xs font-medium text-slate-600">
							{account.bankName} ••••{account.accountNumber.slice(-4)} ·{" "}
							{descriptor.settlementNote.toLowerCase()}
						</p>
						<button
							type="button"
							onClick={() => setShowForm(true)}
							className="mt-2 text-xs font-black text-emerald-700 hover:underline"
						>
							Change account
						</button>
					</>
				) : (
					<div className="grid min-w-0 gap-3">
						{/* Scoped to this provider: bank codes are issued per provider, so
						    a Paystack code would be rejected by Monnify. */}
						<BankAccountPicker
							slug={slug}
							gateway={provider}
							onVerified={setBank}
						/>
						<div className="flex flex-wrap gap-2">
							<button
								type="button"
								disabled={!bank || isPending}
								onClick={() =>
									bank &&
									run(async () => {
										const result = await connectPayoutAccountAction({
											slug,
											gateway: provider,
											...bank,
										});
										if ("ok" in result) setShowForm(false);
										return result;
									})
								}
								className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-50"
							>
								{isPending ? "Connecting…" : `Connect ${descriptor.label}`}
							</button>
							{account ? (
								<button
									type="button"
									onClick={() => setShowForm(false)}
									className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-600"
								>
									Cancel
								</button>
							) : null}
						</div>
					</div>
				)}

				{/* Stated up front so the deduction is never a surprise on the first
				    settlement. */}
				<dl className="mt-3 min-w-0 rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-600">
					<div className="flex justify-between gap-3">
						<dt>Example order</dt>
						<dd className="font-black text-slate-900">
							₦{SAMPLE_ORDER.toLocaleString()}
						</dd>
					</div>
					<div className="mt-1 flex justify-between gap-3">
						<dt>{descriptor.label} fee</dt>
						<dd>−₦{fee.toLocaleString()}</dd>
					</div>
					{commission > 0 ? (
						<div className="mt-1 flex justify-between gap-3">
							<dt>AwaMenu commission ({commissionPercent}%)</dt>
							<dd>−₦{commission.toLocaleString()}</dd>
						</div>
					) : null}
					<div className="mt-2 flex justify-between gap-3 border-slate-200 border-t pt-2">
						<dt className="font-black text-slate-900">You receive</dt>
						<dd className="font-black text-emerald-700">
							₦{payout.toLocaleString()}
						</dd>
					</div>
					<p className="mt-2 text-[11px] leading-4 text-slate-500">
						Estimate — {descriptor.label}&apos;s current pricing applies.
					</p>
				</dl>
			</div>
		</div>
	);
}

export function PaymentIntegrations({
	slug,
	methods,
	payoutAccounts,
	commissionPercent,
}: Props) {
	const byChannel = Object.fromEntries(
		methods.map((m) => [m.channel, m]),
	) as Record<PaymentMethodState["channel"], PaymentMethodState | undefined>;

	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const [providers, setProviders] = useState<GatewayId[]>([]);
	const [allowedChannels, setAllowedChannels] = useState<string[] | null>(null);
	const [allowedOwnGateways, setAllowedOwnGateways] = useState<GatewayId[]>([]);
	const [transferBank, setTransferBank] = useState<BankSelection | null>(null);

	const [gateway, setGateway] = useState<GatewayId>(
		byChannel.OWN_GATEWAY?.gateway ?? "PAYSTACK",
	);
	const [credentials, setCredentials] = useState<Record<string, string>>({});

	const descriptor = getGatewayDescriptor(gateway);

	// What AwaMenu is currently offering. A channel or provider the super-admin
	// has switched off is hidden here and refused server-side — and a provider
	// also has to have platform credentials, so no owner can start a connection
	// that could only fail on the first API call.
	useEffect(() => {
		let active = true;
		listAvailablePaymentOptionsAction({ slug }).then((result) => {
			if (!active) return;
			setProviders(result.providers);
			setAllowedChannels(result.channels);
			setAllowedOwnGateways(result.ownGateways);
		});
		return () => {
			active = false;
		};
	}, [slug]);

	const byGateway = Object.fromEntries(
		payoutAccounts.map((account) => [account.gateway, account]),
	) as Partial<Record<GatewayId, PayoutAccountState>>;

	const connectedCount = payoutAccounts.filter((a) => a.isEnabled).length;

	// `null` means the allow-list hasn't loaded yet. Everything renders in that
	// window so the card doesn't visibly reshuffle on every page load; the server
	// still refuses anything that isn't actually on offer.
	const allows = (channel: PaymentMethodState["channel"]) =>
		allowedChannels === null || allowedChannels.includes(channel);

	const ownGatewayOptions = GATEWAY_CATALOG.filter(
		(option) =>
			allowedOwnGateways.length === 0 || allowedOwnGateways.includes(option.id),
	);

	const showOnlineHeading = allows("AWAMENU_PAY") || allows("OWN_GATEWAY");
	const showManualHeading = allows("BANK_TRANSFER") || allows("CASH");

	function run(fn: () => Promise<{ ok: true } | { error: string }>) {
		setError(null);
		setNotice(null);
		startTransition(async () => {
			const result = await fn();
			if ("error" in result) setError(result.error);
			else setNotice("Saved.");
		});
	}

	function toggle(channel: PaymentMethodState["channel"], next: boolean) {
		run(() => togglePaymentChannelAction({ slug, channel, isEnabled: next }));
	}

	return (
		<SettingsCard
			title="Payments"
			description="Choose how customers can pay you. You can enable more than one."
			icon={Wallet}
		>
			<div className="grid min-w-0 gap-4">
				{error ? (
					<p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
						{error}
					</p>
				) : null}
				{notice ? (
					<p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
						{notice}
					</p>
				) : null}

				{showOnlineHeading ? (
					<p className="text-xs font-black uppercase tracking-wide text-slate-400">
						Online payments
					</p>
				) : null}

				{allows("AWAMENU_PAY") ? (
					<ChannelShell
						icon={CreditCard}
						title="AwaMenu Pay"
						badge="Recommended"
						description="Customers pay online and the money is settled straight to your bank account — it never passes through AwaMenu. Turn on one provider or both."
						status={
							connectedCount > 0
								? {
										label:
											connectedCount === 1
												? `${getGatewayDescriptor(payoutAccounts.find((a) => a.isEnabled)?.gateway ?? "PAYSTACK").label} on`
												: `${connectedCount} providers on`,
										tone: "connected",
									}
								: { label: "Setup needed", tone: "pending" }
						}
						checked={byChannel.AWAMENU_PAY?.isEnabled ?? false}
						onToggle={(next) => toggle("AWAMENU_PAY", next)}
						disabled={isPending}
					>
						<div className="grid min-w-0 gap-3">
							{providers.length > 1 ? (
								<p className="text-xs font-medium leading-5 text-slate-500">
									Connect either provider, or both. With both on, the customer
									chooses which one to pay through at checkout.
								</p>
							) : null}

							{providers.map((provider) => (
								<ProviderConnection
									key={provider}
									slug={slug}
									provider={provider}
									account={byGateway[provider]}
									commissionPercent={commissionPercent}
									isPending={isPending}
									run={run}
								/>
							))}

							{providers.length === 0 ? (
								<p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
									Loading providers…
								</p>
							) : null}
						</div>
					</ChannelShell>
				) : null}

				{allows("OWN_GATEWAY") && ownGatewayOptions.length > 0 ? (
					<ChannelShell
						icon={Landmark}
						title="Connect your own gateway"
						description="Already have a payment provider? Use your own account and keys — payments go straight into it."
						status={
							byChannel.OWN_GATEWAY?.hasSecretKey
								? {
										label: `${getGatewayDescriptor(byChannel.OWN_GATEWAY.gateway ?? "PAYSTACK").label} connected`,
										tone: "connected",
									}
								: { label: "Setup needed", tone: "pending" }
						}
						checked={byChannel.OWN_GATEWAY?.isEnabled ?? false}
						onToggle={(next) => toggle("OWN_GATEWAY", next)}
						disabled={isPending}
					>
						<div className="grid gap-3">
							<div className="flex flex-wrap gap-2">
								{ownGatewayOptions.map((option) => (
									<button
										key={option.id}
										type="button"
										onClick={() => {
											setGateway(option.id);
											setCredentials({});
										}}
										className={cn(
											"min-h-10 rounded-xl border px-3 text-sm font-black transition-colors",
											gateway === option.id
												? "border-emerald-600 bg-emerald-50 text-emerald-800"
												: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
										)}
									>
										{option.label}
									</button>
								))}
							</div>

							{byChannel.OWN_GATEWAY?.hasSecretKey ? (
								<p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
									{
										getGatewayDescriptor(
											byChannel.OWN_GATEWAY.gateway ?? "PAYSTACK",
										).label
									}{" "}
									is connected. Enter new keys below only if you want to replace
									them.
								</p>
							) : null}

							{descriptor.credentialFields.map((field) => (
								<label key={field.key} className="grid min-w-0 gap-1.5">
									<span className="text-xs font-bold uppercase tracking-wide text-slate-500">
										{field.label}
									</span>
									<input
										type={field.secret ? "password" : "text"}
										autoComplete="off"
										placeholder={field.placeholder}
										value={credentials[field.key] ?? ""}
										onChange={(event) =>
											setCredentials((prev) => ({
												...prev,
												[field.key]: event.target.value,
											}))
										}
										className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 sm:text-sm"
									/>
									{field.help ? (
										<span className="text-[11px] font-medium text-slate-400">
											{field.help}
										</span>
									) : null}
								</label>
							))}

							<div className="flex flex-wrap gap-3 text-xs font-black">
								<a
									href={descriptor.keysHelpUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1.5 text-emerald-700 hover:underline"
								>
									<PlayCircle className="size-4" aria-hidden="true" />
									How to get your keys
								</a>
								<a
									href={descriptor.dashboardUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex items-center gap-1.5 text-slate-600 hover:underline"
								>
									<ExternalLink className="size-4" aria-hidden="true" />
									Open {descriptor.label}
								</a>
							</div>

							<button
								type="button"
								disabled={!credentials.secretKey || isPending}
								onClick={() =>
									run(() =>
										saveOwnGatewayAction({
											slug,
											gateway,
											secretKey: credentials.secretKey ?? "",
											publicKey: credentials.publicKey,
											contractCode: credentials.contractCode,
										}),
									)
								}
								className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-50 sm:w-auto sm:justify-self-start"
							>
								{isPending ? "Verifying…" : "Save & test connection"}
							</button>
							<p className="text-[11px] font-medium text-slate-400">
								We check the keys with {descriptor.label} before saving, so a
								typo is caught here rather than by a customer at checkout.
							</p>
						</div>
					</ChannelShell>
				) : null}

				{showManualHeading ? (
					<p className="mt-2 text-xs font-black uppercase tracking-wide text-slate-400">
						Manual payments
					</p>
				) : null}

				{allows("BANK_TRANSFER") ? (
					<ChannelShell
						icon={Landmark}
						title="Bank transfer"
						description="Show your account details at checkout so customers can transfer manually. You confirm the payment yourself."
						status={
							byChannel.BANK_TRANSFER?.accountNumber
								? {
										label: `••••${byChannel.BANK_TRANSFER.accountNumber.slice(-4)}`,
										tone: "connected",
									}
								: { label: "Setup needed", tone: "pending" }
						}
						checked={byChannel.BANK_TRANSFER?.isEnabled ?? false}
						onToggle={(next) => toggle("BANK_TRANSFER", next)}
						disabled={isPending}
					>
						{byChannel.BANK_TRANSFER?.accountNumber ? (
							<div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
								<p className="font-black text-slate-900">
									{byChannel.BANK_TRANSFER.accountName}
								</p>
								<p className="text-xs font-medium text-slate-600">
									{byChannel.BANK_TRANSFER.bankName} ·{" "}
									{byChannel.BANK_TRANSFER.accountNumber}
								</p>
							</div>
						) : null}
						<div className="mt-3 grid gap-3">
							<BankAccountPicker slug={slug} onVerified={setTransferBank} />
							<button
								type="button"
								disabled={!transferBank || isPending}
								onClick={() =>
									transferBank &&
									run(() =>
										saveBankDetailsAction({
											slug,
											...transferBank,
										}),
									)
								}
								className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-50 sm:w-auto sm:justify-self-start"
							>
								Save account
							</button>
						</div>
					</ChannelShell>
				) : null}

				{allows("CASH") ? (
					<ChannelShell
						icon={Banknote}
						title="Cash"
						description="Let customers pay with cash on delivery, pickup, or at the table."
						checked={byChannel.CASH?.isEnabled ?? false}
						onToggle={(next) => toggle("CASH", next)}
						disabled={isPending}
					/>
				) : null}

				{allowedChannels?.length === 0 ? (
					<p className="rounded-xl bg-slate-50 px-3 py-3 text-sm font-bold text-slate-500">
						No payment options are available right now. Please check back
						shortly.
					</p>
				) : null}
			</div>
		</SettingsCard>
	);
}
