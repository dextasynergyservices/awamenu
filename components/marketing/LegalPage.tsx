import Link from "next/link";
import { MarketingBottomNav } from "@/components/marketing/MarketingBottomNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { getLegalPage } from "@/lib/legal";
import type { LegalKind } from "@/lib/legal-defaults";
import {
	fillLegalTokens,
	formatEffectiveDate,
	LEGAL_PROSE_CLASS,
	renderLegalMarkdown,
} from "@/lib/legal-markdown";

/** The Privacy, Terms and Refund pages. Content is edited in Super Admin → Legal. */
export async function LegalPage({ kind }: { kind: LegalKind }) {
	const page = await getLegalPage(kind);

	return (
		<>
			<main className="min-h-screen bg-[#f6faf7] pt-2 pb-24 text-slate-950 md:pb-12">
				<MarketingHeader variant="light" />
				<article className="mx-auto max-w-3xl px-4 pt-6 sm:pt-10 lg:px-8">
					<p className="text-xs font-black uppercase tracking-widest text-emerald-700">
						Legal
					</p>
					<h1 className="mt-2 text-3xl font-black sm:text-4xl">{page.title}</h1>
					<p className="mt-2 text-sm font-semibold text-slate-500">
						Effective {formatEffectiveDate(page.effectiveDate)}
					</p>
					<p className="mt-5 text-base leading-7 text-slate-700">
						{fillLegalTokens(page.intro, page.company)}
					</p>
					<div className={`mt-8 ${LEGAL_PROSE_CLASS}`}>
						{renderLegalMarkdown(page.body, page.company)}
					</div>
					<p className="mt-12 border-slate-200 border-t pt-6 text-sm text-slate-500">
						See also our{" "}
						<Link href="/privacy" className="font-bold text-emerald-700">
							Privacy Policy
						</Link>
						,{" "}
						<Link href="/terms" className="font-bold text-emerald-700">
							Terms of Service
						</Link>{" "}
						and{" "}
						<Link href="/refunds" className="font-bold text-emerald-700">
							Refund Policy
						</Link>
						.
					</p>
				</article>
			</main>
			<MarketingFooter />
			<MarketingBottomNav />
		</>
	);
}
