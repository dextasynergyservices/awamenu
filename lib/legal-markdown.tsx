import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Renders the legal pages' limited Markdown. Shared by the public pages and
 * the super-admin editor's live preview, so what the admin sees is what
 * visitors get.
 *
 * Supported, deliberately small:
 *   ## Heading            (starts a new section)
 *   ### Subheading
 *   - list item           (consecutive lines form one list)
 *   **bold**   [text](https://… | /path | mailto:…)
 *   {{companyName}} etc.  (company details, see LEGAL_TOKENS)
 * Blank lines separate paragraphs. No raw HTML: everything is rendered as
 * React text, and links outside the allowed schemes render as plain text.
 */

export type LegalCompany = {
	companyName: string;
	rcNumber: string;
	registeredAddress: string;
	contactEmail: string;
	privacyEmail: string;
};

/** Shown while a detail hasn't been set, so a gap is obvious on the page. */
export const LEGAL_PLACEHOLDERS: LegalCompany = {
	companyName: "[Company legal name]",
	rcNumber: "[RC number]",
	registeredAddress: "[Registered office address]",
	contactEmail: "hello@awamenu.com",
	privacyEmail: "hello@awamenu.com",
};

/** The rendered body's styles, shared by the public pages and the editor preview. */
export const LEGAL_PROSE_CLASS =
	"grid gap-8 text-[15px] leading-7 text-slate-700 [&_h2]:text-xl [&_h2]:font-black [&_h2]:text-slate-950 [&_h3]:mt-2 [&_h3]:font-black [&_h3]:text-slate-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:grid [&_ul]:gap-1.5 [&_a]:font-bold [&_a]:text-emerald-700 [&_a]:underline";

export const LEGAL_TOKENS: { token: keyof LegalCompany; label: string }[] = [
	{ token: "companyName", label: "Company legal name" },
	{ token: "rcNumber", label: "RC number" },
	{ token: "registeredAddress", label: "Registered office address" },
	{ token: "contactEmail", label: "Contact email" },
	{ token: "privacyEmail", label: "Privacy email" },
];

export function fillLegalTokens(text: string, company: LegalCompany): string {
	return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
		key in company ? company[key as keyof LegalCompany] : match,
	);
}

/** "2026-10-26" → "26 October 2026", read as a calendar date (no timezone shift). */
export function formatEffectiveDate(isoDate: string): string {
	const date = new Date(`${isoDate}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) return isoDate;
	return date.toLocaleDateString("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});
}

function safeHref(url: string): string | null {
	if (url.startsWith("/") && !url.startsWith("//")) return url;
	if (/^(https?:\/\/|mailto:)/i.test(url)) return url;
	return null;
}

const INLINE = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
	const out: ReactNode[] = [];
	let last = 0;
	let i = 0;
	for (const match of text.matchAll(INLINE)) {
		const index = match.index ?? 0;
		if (index > last) out.push(text.slice(last, index));
		const key = `${keyPrefix}-${i++}`;
		if (match[1] !== undefined) {
			out.push(<strong key={key}>{renderInline(match[1], key)}</strong>);
		} else {
			const href = safeHref(match[3]);
			if (!href) out.push(match[2]);
			else if (href.startsWith("/"))
				out.push(
					<Link key={key} href={href}>
						{match[2]}
					</Link>,
				);
			else
				out.push(
					<a
						key={key}
						href={href}
						{...(href.startsWith("http")
							? { target: "_blank", rel: "noopener noreferrer" }
							: {})}
					>
						{match[2]}
					</a>,
				);
		}
		last = index + match[0].length;
	}
	if (last < text.length) out.push(text.slice(last));
	return out;
}

type Block =
	| { kind: "h2" | "h3" | "p"; text: string }
	| { kind: "ul"; items: string[] };

function parseBlocks(markdown: string): Block[] {
	const blocks: Block[] = [];
	let paragraph: string[] = [];
	let list: string[] | null = null;

	const flush = () => {
		if (paragraph.length) blocks.push({ kind: "p", text: paragraph.join(" ") });
		if (list) blocks.push({ kind: "ul", items: list });
		paragraph = [];
		list = null;
	};

	for (const raw of markdown.split(/\r?\n/)) {
		const line = raw.trim();
		if (!line) {
			flush();
		} else if (line.startsWith("### ")) {
			flush();
			blocks.push({ kind: "h3", text: line.slice(4) });
		} else if (line.startsWith("## ")) {
			flush();
			blocks.push({ kind: "h2", text: line.slice(3) });
		} else if (/^[-*] /.test(line)) {
			if (paragraph.length) {
				blocks.push({ kind: "p", text: paragraph.join(" ") });
				paragraph = [];
			}
			list ??= [];
			list.push(line.slice(2));
		} else if (list) {
			// A wrapped line continues the previous list item.
			list[list.length - 1] += ` ${line}`;
		} else {
			paragraph.push(line);
		}
	}
	flush();
	return blocks;
}

function renderBlock(block: Block, key: string): ReactNode {
	switch (block.kind) {
		case "h2":
			return <h2 key={key}>{renderInline(block.text, key)}</h2>;
		case "h3":
			return <h3 key={key}>{renderInline(block.text, key)}</h3>;
		case "p":
			return <p key={key}>{renderInline(block.text, key)}</p>;
		case "ul":
			return (
				<ul key={key}>
					{block.items.map((item, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static text, never reordered
						<li key={i}>{renderInline(item, `${key}-${i}`)}</li>
					))}
				</ul>
			);
	}
}

/** One <section> per "## " heading, matching the pages' spacing. */
export function renderLegalMarkdown(
	markdown: string,
	company: LegalCompany,
): ReactNode[] {
	const sections: Block[][] = [];
	for (const block of parseBlocks(fillLegalTokens(markdown, company))) {
		if (block.kind === "h2" || sections.length === 0) sections.push([]);
		sections[sections.length - 1].push(block);
	}
	return sections.map((blocks, s) => (
		// biome-ignore lint/suspicious/noArrayIndexKey: static text, never reordered
		<section key={s} className="grid gap-2">
			{blocks.map((block, b) => renderBlock(block, `${s}-${b}`))}
		</section>
	));
}
