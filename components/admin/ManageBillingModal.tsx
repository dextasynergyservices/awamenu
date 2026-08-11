"use client";

import {
	AlertCircle,
	ArrowLeft,
	CreditCard,
	Loader2,
	Plus,
} from "lucide-react";
import { useState } from "react";
import {
	cancelSubscriptionAction,
	getCustomerCardsAction,
	initiateAddCardAction,
	removeCardAction,
	turnOnAutoRenewAction,
} from "@/actions/billing.actions";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";

type ManageBillingModalProps = {
	planName: string;
	status: string;
	currentPeriodEnd: Date | null;
	hasCard: boolean;
	slug: string;
	onClose: () => void;
};
type Card = {
	authorization_code?: string;
	bank?: string;
	brand?: string;
	last4?: string;
	exp_month?: string;
	exp_year?: string;
};

export function ManageBillingModal({
	planName,
	status,
	currentPeriodEnd,
	hasCard,
	slug,
	onClose,
}: ManageBillingModalProps) {
	const [view, setView] = useState<"main" | "cards">("main");
	const [cards, setCards] = useState<Card[]>([]);
	const [isLoadingCards, setIsLoadingCards] = useState(false);

	const [isCancelling, setIsCancelling] = useState(false);
	const [isRemoving, setIsRemoving] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);

	const handleCancelSubscription = async () => {
		setIsCancelling(true);
		setErrorMsg(null);
		setSuccessMsg(null);

		try {
			const result = await cancelSubscriptionAction();
			if (result?.error) {
				setErrorMsg(result.error);
			} else {
				setSuccessMsg("Auto-renewal has been stopped.");
				setTimeout(() => {
					window.location.reload();
				}, 2000);
			}
		} catch {
			setErrorMsg(
				"An unexpected error occurred while turning off auto-renewal.",
			);
		} finally {
			setIsCancelling(false);
		}
	};

	const handleRemoveCard = async () => {
		setIsRemoving(true);
		setErrorMsg(null);
		setSuccessMsg(null);

		try {
			const result = await removeCardAction();
			if (result?.error) {
				setErrorMsg(result.error);
			} else {
				setSuccessMsg("Card removed successfully.");
				setTimeout(() => {
					window.location.reload();
				}, 2000);
			}
		} catch {
			setErrorMsg("An unexpected error occurred while removing the card.");
		} finally {
			setIsRemoving(false);
		}
	};

	const loadCards = async () => {
		setIsLoadingCards(true);
		setView("cards");
		setErrorMsg(null);
		setSuccessMsg(null);
		try {
			const res = await getCustomerCardsAction();
			setCards(res.cards || []);
		} catch {
			setErrorMsg("Failed to load cards.");
		} finally {
			setIsLoadingCards(false);
		}
	};

	const handleAddCard = async () => {
		setIsCancelling(true);
		setErrorMsg(null);
		try {
			const result = await initiateAddCardAction(slug);
			if ("error" in result) throw new Error(result.error);
		} catch {
			setErrorMsg("Failed to initiate add card flow.");
			setIsCancelling(false);
		}
	};

	const handleTurnOnAutoRenew = async () => {
		if (!hasCard) {
			setErrorMsg(
				"Please add a saved card first before turning on auto-renewal.",
			);
			return;
		}

		setIsCancelling(true);
		setErrorMsg(null);
		setSuccessMsg(null);
		try {
			const result = await turnOnAutoRenewAction();
			if (result?.error) {
				setErrorMsg(result.error);
			} else {
				setSuccessMsg("Auto-renewal enabled successfully.");
				setTimeout(() => window.location.reload(), 2000);
			}
		} catch {
			setErrorMsg("An unexpected error occurred.");
		} finally {
			setIsCancelling(false);
		}
	};

	const isPending = isCancelling || isRemoving || isLoadingCards;
	const isEffectivelyActive =
		status === "ACTIVE" ||
		status === "TRIALING" ||
		(status === "CANCELLED" &&
			currentPeriodEnd &&
			new Date(currentPeriodEnd) > new Date());
	const displayStatus =
		status === "CANCELLED" &&
		currentPeriodEnd &&
		new Date(currentPeriodEnd) > new Date()
			? "ACTIVE"
			: status;

	return (
		<Dialog
			open
			onOpenChange={(next) => {
				if (!next && !isPending) onClose();
			}}
			size="md"
		>
			<DialogHeader
				title={
					<span className="flex items-center gap-3">
						{view === "cards" ? (
							<button
								type="button"
								onClick={() => setView("main")}
								className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
							>
								<ArrowLeft className="size-5" />
							</button>
						) : (
							<div className="flex size-10 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
								<CreditCard className="size-5" />
							</div>
						)}
						<span>{view === "cards" ? "Manage Cards" : "Manage Billing"}</span>
					</span>
				}
			/>

			<DialogBody>
				{errorMsg && (
					<div className="mb-6 rounded-2xl bg-red-50 p-4 text-xs font-medium text-red-800 border border-red-100 flex gap-2 items-start md:text-sm">
						<AlertCircle className="size-4 shrink-0 mt-0.5 md:size-5" />
						<p>{errorMsg}</p>
					</div>
				)}

				{successMsg && (
					<div className="mb-6 rounded-2xl bg-emerald-50 p-4 text-xs font-medium text-emerald-800 border border-emerald-100 flex gap-2 items-start md:text-sm">
						<AlertCircle className="size-4 shrink-0 mt-0.5 md:size-5" />
						<p>{successMsg}</p>
					</div>
				)}

				{view === "main" && (
					<div className="space-y-6">
						<div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 md:p-5">
							<p className="mb-1 text-xs font-bold text-slate-500 md:text-sm">
								Current Plan
							</p>
							<div className="flex items-center justify-between">
								<span className="text-lg font-black text-slate-950 md:text-xl">
									{planName}
								</span>
								<span
									className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${isEffectivelyActive ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
								>
									{displayStatus}
								</span>
							</div>
							{currentPeriodEnd && (
								<p className="mt-1 text-xs font-medium text-slate-600 md:mt-2 md:text-sm">
									Current billing period ends:{" "}
									{new Intl.DateTimeFormat("en-US", {
										dateStyle: "long",
									}).format(currentPeriodEnd)}
								</p>
							)}
						</div>

						<div className="grid gap-2 md:gap-3">
							<a
								href={`/dashboard/${slug}/settings/plan`}
								className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 md:h-12 md:text-sm ${isPending ? "pointer-events-none opacity-50" : ""}`}
							>
								Change Plan
							</a>

							{status === "ACTIVE" ? (
								<button
									type="button"
									onClick={handleCancelSubscription}
									disabled={isPending}
									className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50 disabled:cursor-not-allowed md:h-12 md:text-sm"
								>
									{isCancelling ? (
										<Loader2 className="size-4 animate-spin" />
									) : null}
									Stop Auto-Renewal
								</button>
							) : (
								<button
									type="button"
									onClick={handleTurnOnAutoRenew}
									disabled={isPending}
									className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-900 px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50 disabled:cursor-not-allowed md:h-12 md:text-sm"
								>
									{isCancelling ? (
										<Loader2 className="size-4 animate-spin" />
									) : null}
									Turn On Auto-Renewal
								</button>
							)}

							{!hasCard ? (
								<button
									type="button"
									onClick={handleAddCard}
									disabled={isPending}
									className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50 disabled:cursor-not-allowed md:h-12 md:text-sm"
								>
									{isCancelling ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<Plus className="size-4" />
									)}
									Add Card
								</button>
							) : (
								<button
									type="button"
									onClick={loadCards}
									disabled={isPending}
									className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									{isLoadingCards ? (
										<Loader2 className="size-4 animate-spin" />
									) : (
										<CreditCard className="size-4" />
									)}
									Manage Cards
								</button>
							)}
						</div>

						<p className="text-xs text-center text-slate-500 mt-4 leading-relaxed">
							Changing your plan will start a new billing cycle. Stopping
							auto-renewal will prevent future charges.
						</p>
					</div>
				)}

				{view === "cards" && (
					<div className="space-y-4">
						{isLoadingCards ? (
							<div className="flex justify-center items-center py-8">
								<Loader2 className="size-6 animate-spin text-slate-400" />
							</div>
						) : cards.length > 0 ? (
							<div className="space-y-3">
								{cards.map((card) => (
									<div
										key={
											card.authorization_code ??
											`${card.last4}-${card.exp_month}-${card.exp_year}`
										}
										className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 bg-white shadow-sm"
									>
										<div className="flex items-center gap-3">
											<div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
												<CreditCard className="size-5" />
											</div>
											<div>
												<p className="text-sm font-bold text-slate-950 uppercase">
													{card.bank || card.brand}
												</p>
												<p className="text-xs font-medium text-slate-500">
													**** {card.last4} • {card.exp_month}/{card.exp_year}
												</p>
											</div>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="text-center py-8 px-4 rounded-2xl border border-slate-200 bg-slate-50">
								<CreditCard className="size-8 text-slate-400 mx-auto mb-3" />
								<p className="text-sm font-bold text-slate-700">
									No cards found
								</p>
								<p className="text-xs text-slate-500 mt-1">
									You don&apos;t have any saved cards.
								</p>
							</div>
						)}

						<div className="pt-4 border-t border-slate-100 grid gap-3">
							<button
								type="button"
								onClick={handleAddCard}
								disabled={isPending}
								className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isCancelling ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<Plus className="size-4" />
								)}
								Add New Card
							</button>
							<button
								type="button"
								onClick={handleRemoveCard}
								disabled={isPending}
								className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-4 text-sm font-bold text-red-700 transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isRemoving ? (
									<Loader2 className="size-4 animate-spin" />
								) : null}
								Remove All Cards
							</button>
						</div>
					</div>
				)}
			</DialogBody>
		</Dialog>
	);
}
