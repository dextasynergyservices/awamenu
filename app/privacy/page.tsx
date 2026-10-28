import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/LegalPage";
import { LEGAL_PAGE_META } from "@/lib/legal-defaults";

export const metadata: Metadata = {
	title: `${LEGAL_PAGE_META.PRIVACY.title} | AwaMenu`,
	description: LEGAL_PAGE_META.PRIVACY.description,
};

// Edited in Super Admin → Legal; saving purges this page.
export const revalidate = 3600;

export default function PrivacyPage() {
	return <LegalPage kind="PRIVACY" />;
}
