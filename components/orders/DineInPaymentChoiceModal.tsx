"use client";

import {
	ArrowLeft,
	Banknote,
	Building,
	CheckCircle2,
	Copy,
	CreditCard,
	Landmark,
} from "lucide-react";
import { useState, useTransition } from "react";
import {
	initiateOrderPaymentAction,
	selectInHousePaymentAction,
} from "@/actions/order.actions";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";

type BankAccount = {
	id: string;
	accountName: string;
	accountNumber: string;
	bankName: string;
};

type Props = {
	orderId: string;
	slug: string;
	total: number;
	currency: string;
	isOpen: boolean;
	onClose: () => void;
	bankAccounts?: BankAccount[];
	onlineProviders?: Array<{
		gateway: string;
		label: string;
		checkoutMethods: string;
	}>;
};

export function DineInPaymentChoiceModal({
	orderId,
	slug,
	total,
	currency,
	isOpen,
	onClose,
	bankAccounts = [],
	onlineProviders = [],
}: Props) {
	const [isPending, startTransition] = useTransition();
	const [view, setView] = useState<
		"methods" | "transfers" | "transfer_details"
	>("methods");
	const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(
		null,
	);
	const [copied, setCopied] = useState(false);

	const currencySymbol = currency === "NGN" ? "₦" : currency;

	function handleSelectInHouse(method: "CASH" | "TRANSFER_OR_CARD") {
		const fd = new FormData();
		fd.set("orderId", orderId);
		fd.set("slug", slug);
		fd.set("method", method);
		startTransition(async () => {
			await selectInHousePaymentAction(fd);
			onClose();
		});
	}

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			size="md"
		>
			<DialogHeader
				bordered
				title={
					<span className="flex items-center gap-3">
						{view !== "methods" ? (
							<button
								type="button"
								onClick={() => {
									if (view === "transfer_details") {
										setView("transfers");
									} else {
										setView("methods");
									}
								}}
								className="grid size-8 shrink-0 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"
							>
								<ArrowLeft className="size-5" />
							</button>
						) : null}
						<span>
							{view === "methods"
								? "Select Payment Method"
								: view === "transfers"
									? "Transfer Options"
									: "Transfer Details"}
						</span>
					</span>
				}
			/>

			<DialogBody>
				<p className="text-sm font-medium text-slate-600 mb-5">
					How would you like to pay your total of{" "}
					<strong className="text-slate-950 font-black">
						{currencySymbol}
						{total.toLocaleString()}
					</strong>
					?
				</p>

				{view === "methods" && (
					<div className="grid gap-3">
						<button
							type="button"
							disabled={isPending}
							onClick={() => handleSelectInHouse("CASH")}
							className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition-colors hover:bg-emerald-50 hover:border-emerald-200 disabled:opacity-50"
						>
							<div className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
								<Banknote className="size-5" />
							</div>
							<div>
								<p className="font-black text-slate-950">Cash</p>
								<p className="text-sm text-slate-500">Pay cash to our staff</p>
							</div>
						</button>

						<button
							type="button"
							disabled={isPending}
							onClick={() => handleSelectInHouse("TRANSFER_OR_CARD")}
							className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition-colors hover:bg-emerald-50 hover:border-emerald-200 disabled:opacity-50"
						>
							<div className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
								<CreditCard className="size-5" />
							</div>
							<div>
								<p className="font-black text-slate-950">POS Terminal</p>
								<p className="text-sm text-slate-500">
									Pay with your card in house
								</p>
							</div>
						</button>

						<button
							type="button"
							disabled={isPending}
							onClick={() => setView("transfers")}
							className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition-colors hover:bg-emerald-50 hover:border-emerald-200 disabled:opacity-50"
						>
							<div className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
								<Landmark className="size-5" />
							</div>
							<div>
								<p className="font-black text-slate-950">Bank Transfer</p>
								<p className="text-sm text-slate-500">
									Transfer to our local accounts or pay online
								</p>
							</div>
						</button>
					</div>
				)}

				{view === "transfers" && (
					<div className="grid gap-3">
						{bankAccounts.map((account) => (
							<button
								key={account.id}
								type="button"
								disabled={isPending}
								onClick={() => {
									setSelectedAccount(account);
									setView("transfer_details");
								}}
								className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition-colors hover:bg-emerald-50 hover:border-emerald-200 disabled:opacity-50"
							>
								<div className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600">
									<Building className="size-5" />
								</div>
								<div className="overflow-hidden">
									<p className="font-black text-slate-950 truncate">
										{account.bankName}
									</p>
								</div>
							</button>
						))}

						{/* One button per live provider. A restaurant running both
						    Paystack and Monnify offers both here; the label has to name
						    the provider, because the checkout the customer lands on is
						    branded and an unexpected name reads as a wrong redirect. */}
						{/* No invented fallback. A restaurant with no payout account
						    connected has no online option, and offering one would take
						    the customer's money into AwaMenu's account with no way to
						    pass it on. */}
						{onlineProviders.map((provider) => (
							<form key={provider.gateway} action={initiateOrderPaymentAction}>
								<input type="hidden" name="slug" value={slug} />
								<input type="hidden" name="orderId" value={orderId} />
								<input type="hidden" name="gateway" value={provider.gateway} />
								<button
									type="submit"
									disabled={isPending}
									className="flex w-full items-center gap-4 rounded-2xl border border-emerald-600 bg-emerald-50 p-4 text-left transition-colors hover:bg-emerald-100 disabled:opacity-50"
								>
									<div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white">
										<Landmark className="size-5" />
									</div>
									<div className="min-w-0">
										<p className="font-black text-emerald-950">
											Pay with {provider.label}
										</p>
										<p className="text-sm text-emerald-700">
											{provider.checkoutMethods}
										</p>
									</div>
								</button>
							</form>
						))}
					</div>
				)}

				{view === "transfer_details" && selectedAccount && (
					<div className="grid gap-5">
						<div className="rounded-2xl border border-slate-200 p-5 bg-slate-50">
							<div className="mb-4">
								<p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
									Bank Name
								</p>
								<p className="font-black text-slate-950 text-lg">
									{selectedAccount.bankName}
								</p>
							</div>
							<div className="mb-4">
								<p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
									Account Number
								</p>
								<div className="flex items-center gap-3">
									<p className="font-mono font-black text-slate-950 text-2xl tracking-widest">
										{selectedAccount.accountNumber}
									</p>
									<button
										type="button"
										title="Copy account number"
										className="grid size-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
										onClick={() => {
											navigator.clipboard.writeText(
												selectedAccount.accountNumber,
											);
											setCopied(true);
											setTimeout(() => setCopied(false), 2000);
										}}
									>
										{copied ? (
											<CheckCircle2 className="size-4" />
										) : (
											<Copy className="size-4" />
										)}
									</button>
								</div>
							</div>
							<div>
								<p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
									Account Name
								</p>
								<p className="font-bold text-slate-950">
									{selectedAccount.accountName}
								</p>
							</div>
						</div>

						<div className="bg-amber-50 text-amber-900 text-sm font-bold p-4 rounded-xl border border-amber-200">
							Please make sure to transfer the exact amount above. After
							sending, click the button below and wait for staff confirmation.
						</div>

						<button
							type="button"
							disabled={isPending}
							onClick={() => handleSelectInHouse("TRANSFER_OR_CARD")}
							className="mt-2 inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-black text-white shadow-[0_14px_35px_rgba(4,120,87,0.18)] disabled:opacity-50 transition-all hover:bg-emerald-800"
						>
							{isPending ? "Confirming..." : "I have sent the money"}
						</button>
					</div>
				)}
			</DialogBody>
		</Dialog>
	);
}
