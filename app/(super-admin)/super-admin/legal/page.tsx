import { ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { LegalCompanyForm } from "@/components/super-admin/LegalCompanyForm";
import { getLegalCompanySettings, getLegalPageUncached } from "@/lib/legal";
import { LEGAL_KINDS, LEGAL_PAGE_META } from "@/lib/legal-defaults";
import { formatEffectiveDate } from "@/lib/legal-markdown";

export default async function SuperAdminLegalPage() {
	const [company, pages] = await Promise.all([
		getLegalCompanySettings(),
		Promise.all(LEGAL_KINDS.map((kind) => getLegalPageUncached(kind))),
	]);
	const missing = [
		!company.companyName && "company name",
		!company.rcNumber && "RC number",
		!company.registeredAddress && "registered address",
	].filter(Boolean);

	return (
		<div className="grid max-w-3xl gap-6">
			<div>
				<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
					Legal pages
				</h1>
				<p className="mt-1 text-sm font-medium text-slate-600">
					The Privacy Policy, Terms of Service and Refund Policy shown to
					restaurants and customers. Have changes reviewed by a lawyer before
					publishing.
				</p>
			</div>

			<section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
				<div>
					<h2 className="text-lg font-black text-slate-950">Company details</h2>
					<p className="mt-1 text-sm font-medium text-slate-600">
						Filled into every page wherever a placeholder appears.
					</p>
				</div>
				{missing.length > 0 ? (
					<p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-bold text-amber-800">
						Not set yet: {missing.join(", ")}. The pages show a placeholder in
						square brackets until you add them.
					</p>
				) : null}
				<LegalCompanyForm values={company} />
			</section>

			<section className="grid gap-3">
				<h2 className="text-lg font-black text-slate-950">Pages</h2>
				{pages.map((page) => (
					<div
						key={page.kind}
						className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"
					>
						<div className="min-w-0 flex-1">
							<p className="font-black text-slate-950">{page.title}</p>
							<p className="mt-0.5 text-xs font-medium text-slate-500">
								Effective {formatEffectiveDate(page.effectiveDate)} ·{" "}
								{page.isDefault
									? "Built-in text"
									: `Edited${page.updatedByName ? ` by ${page.updatedByName}` : ""}${
											page.updatedAt
												? ` on ${new Date(page.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
												: ""
										}`}
							</p>
						</div>
						<a
							href={LEGAL_PAGE_META[page.kind].path}
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
						>
							View <ExternalLink className="size-3.5" aria-hidden="true" />
						</a>
						<Link
							href={`/super-admin/legal/${page.kind.toLowerCase()}`}
							className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white hover:bg-emerald-800"
						>
							Edit <ChevronRight className="size-3.5" aria-hidden="true" />
						</Link>
					</div>
				))}
			</section>
		</div>
	);
}
