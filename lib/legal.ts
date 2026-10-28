import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import {
	DEFAULT_EFFECTIVE_DATE,
	LEGAL_DEFAULTS,
	LEGAL_KINDS,
	LEGAL_PAGE_META,
	type LegalKind,
} from "@/lib/legal-defaults";
import { LEGAL_PLACEHOLDERS, type LegalCompany } from "@/lib/legal-markdown";

/**
 * The legal pages' content: company details from PlatformSetting and each
 * page's text from LegalDocument, both edited in Super Admin → Legal.
 * Missing values fall back to placeholders and the built-in text.
 *
 * Cached for every visitor and purged on save (`revalidateLegalPages`).
 */

const LEGAL_TAG = "legal";

export type LegalPageContent = {
	kind: LegalKind;
	title: string;
	intro: string;
	body: string;
	/** YYYY-MM-DD */
	effectiveDate: string;
	isDefault: boolean;
	updatedAt: string | null;
	updatedByName: string | null;
	company: LegalCompany;
};

function orPlaceholder(value: string | null | undefined, fallback: string) {
	return value?.trim() ? value.trim() : fallback;
}

async function loadCompany(): Promise<LegalCompany> {
	const settings = await db.platformSetting.findFirst({
		select: {
			legalCompanyName: true,
			legalRcNumber: true,
			legalAddress: true,
			legalContactEmail: true,
			legalPrivacyEmail: true,
		},
	});
	return {
		companyName: orPlaceholder(
			settings?.legalCompanyName,
			LEGAL_PLACEHOLDERS.companyName,
		),
		rcNumber: orPlaceholder(
			settings?.legalRcNumber,
			LEGAL_PLACEHOLDERS.rcNumber,
		),
		registeredAddress: orPlaceholder(
			settings?.legalAddress,
			LEGAL_PLACEHOLDERS.registeredAddress,
		),
		contactEmail: orPlaceholder(
			settings?.legalContactEmail,
			LEGAL_PLACEHOLDERS.contactEmail,
		),
		privacyEmail: orPlaceholder(
			settings?.legalPrivacyEmail,
			LEGAL_PLACEHOLDERS.privacyEmail,
		),
	};
}

async function loadPage(kind: LegalKind): Promise<LegalPageContent> {
	const [company, doc] = await Promise.all([
		loadCompany(),
		db.legalDocument.findUnique({ where: { kind } }),
	]);
	const defaults = LEGAL_DEFAULTS[kind];
	return {
		kind,
		title: LEGAL_PAGE_META[kind].title,
		intro: doc?.intro ?? defaults.intro,
		body: doc?.body ?? defaults.body,
		effectiveDate: doc
			? doc.effectiveDate.toISOString().slice(0, 10)
			: DEFAULT_EFFECTIVE_DATE,
		isDefault: !doc,
		updatedAt: doc?.updatedAt.toISOString() ?? null,
		updatedByName: doc?.updatedByName ?? null,
		company,
	};
}

/** For the public pages: cached, and never fails. A legal page must render. */
export async function getLegalPage(kind: LegalKind): Promise<LegalPageContent> {
	try {
		return await unstable_cache(() => loadPage(kind), ["legal-page", kind], {
			tags: [LEGAL_TAG],
			revalidate: 3600,
		})();
	} catch (error) {
		// Errors aren't cached, so the next request tries the database again.
		console.error("[legal] falling back to the built-in text", error);
		return {
			kind,
			title: LEGAL_PAGE_META[kind].title,
			...LEGAL_DEFAULTS[kind],
			effectiveDate: DEFAULT_EFFECTIVE_DATE,
			isDefault: true,
			updatedAt: null,
			updatedByName: null,
			company: LEGAL_PLACEHOLDERS,
		};
	}
}

/** For the super-admin editor: always fresh. */
export const getLegalPageUncached = loadPage;

/** Raw stored company details (no placeholders), for the edit form. */
export async function getLegalCompanySettings() {
	const settings = await db.platformSetting.findFirst({
		select: {
			legalCompanyName: true,
			legalRcNumber: true,
			legalAddress: true,
			legalContactEmail: true,
			legalPrivacyEmail: true,
		},
	});
	return {
		companyName: settings?.legalCompanyName ?? "",
		rcNumber: settings?.legalRcNumber ?? "",
		registeredAddress: settings?.legalAddress ?? "",
		contactEmail: settings?.legalContactEmail ?? "",
		privacyEmail: settings?.legalPrivacyEmail ?? "",
	};
}

export function revalidateLegalPages() {
	revalidateTag(LEGAL_TAG, { expire: 0 });
	for (const kind of LEGAL_KINDS) revalidatePath(LEGAL_PAGE_META[kind].path);
}
