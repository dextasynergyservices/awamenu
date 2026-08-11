"use client";

import {
	BadgeCheck,
	Check,
	ChevronDown,
	Loader2,
	TriangleAlert,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import {
	listBanksAction,
	resolveAccountAction,
} from "@/actions/payment-settings.actions";

type Bank = { name: string; code: string };

export type BankSelection = {
	bankCode: string;
	bankName: string;
	accountNumber: string;
	accountName: string;
};

type Props = {
	slug: string;
	/** Bank codes are provider-specific, so the list must come from the provider
	 * that will actually create the subaccount. */
	gateway?: "PAYSTACK" | "FLUTTERWAVE" | "MONNIFY";
	initial?: Partial<BankSelection>;
	/** Fires only when an account has been verified — a caller can't save an
	 * unverified name, which is the point of resolving rather than typing it. */
	onVerified: (selection: BankSelection | null) => void;
};

/**
 * Bank + account number input that resolves the account holder's name.
 *
 * The bank field is a searchable combobox rather than a native `<select>`:
 * there are ~275 banks, and picking one from a native list (a scroll wheel on
 * iOS) is unusable. Typing filters in place — there's no separate search box.
 *
 * The account name is never typed: it comes back from the provider, so a
 * mistyped digit surfaces here rather than at settlement, when money would
 * already be heading to the wrong account.
 */
export function BankAccountPicker({
	slug,
	gateway,
	initial,
	onVerified,
}: Props) {
	const bankFieldId = useId();
	const accountFieldId = useId();
	const listboxId = useId();

	const [banks, setBanks] = useState<Bank[]>([]);
	const [loadingBanks, setLoadingBanks] = useState(true);
	const [bankCode, setBankCode] = useState(initial?.bankCode ?? "");
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);
	const [accountNumber, setAccountNumber] = useState(
		initial?.accountNumber ?? "",
	);
	const [accountName, setAccountName] = useState(initial?.accountName ?? "");
	const [resolving, setResolving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const wrapperRef = useRef<HTMLDivElement>(null);
	const onVerifiedRef = useRef(onVerified);
	useEffect(() => {
		onVerifiedRef.current = onVerified;
	});

	useEffect(() => {
		let active = true;
		listBanksAction({ slug, gateway })
			.then((result) => {
				if (!active) return;
				setBanks(result.banks);
				if ("error" in result && result.error) setError(result.error);
			})
			.finally(() => active && setLoadingBanks(false));
		return () => {
			active = false;
		};
	}, [slug, gateway]);

	// Closes the dropdown on an outside click, so it can't sit open over the
	// rest of the form.
	useEffect(() => {
		if (!open) return;
		function onPointerDown(event: PointerEvent) {
			if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
		}
		document.addEventListener("pointerdown", onPointerDown);
		return () => document.removeEventListener("pointerdown", onPointerDown);
	}, [open]);

	useEffect(() => {
		if (!bankCode || accountNumber.length !== 10) {
			setAccountName("");
			onVerifiedRef.current(null);
			return;
		}

		let active = true;
		setResolving(true);
		setError(null);

		// Debounced so a fast typist doesn't fire a lookup per keystroke.
		const timer = window.setTimeout(async () => {
			const result = await resolveAccountAction({
				slug,
				gateway,
				bankCode,
				accountNumber,
			});
			if (!active) return;

			if ("error" in result) {
				setError(result.error);
				setAccountName("");
				onVerifiedRef.current(null);
			} else {
				setAccountName(result.accountName);
				onVerifiedRef.current({
					bankCode,
					bankName: banks.find((b) => b.code === bankCode)?.name ?? "",
					accountNumber,
					accountName: result.accountName,
				});
			}
			setResolving(false);
		}, 400);

		return () => {
			active = false;
			window.clearTimeout(timer);
			setResolving(false);
		};
	}, [slug, gateway, bankCode, accountNumber, banks]);

	const selectedBank = banks.find((b) => b.code === bankCode);
	const trimmed = query.trim().toLowerCase();
	const matches = (
		trimmed
			? banks.filter((b) => b.name.toLowerCase().includes(trimmed))
			: banks
	).slice(0, 60);

	function choose(bank: Bank) {
		setBankCode(bank.code);
		setQuery("");
		setOpen(false);
		setActive(0);
	}

	function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Escape") {
			setOpen(false);
			return;
		}
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			if (!open) {
				setOpen(true);
				return;
			}
			const step = event.key === "ArrowDown" ? 1 : -1;
			setActive((index) =>
				matches.length === 0
					? 0
					: (index + step + matches.length) % matches.length,
			);
			return;
		}
		if (event.key === "Enter" && open) {
			const bank = matches[active];
			if (bank) {
				event.preventDefault();
				choose(bank);
			}
		}
	}

	return (
		// `min-w-0` throughout: without it a long bank name forces the grid track
		// wider than the card and the whole panel scrolls sideways on mobile.
		<div className="grid min-w-0 gap-3">
			<div ref={wrapperRef} className="relative min-w-0">
				<label
					htmlFor={bankFieldId}
					className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
				>
					Bank
				</label>
				<div className="relative">
					<input
						id={bankFieldId}
						role="combobox"
						aria-expanded={open}
						aria-controls={listboxId}
						aria-autocomplete="list"
						autoComplete="off"
						disabled={loadingBanks}
						value={open ? query : (selectedBank?.name ?? "")}
						onFocus={() => setOpen(true)}
						onChange={(event) => {
							setQuery(event.target.value);
							setActive(0);
							setOpen(true);
						}}
						onKeyDown={onKeyDown}
						placeholder={
							loadingBanks ? "Loading banks…" : "Search or select your bank"
						}
						className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white pr-10 pl-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 disabled:opacity-60 sm:text-sm"
					/>
					<ChevronDown
						className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400"
						aria-hidden="true"
					/>
				</div>

				{open ? (
					<div
						id={listboxId}
						role="listbox"
						aria-label="Banks"
						className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
					>
						{matches.length === 0 ? (
							<p className="px-3 py-2 text-sm font-medium text-slate-500">
								No banks match “{query}”
							</p>
						) : (
							matches.map((bank, index) => (
								<div
									key={bank.code}
									role="option"
									tabIndex={-1}
									aria-selected={bank.code === bankCode}
									// pointerdown, not click: a blur would close the list before
									// the pick landed.
									onPointerDown={(event) => {
										event.preventDefault();
										choose(bank);
									}}
									onKeyDown={() => {}}
									onMouseEnter={() => setActive(index)}
									className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium text-slate-800 ${
										index === active ? "bg-emerald-50" : ""
									}`}
								>
									<span className="min-w-0 truncate">{bank.name}</span>
									{bank.code === bankCode ? (
										<Check
											className="size-4 shrink-0 text-emerald-600"
											aria-hidden="true"
										/>
									) : null}
								</div>
							))
						)}
					</div>
				) : null}
			</div>

			<div className="min-w-0">
				<label
					htmlFor={accountFieldId}
					className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
				>
					Account number
				</label>
				<input
					id={accountFieldId}
					inputMode="numeric"
					maxLength={10}
					value={accountNumber}
					onChange={(event) =>
						setAccountNumber(event.target.value.replace(/\D/g, "").slice(0, 10))
					}
					placeholder="0123456789"
					className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 sm:text-sm"
				/>
			</div>

			{resolving ? (
				<p className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
					<Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
					Checking account…
				</p>
			) : accountName ? (
				<p className="flex min-w-0 items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-800">
					<BadgeCheck className="size-4 shrink-0" aria-hidden="true" />
					<span className="min-w-0 break-words">{accountName}</span>
				</p>
			) : error ? (
				<p className="flex min-w-0 items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
					<TriangleAlert
						className="mt-0.5 size-4 shrink-0"
						aria-hidden="true"
					/>
					<span className="min-w-0">{error}</span>
				</p>
			) : (
				<p className="text-xs font-medium text-slate-400">
					Pick your bank and enter the 10-digit account number — we&apos;ll
					confirm the account name automatically.
				</p>
			)}
		</div>
	);
}
