import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/LegalPage";
import { LEGAL_PAGE_META } from "@/lib/legal-defaults";

export const metadata: Metadata = {
	title: `${LEGAL_PAGE_META.TERMS.title} | AwaMenu`,
	description: LEGAL_PAGE_META.TERMS.description,
};

// Edited in Super Admin → Legal; saving purges this page.
export const revalidate = 3600;

export default function TermsPage() {
	return <LegalPage kind="TERMS" />;
}
