"use client";

import { Eye, PencilLine } from "lucide-react";
import { useState } from "react";
import {
	resetLegalDocumentAction,
	updateLegalDocumentAction,
} from "@/actions/super-admin.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { ConfirmForm } from "@/components/ui/confirm-form";
import type { LegalKind } from "@/lib/legal-defaults";
import {
	fillLegalTokens,
	formatEffectiveDate,
	LEGAL_PROSE_CLASS,
	LEGAL_TOKENS,
	type LegalCompany,
	renderLegalMarkdown,
} from "@/lib/legal-markdown";
import { cn } from "@/lib/utils";

const fieldClass =
	"w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-950 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";

/**
 * Edit one legal page with a live preview, rendered by the same code as the
 * public page. On small screens Edit and Preview are tabs; on wide screens
 * they sit side by side.
 */
export function LegalDocumentEditor({
	kind,
	title,
	initial,
	company,
	isDefault,
}: {
	kind: LegalKind;
	title: string;
	initial: { intro: string; body: string; effectiveDate: string };
	company: LegalCompany;
	isDefault: boolean;
}) {
	const [intro, setIntro] = useState(initial.intro);
	const [body, setBody] = useState(initial.body);
	const [effectiveDate, setEffectiveDate] = useState(initial.effectiveDate);
	const [tab, setTab] = useState<"edit" | "preview">("edit");
	const today = new Date().toISOString().slice(0, 10);
	const changed =
		intro !== initial.intro ||
		body !== initial.body ||
		effectiveDate !== initial.effectiveDate;

	return (
		<div className="grid gap-4">
			<div className="flex gap-2 lg:hidden">
				{(["edit", "preview"] as const).map((value) => (
					<button
						key={value}
						type="button"
						onClick={() => setTab(value)}
						className={cn(
							"inline-flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-black",
							tab === value
								? "border-emerald-700 bg-emerald-700 text-white"
								: "border-slate-200 bg-white text-slate-700",
						)}
					>
						{value === "edit" ? (
							<PencilLine className="size-4" aria-hidden="true" />
						) : (
							<Eye className="size-4" aria-hidden="true" />
						)}
						{value === "edit" ? "Edit" : "Preview"}
					</button>
				))}
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<ActionForm
					action={updateLegalDocumentAction}
					className={cn(
						"grid content-start gap-4",
						tab !== "edit" && "hidden lg:grid",
					)}
				>
					<input type="hidden" name="kind" value={kind} />
					<label className="grid gap-1.5">
						<span className="text-sm font-black text-slate-900">
							Effective date
						</span>
						<div className="flex flex-wrap items-center gap-2">
							<input
								type="date"
								name="effectiveDate"
								value={effectiveDate}
								onChange={(e) => setEffectiveDate(e.target.value)}
								required
								className={cn(fieldClass, "w-auto")}
							/>
							{effectiveDate !== today ? (
								<button
									type="button"
									onClick={() => setEffectiveDate(today)}
									className="rounded-lg px-2 py-1 text-xs font-black text-emerald-700 hover:bg-emerald-50"
								>
									Set to today
								</button>
							) : null}
						</div>
						<span className="text-xs font-medium text-slate-500">
							Change it when the wording changes in a way that matters to
							readers.
						</span>
					</label>

					<label className="grid gap-1.5">
						<span className="text-sm font-black text-slate-900">
							Introduction
						</span>
						<textarea
							name="intro"
							value={intro}
							onChange={(e) => setIntro(e.target.value)}
							rows={4}
							maxLength={2000}
							required
							className={fieldClass}
						/>
					</label>

					<label className="grid gap-1.5">
						<span className="text-sm font-black text-slate-900">Page text</span>
						<textarea
							name="body"
							value={body}
							onChange={(e) => setBody(e.target.value)}
							rows={28}
							maxLength={60_000}
							required
							spellCheck
							className={cn(fieldClass, "font-mono text-[13px] leading-6")}
						/>
					</label>

					<details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-600">
						<summary className="cursor-pointer font-black text-slate-800">
							Formatting help
						</summary>
						<ul className="mt-2 grid gap-1 font-mono">
							<li>## Heading (starts a new section)</li>
							<li>### Subheading</li>
							<li>- List item</li>
							<li>**bold text**</li>
							<li>
								[link text](/refunds) or [email](mailto:hello@awamenu.com)
							</li>
							<li>A blank line starts a new paragraph.</li>
						</ul>
						<p className="mt-2">
							Company details:{" "}
							{LEGAL_TOKENS.map(({ token }) => `{{${token}}}`).join(", ")}
						</p>
					</details>

					<div className="flex flex-wrap items-center gap-3">
						<SubmitButton
							disabled={!changed}
							loadingText="Publishing..."
							successText="Published"
							className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-50"
						>
							Publish changes
						</SubmitButton>
						{changed ? (
							<button
								type="button"
								onClick={() => {
									setIntro(initial.intro);
									setBody(initial.body);
									setEffectiveDate(initial.effectiveDate);
								}}
								className="text-sm font-black text-slate-600 hover:text-slate-900"
							>
								Discard edits
							</button>
						) : null}
					</div>
				</ActionForm>

				<article
					className={cn(
						"rounded-2xl border border-slate-200 bg-[#f6faf7] p-5 sm:p-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto",
						tab !== "preview" && "hidden lg:block",
					)}
				>
					<p className="text-xs font-black uppercase tracking-widest text-emerald-700">
						Preview
					</p>
					<h2 className="mt-2 text-2xl font-black text-slate-950">{title}</h2>
					<p className="mt-1 text-sm font-semibold text-slate-500">
						Effective {formatEffectiveDate(effectiveDate)}
					</p>
					<p className="mt-4 text-base leading-7 text-slate-700">
						{fillLegalTokens(intro, company)}
					</p>
					<div className={`mt-6 ${LEGAL_PROSE_CLASS}`}>
						{renderLegalMarkdown(body, company)}
					</div>
				</article>
			</div>

			{!isDefault ? (
				<ConfirmForm
					action={resetLegalDocumentAction}
					hiddenFields={{ kind }}
					confirmMessage={`Replace the ${title} with AwaMenu's built-in text? Your edited version will be deleted.`}
					className="border-slate-200 border-t pt-4"
				>
					<button
						type="submit"
						className="text-sm font-black text-red-600 hover:text-red-700"
					>
						Restore built-in text
					</button>
				</ConfirmForm>
			) : null}
		</div>
	);
}
