"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setMenuItemSoldOutAction } from "@/actions/menu.actions";
import { MENU_TAGS } from "@/lib/menu-tags";
import { cn } from "@/lib/utils";

/**
 * Dietary tag checkboxes for an item form. Sends a "tagsField" marker so the
 * server knows this form manages tags (an empty selection then clears them).
 */
export function MenuTagPicker({ defaultTags }: { defaultTags: string[] }) {
	return (
		<fieldset className="grid gap-2">
			<legend className="mb-1 text-xs font-black text-slate-700">
				Dietary labels
			</legend>
			<input type="hidden" name="tagsField" value="1" />
			<div className="flex flex-wrap gap-2">
				{MENU_TAGS.map((tag) => (
					<label
						key={tag.key}
						className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 has-checked:border-emerald-600 has-checked:bg-emerald-50 has-checked:text-emerald-800"
					>
						<input
							type="checkbox"
							name="tags"
							value={tag.key}
							defaultChecked={defaultTags.includes(tag.key)}
							className="size-3.5 accent-emerald-700"
						/>
						{tag.label}
					</label>
				))}
			</div>
		</fieldset>
	);
}

/** One-tap "Sold out today" switch; clears itself at the start of tomorrow. */
export function SoldOutToggle({
	restaurantId,
	slug,
	itemId,
	soldOut,
	className,
}: {
	restaurantId: string;
	slug: string;
	itemId: string;
	soldOut: boolean;
	className?: string;
}) {
	const router = useRouter();
	const [pending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function toggle() {
		const fd = new FormData();
		fd.set("restaurantId", restaurantId);
		fd.set("slug", slug);
		fd.set("itemId", itemId);
		fd.set("soldOut", soldOut ? "off" : "today");
		setError(null);
		startTransition(async () => {
			const result = await setMenuItemSoldOutAction(fd);
			if (result && "error" in result) setError(result.error);
			else router.refresh();
		});
	}

	return (
		<span className={cn("inline-grid gap-1", className)}>
			<button
				type="button"
				onClick={toggle}
				disabled={pending}
				aria-pressed={soldOut}
				title={
					soldOut
						? "Back in stock: customers can order it again"
						: "Mark sold out until tomorrow"
				}
				className={cn(
					"inline-flex min-h-8 items-center justify-center rounded-lg px-2.5 text-xs font-black transition-colors disabled:opacity-50",
					soldOut
						? "bg-slate-900 text-white hover:bg-slate-700"
						: "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
				)}
			>
				{pending ? "Saving…" : soldOut ? "Sold out today" : "Mark sold out"}
			</button>
			{error ? (
				<span role="alert" className="text-[11px] font-bold text-red-600">
					{error}
				</span>
			) : null}
		</span>
	);
}
