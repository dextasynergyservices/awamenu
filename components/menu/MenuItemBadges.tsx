import { Sparkles } from "lucide-react";
import { MENU_TAGS, type PublicMenuItem } from "@/lib/menu-tags";
import { cn } from "@/lib/utils";

/** "Today's special" plus dietary tags, as small chips under a dish name. */
export function MenuItemBadges({
	item,
	className,
	maxTags = 3,
}: {
	item: Pick<PublicMenuItem, "isTodaySpecial" | "tags">;
	className?: string;
	maxTags?: number;
}) {
	const tags = MENU_TAGS.filter((tag) => item.tags.includes(tag.key));
	if (!item.isTodaySpecial && tags.length === 0) return null;
	const shown = tags.slice(0, maxTags);
	const hidden = tags.length - shown.length;
	return (
		<span className={cn("flex flex-wrap items-center gap-1", className)}>
			{item.isTodaySpecial ? (
				<span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
					<Sparkles className="size-3" aria-hidden="true" />
					Today&apos;s special
				</span>
			) : null}
			{shown.map((tag) => (
				<span
					key={tag.key}
					className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700"
				>
					{tag.label}
				</span>
			))}
			{hidden > 0 ? (
				<span className="text-[11px] font-bold text-slate-500">+{hidden}</span>
			) : null}
		</span>
	);
}

/** Replaces the add button on a sold-out dish. */
export function SoldOutPill({ className }: { className?: string }) {
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center rounded-full bg-slate-900/85 px-2.5 py-1 text-[11px] font-black uppercase tracking-wide text-white",
				className,
			)}
		>
			Sold out
		</span>
	);
}
