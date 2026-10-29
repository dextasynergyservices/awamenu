"use client";

import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { useId, useRef, useState } from "react";
import { uploadImage } from "@/lib/image-upload";

const MAX_BYTES = 2 * 1024 * 1024;

/**
 * Picks and uploads the platform logo, then submits its URL with the
 * settings form (hidden `logoUrl`). PNG with a transparent background works
 * best: it's shown on white in the dashboard header and in emails.
 */
export function PlatformLogoField({
	initialUrl,
}: {
	initialUrl: string | null;
}) {
	const [url, setUrl] = useState(initialUrl ?? "");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const id = useId();

	async function upload(file: File) {
		setError(null);
		setBusy(true);
		try {
			const secureUrl = await uploadImage(
				{ platform: true, kind: "logo" },
				file,
				{
					maxBytes: MAX_BYTES,
				},
			);
			// PNG keeps transparency (WebP would too, but email clients vary).
			setUrl(secureUrl.replace("/upload/", "/upload/q_auto/"));
		} catch (e) {
			setError(
				e instanceof Error ? e.message : "The upload failed. Try again.",
			);
		} finally {
			setBusy(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	}

	return (
		<div className="grid gap-2">
			<span className="mb-1 block text-xs font-bold tracking-wide text-slate-500 uppercase">
				Logo
			</span>
			<input type="hidden" name="logoUrl" value={url} />
			<div className="flex flex-wrap items-center gap-3">
				<div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-[conic-gradient(#f1f5f9_25%,#fff_0_50%,#f1f5f9_0_75%,#fff_0)] bg-[length:12px_12px]">
					{url ? (
						// biome-ignore lint/performance/noImgElement: preview of a just-uploaded remote image
						<img
							src={url}
							alt="Platform logo"
							className="max-h-14 max-w-14 object-contain"
						/>
					) : (
						<ImageUp className="size-6 text-slate-400" aria-hidden="true" />
					)}
				</div>
				<div className="flex flex-wrap gap-2">
					<label
						htmlFor={id}
						className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
					>
						{busy ? (
							<Loader2 className="size-4 animate-spin" aria-hidden="true" />
						) : (
							<ImageUp className="size-4" aria-hidden="true" />
						)}
						{url ? "Replace" : "Upload logo"}
					</label>
					<input
						ref={inputRef}
						id={id}
						type="file"
						accept="image/png,image/jpeg,image/webp"
						className="sr-only"
						disabled={busy}
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) void upload(file);
						}}
					/>
					{url ? (
						<button
							type="button"
							onClick={() => setUrl("")}
							className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-bold text-red-600 hover:bg-red-50"
						>
							<Trash2 className="size-4" aria-hidden="true" />
							Remove
						</button>
					) : null}
				</div>
			</div>
			<p className="text-xs font-medium text-slate-500">
				PNG with a transparent background, at least 256 px tall, under 2 MB.
				Used in the dashboard header and AwaMenu&apos;s emails. Save settings to
				apply.
			</p>
			{error ? (
				<p role="alert" className="text-xs font-bold text-red-600">
					{error}
				</p>
			) : null}
		</div>
	);
}
