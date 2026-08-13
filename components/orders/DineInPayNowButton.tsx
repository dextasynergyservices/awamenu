"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { initiateOrderPaymentAction } from "@/actions/order.actions";
import { Dialog, DialogBody, DialogTitle } from "@/components/ui/Dialog";
import { DineInPaymentChoiceModal } from "./DineInPaymentChoiceModal";

type Props = {
	orderId: string;
	slug: string;
	total: number;
	currency: string;
	policy: string | null;
	bankAccounts?: Array<{
		id: string;
		accountName: string;
		accountNumber: string;
		bankName: string;
	}>;
	orderType?: string;
	/** Online providers this restaurant has live. More than one → customer picks. */
	onlineProviders?: Array<{
		gateway: string;
		label: string;
		checkoutMethods: string;
	}>;
};

export function DineInPayNowButton({
	orderId,
	slug,
	total,
	currency,
	policy,
	bankAccounts,
	orderType,
	onlineProviders = [],
}: Props) {
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isPayLaterModalOpen, setIsPayLaterModalOpen] = useState(false);
	const [hasClickedPayLater, setHasClickedPayLater] = useState(true);
	const [isPending, startTransition] = useTransition();
	// Defaults to the first provider so a customer who ignores the choice still
	// gets a working checkout rather than a validation error.
	const [gateway, setGateway] = useState(onlineProviders[0]?.gateway ?? "");

	useEffect(() => {
		const timer = setTimeout(() => {
			const clicked = localStorage.getItem(`awamenu_pay_later_${orderId}`);
			if (clicked !== "true") {
				setHasClickedPayLater(false);
			}
		}, 0);
		return () => clearTimeout(timer);
	}, [orderId]);

	function handlePayLaterClick() {
		setIsPayLaterModalOpen(true);
		setHasClickedPayLater(true);
		localStorage.setItem(`awamenu_pay_later_${orderId}`, "true");
	}

	if (orderType && orderType !== "DINE_IN") {
		// Nothing to offer if the restaurant hasn't connected a payout account.
		// Showing "Pay online" anyway would charge the customer into AwaMenu's
		// balance with no way to pass the money on.
		if (onlineProviders.length === 0) {
			return (
				<p className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
					This restaurant takes payment on delivery or pickup. They&apos;ll be
					in touch to arrange it.
				</p>
			);
		}

		return (
			<div className="mt-5 grid gap-3">
				<form action={initiateOrderPaymentAction}>
					<input type="hidden" name="slug" value={slug} />
					<input type="hidden" name="orderId" value={orderId} />
					<input type="hidden" name="gateway" value={gateway} />
					<PaymentProviderChoice
						providers={onlineProviders}
						value={gateway}
						onChange={setGateway}
					/>
					<button
						type="submit"
						disabled={isPending}
						onClick={(e) => {
							if (isPending) e.preventDefault();
							else {
								const form = e.currentTarget.closest("form");
								if (form) {
									e.preventDefault();
									startTransition(() => {
										form.requestSubmit();
									});
								}
							}
						}}
						className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-50"
					>
						Pay online
					</button>
				</form>
			</div>
		);
	}

	return (
		<div className="mt-5 grid gap-3">
			<button
				type="button"
				onClick={() => setIsModalOpen(true)}
				className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white"
			>
				Pay now
			</button>
			{policy === "FLEXIBLE" && !hasClickedPayLater && (
				<button
					type="button"
					onClick={handlePayLaterClick}
					className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-emerald-700 bg-white px-4 text-sm font-black text-emerald-700 hover:bg-emerald-50 transition-colors"
				>
					Pay later
				</button>
			)}
			<DineInPaymentChoiceModal
				isOpen={isModalOpen}
				onClose={() => setIsModalOpen(false)}
				orderId={orderId}
				slug={slug}
				total={total}
				currency={currency}
				bankAccounts={bankAccounts}
			/>
			<PayLaterModal
				isOpen={isPayLaterModalOpen}
				onClose={() => setIsPayLaterModalOpen(false)}
			/>
		</div>
	);
}

/**
 * Lets the customer choose which provider to pay through.
 *
 * Renders nothing when there's one option (or none): a choice of one is just an
 * extra tap between a hungry customer and their food. The provider names are
 * shown because a card form that arrives branded "Monnify" after tapping "Pay
 * online" reads as a redirect to somewhere unexpected.
 */
export function PaymentProviderChoice({
	providers,
	value,
	onChange,
}: {
	providers: Array<{ gateway: string; label: string; checkoutMethods: string }>;
	value: string;
	onChange: (next: string) => void;
}) {
	if (providers.length < 2) return null;

	return (
		<fieldset className="mb-3 grid min-w-0 gap-2">
			<legend className="mb-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
				Pay with
			</legend>
			{providers.map((provider) => (
				<label
					key={provider.gateway}
					className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition-colors ${
						value === provider.gateway
							? "border-emerald-600 bg-emerald-50"
							: "border-slate-200 bg-white"
					}`}
				>
					<input
						type="radio"
						name="gatewayChoice"
						value={provider.gateway}
						checked={value === provider.gateway}
						onChange={() => onChange(provider.gateway)}
						className="mt-0.5 size-4 shrink-0 accent-emerald-600"
					/>
					<span className="min-w-0">
						<span className="block text-sm font-black text-slate-900">
							{provider.label}
						</span>
						<span className="block text-xs font-medium leading-5 text-slate-500">
							{provider.checkoutMethods}
						</span>
					</span>
				</label>
			))}
		</fieldset>
	);
}

function PayLaterModal({
	isOpen,
	onClose,
}: {
	isOpen: boolean;
	onClose: () => void;
}) {
	return (
		<Dialog
			open={isOpen}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			size="sm"
		>
			<DialogBody className="pt-4 text-center sm:pt-5">
				<div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 mb-4">
					<CheckCircle2 className="size-6 text-emerald-600" />
				</div>
				<DialogTitle className="text-xl font-black text-slate-950 mb-2">
					Pay Later
				</DialogTitle>
				<p className="text-sm font-medium text-slate-600 mb-6">
					You can pay the staff when you&apos;re eating. Enjoy your meal!
				</p>
				<button
					type="button"
					onClick={onClose}
					className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-black text-white hover:bg-slate-800 transition-colors"
				>
					Got it
				</button>
			</DialogBody>
		</Dialog>
	);
}
