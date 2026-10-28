"use client";

import { updateLegalCompanyAction } from "@/actions/super-admin.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { LEGAL_PLACEHOLDERS, LEGAL_TOKENS } from "@/lib/legal-markdown";

type Values = {
	companyName: string;
	rcNumber: string;
	registeredAddress: string;
	contactEmail: string;
	privacyEmail: string;
};

/** Company details that fill the {{placeholders}} on every legal page. */
export function LegalCompanyForm({ values }: { values: Values }) {
	return (
		<ActionForm action={updateLegalCompanyAction} className="grid gap-4">
			<div className="grid gap-4 sm:grid-cols-2">
				{LEGAL_TOKENS.map(({ token, label }) => (
					<label
						key={token}
						className={`grid gap-1.5 ${token === "registeredAddress" ? "sm:col-span-2" : ""}`}
					>
						<span className="text-sm font-black text-slate-900">{label}</span>
						<input
							name={token}
							type={token.endsWith("Email") ? "email" : "text"}
							defaultValue={values[token]}
							placeholder={LEGAL_PLACEHOLDERS[token]}
							maxLength={token === "registeredAddress" ? 300 : 200}
							className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
						/>
						<span className="text-xs font-medium text-slate-500">
							Use <code className="font-bold">{`{{${token}}}`}</code> in a page
						</span>
					</label>
				))}
			</div>
			<SubmitButton
				loadingText="Saving..."
				successText="Saved"
				className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800 sm:justify-self-start"
			>
				Save company details
			</SubmitButton>
		</ActionForm>
	);
}
