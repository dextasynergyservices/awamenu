"use client";

import { ArrowRight, Landmark, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
	deleteBankAccountAction,
	saveBankAccountAction,
	toggleBankAccountStatusAction,
} from "@/actions/bank-accounts.actions";
import { SettingsCard } from "@/components/admin/SettingsCard";
import { SubmitButton } from "@/components/ui/action-button";

type BankAccount = {
	id: string;
	accountName: string;
	accountNumber: string;
	bankName: string;
	isActive: boolean;
};

type Props = {
	slug: string;
	bankAccounts: BankAccount[];
};

export function BankAccountsManager({ slug, bankAccounts }: Props) {
	const [editingAccount, setEditingAccount] = useState<BankAccount | null>(
		null,
	);
	const [isAdding, setIsAdding] = useState(false);

	return (
		<>
			<SettingsCard
				title="Bank Accounts"
				description="Manage accounts for customer transfers."
				icon={Landmark}
				headerAction={
					<button
						type="button"
						onClick={() => setIsAdding(true)}
						className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs md:text-[13px] font-bold text-emerald-600 transition-colors hover:bg-emerald-50"
					>
						<Plus className="size-4" />
						Add Account
					</button>
				}
			>
				<div className="grid gap-3">
					{bankAccounts.length === 0 && !isAdding ? (
						<p className="text-sm text-slate-500 italic py-4 text-center">
							No bank accounts configured yet.
						</p>
					) : null}

					{bankAccounts.map((account) => (
						<div
							key={account.id}
							className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-colors hover:bg-slate-50 gap-4 sm:gap-0"
						>
							<div className="flex items-center gap-4">
								<div className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-100 font-bold text-emerald-700">
									{account.bankName.substring(0, 2).toUpperCase()}
								</div>
								<div>
									<p className="text-xs md:text-[13px] font-bold text-slate-950">
										{account.bankName}
									</p>
									<p className="text-xs font-medium text-slate-500">
										{account.accountNumber} <span className="mx-1">•</span>{" "}
										{account.accountName}
									</p>
								</div>
							</div>
							<div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
								<form action={toggleBankAccountStatusAction}>
									<input type="hidden" name="id" value={account.id} />
									<input type="hidden" name="slug" value={slug} />
									<input
										type="hidden"
										name="isActive"
										value={account.isActive ? "false" : "true"}
									/>
									<SubmitButton
										className={`rounded-md px-2.5 py-1 text-xs md:text-[11px] font-bold uppercase tracking-wide ${
											account.isActive
												? "bg-emerald-100 text-emerald-700"
												: "bg-slate-100 text-slate-500"
										}`}
									>
										{account.isActive ? "Active" : "Inactive"}
									</SubmitButton>
								</form>
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={() => setEditingAccount(account)}
										className="grid size-8 place-items-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
									>
										<Pencil className="size-4" />
									</button>
									<form action={deleteBankAccountAction}>
										<input type="hidden" name="id" value={account.id} />
										<input type="hidden" name="slug" value={slug} />
										<SubmitButton className="grid size-8 place-items-center rounded-full text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors">
											<Trash2 className="size-4" />
										</SubmitButton>
									</form>
								</div>
							</div>
						</div>
					))}
				</div>

				<div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
					<span className="text-sm font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer">
						View all accounts
					</span>
					<ArrowRight className="size-4 text-emerald-700" />
				</div>
			</SettingsCard>

			{(isAdding || editingAccount) && (
				<div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
					<form
						action={async (formData) => {
							await saveBankAccountAction(formData);
							setIsAdding(false);
							setEditingAccount(null);
						}}
						className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-200"
					>
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-sm md:text-lg font-black text-slate-950">
								{editingAccount ? "Edit Bank Account" : "Add Bank Account"}
							</h3>
							<button
								type="button"
								onClick={() => {
									setIsAdding(false);
									setEditingAccount(null);
								}}
								className="grid size-8 place-items-center rounded-full text-slate-400 hover:bg-slate-100"
							>
								<X className="size-5" />
							</button>
						</div>

						<input type="hidden" name="slug" value={slug} />
						{editingAccount && (
							<input type="hidden" name="id" value={editingAccount.id} />
						)}

						<div className="grid gap-4">
							<label className="grid gap-1 mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500">
								Bank Name
								<input
									name="bankName"
									required
									defaultValue={editingAccount?.bankName}
									placeholder="e.g. Guarantee Trust Bank"
									className="h-10 rounded-lg border border-slate-200 px-3 text-base md:text-[13px] font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-950 placeholder:text-slate-400 normal-case tracking-normal"
								/>
							</label>

							<label className="grid gap-1 mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500">
								Account Number
								<input
									name="accountNumber"
									required
									defaultValue={editingAccount?.accountNumber}
									placeholder="e.g. 0123456789"
									className="h-10 rounded-lg border border-slate-200 px-3 text-base md:text-[13px] font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-950 placeholder:text-slate-400 normal-case tracking-normal"
								/>
							</label>

							<label className="grid gap-1 mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500">
								Account Name
								<input
									name="accountName"
									required
									defaultValue={editingAccount?.accountName}
									placeholder="e.g. Awamenu Foods"
									className="h-10 rounded-lg border border-slate-200 px-3 text-base md:text-[13px] font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-950 placeholder:text-slate-400 normal-case tracking-normal"
								/>
							</label>
						</div>

						<SubmitButton className="mt-6 h-10 w-full rounded-lg bg-emerald-700 text-xs md:text-[13px] font-bold text-white hover:bg-emerald-800">
							Save Account
						</SubmitButton>
					</form>
				</div>
			)}
		</>
	);
}
