"use client";

import { Building2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
	deleteBankAccountAction,
	saveBankAccountAction,
	toggleBankAccountStatusAction,
} from "@/actions/bank-accounts.actions";
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
		<div className="rounded-3xl border border-slate-100 bg-white p-5 md:p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
			<div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
				<div className="flex items-center gap-3">
					<div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
						<Building2 className="size-5" />
					</div>
					<div>
						<h2 className="text-xl font-black text-slate-950">Bank Accounts</h2>
						<p className="text-sm font-medium text-slate-500">
							Manage accounts for customer transfers.
						</p>
					</div>
				</div>
				<button
					type="button"
					onClick={() => setIsAdding(true)}
					className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-black text-white hover:bg-emerald-800"
				>
					<Plus className="size-4" />
					<span className="hidden sm:inline">Add Account</span>
				</button>
			</div>

			<div className="grid gap-3">
				{bankAccounts.length === 0 && !isAdding ? (
					<p className="text-sm text-slate-500 italic py-4 text-center">
						No bank accounts configured yet.
					</p>
				) : null}

				{bankAccounts.map((account) => (
					<div
						key={account.id}
						className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 transition-colors hover:bg-slate-50"
					>
						<div>
							<p className="font-black text-slate-950">{account.bankName}</p>
							<p className="text-sm font-medium text-slate-700">
								{account.accountNumber} - {account.accountName}
							</p>
						</div>
						<div className="flex items-center gap-2">
							<form action={toggleBankAccountStatusAction}>
								<input type="hidden" name="id" value={account.id} />
								<input type="hidden" name="slug" value={slug} />
								<input
									type="hidden"
									name="isActive"
									value={account.isActive ? "false" : "true"}
								/>
								<SubmitButton
									className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
										account.isActive
											? "bg-emerald-100 text-emerald-700"
											: "bg-slate-100 text-slate-500"
									}`}
								>
									{account.isActive ? "Active" : "Inactive"}
								</SubmitButton>
							</form>
							<button
								type="button"
								onClick={() => setEditingAccount(account)}
								className="grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
							>
								<Pencil className="size-4" />
							</button>
							<form action={deleteBankAccountAction}>
								<input type="hidden" name="id" value={account.id} />
								<input type="hidden" name="slug" value={slug} />
								<SubmitButton className="grid size-8 place-items-center rounded-lg border border-red-100 text-red-500 hover:bg-red-50">
									<Trash2 className="size-4" />
								</SubmitButton>
							</form>
						</div>
					</div>
				))}
			</div>

			{(isAdding || editingAccount) && (
				<div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
					<form
						action={async (formData) => {
							await saveBankAccountAction(formData);
							setIsAdding(false);
							setEditingAccount(null);
						}}
						className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl"
					>
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-lg font-black text-slate-950">
								{editingAccount ? "Edit Bank Account" : "Add Bank Account"}
							</h3>
							<button
								type="button"
								onClick={() => {
									setIsAdding(false);
									setEditingAccount(null);
								}}
								className="grid size-8 place-items-center rounded-xl text-slate-400 hover:bg-slate-100"
							>
								<X className="size-5" />
							</button>
						</div>

						<input type="hidden" name="slug" value={slug} />
						{editingAccount && (
							<input type="hidden" name="id" value={editingAccount.id} />
						)}

						<div className="grid gap-4">
							<label className="grid gap-1.5 text-sm font-bold text-slate-700">
								Bank Name
								<input
									name="bankName"
									required
									defaultValue={editingAccount?.bankName}
									placeholder="e.g. Guarantee Trust Bank"
									className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
								/>
							</label>

							<label className="grid gap-1.5 text-sm font-bold text-slate-700">
								Account Number
								<input
									name="accountNumber"
									required
									defaultValue={editingAccount?.accountNumber}
									placeholder="e.g. 0123456789"
									className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
								/>
							</label>

							<label className="grid gap-1.5 text-sm font-bold text-slate-700">
								Account Name
								<input
									name="accountName"
									required
									defaultValue={editingAccount?.accountName}
									placeholder="e.g. Awamenu Foods"
									className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
								/>
							</label>
						</div>

						<SubmitButton className="mt-6 h-11 w-full rounded-xl bg-emerald-700 text-sm font-black text-white hover:bg-emerald-800">
							Save Account
						</SubmitButton>
					</form>
				</div>
			)}
		</div>
	);
}
