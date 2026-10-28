import { render } from "@react-email/components";
import type { ReactElement } from "react";

/**
 * HTML plus a readable plain-text part. Spam filters expect both, and some
 * clients (and watches) show only text, so the text version lays out the
 * label/value tables as columns instead of running the cells together.
 */
export async function renderEmail(element: ReactElement) {
	const [html, text] = await Promise.all([
		render(element),
		render(element, {
			plainText: true,
			htmlToTextOptions: {
				selectors: [
					{ selector: "h1", options: { uppercase: false } },
					{
						selector: "table.email-table",
						format: "dataTable",
						options: { uppercaseHeaderCells: false, maxColumnWidth: 60 },
					},
				],
			},
		}),
	]);
	return { html, text: text.trim() };
}
