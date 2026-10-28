import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LegalDocumentEditor } from "@/components/super-admin/LegalDocumentEditor";
import { getLegalPageUncached } from "@/lib/legal";
import { legalKindFromParam } from "@/lib/legal-defaults";

export default async function EditLegalPage({
	params,
}: {
	params: Promise<{ kind: string }>;
}) {
	const kind = legalKindFromParam((await params).kind);
	if (!kind) notFound();

	const page = await getLegalPageUncached(kind);

	return (
		<div className="grid gap-5">
			<div>
				<Link
					href="/super-admin/legal"
					className="inline-flex items-center gap-1.5 text-sm font-black text-slate-600 hover:text-slate-900"
				>
					<ArrowLeft className="size-4" aria-hidden="true" /> Legal pages
				</Link>
				<h1 className="mt-2 text-2xl font-black text-slate-950 md:text-3xl">
					{page.title}
				</h1>
				<p className="mt-1 text-sm font-medium text-slate-600">
					{page.isDefault
						? "Showing AwaMenu's built-in text. Publishing saves your version."
						: "Changes go live on the public page as soon as you publish."}
				</p>
			</div>

			{/* Remounts after a publish or reset, so the fields show what's live. */}
			<LegalDocumentEditor
				key={page.updatedAt ?? "default"}
				kind={kind}
				title={page.title}
				initial={{
					intro: page.intro,
					body: page.body,
					effectiveDate: page.effectiveDate,
				}}
				company={page.company}
				isDefault={page.isDefault}
			/>
		</div>
	);
}
