"use client";

import { Grid2X2 } from "lucide-react";
import { cn } from "@/lib/utils";

type CategoryNavProps = {
	activeCategoryId: string;
	onSelectCategory: (categoryId: string) => void;
	categories: Array<{
		id: string;
		name: string;
		emoji: string | null;
	}>;
};

export function CategoryNav({
	activeCategoryId,
	onSelectCategory,
	categories,
}: CategoryNavProps) {
	return (
		<nav className="sticky top-0 z-20 border-emerald-100 border-b bg-white/95 px-2 md:px-4 md:py-3 backdrop-blur md:top-0">
			<div className="mx-auto flex max-w-5xl gap-2 overflow-x-auto">
				<button
					type="button"
					onClick={() => onSelectCategory("all")}
					className={cn(
						"inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl mb-2 px-4 text-xs font-semibold text-slate-500 transition-colors md:min-h-12 md:px-5 md:text-base",
						activeCategoryId === "all"
							? "bg-emerald-800 text-white shadow-[0_12px_26px_rgba(6,95,70,0.2)]"
							: "bg-white",
					)}
				>
					<Grid2X2 className="size-3.5 md:size-5" aria-hidden="true" />
					<span>All Items</span>
				</button>
				{categories.map((category) => (
					<button
						key={category.id}
						type="button"
						onClick={() => onSelectCategory(category.id)}
						className={cn(
							"inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl mb-2 px-4 text-xs font-semibold text-slate-500 transition-colors md:min-h-12 md:px-5 md:text-base",
							activeCategoryId === category.id &&
								"bg-emerald-800 text-white shadow-[0_12px_26px_rgba(6,95,70,0.2)]",
						)}
					>
						<span>{category.name}</span>
					</button>
				))}
			</div>
		</nav>
	);
}
