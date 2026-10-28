"use client";

import { Download } from "lucide-react";

/** Print / "Save as PDF" via the browser's print dialog. */
export function PrintButton({ label = "Print" }: { label?: string }) {
	return (
		<button
			type="button"
			onClick={() => window.print()}
			className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"
		>
			<Download className="size-3.5" aria-hidden="true" />
			{label}
		</button>
	);
}
