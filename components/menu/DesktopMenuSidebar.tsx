"use client";

import { CalendarDays, Grid2X2, ShoppingBag, Utensils } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type DesktopMenuSidebarProps = {
	activeCategoryId: string;
	onSelectCategory: (categoryId: string) => void;
	categories: Array<{
		id: string;
		name: string;
	}>;
	restaurantSlug: string;
	tableReservationEnabled: boolean;
};

function getCategoryIcon(name: string) {
	const label = name.toLowerCase();
	if (label.includes("drink")) return ShoppingBag;
	if (label.includes("burger")) return Utensils;
	if (label.includes("dessert")) return ShoppingBag;
	if (label.includes("side")) return ShoppingBag;
	return Utensils;
}

export function DesktopMenuSidebar({
	activeCategoryId,
	onSelectCategory,
	categories,
	restaurantSlug,
	tableReservationEnabled,
}: DesktopMenuSidebarProps) {
	return (
		<aside className="sticky top-[76px] hidden max-h-[calc(100vh-88px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white px-4 py-5 md:block lg:px-5 lg:py-6 xl:px-8 xl:py-8">
			{tableReservationEnabled ? (
				<Link
					href={`/${restaurantSlug}/tables`}
					className="mb-5 flex min-h-12 items-center gap-3 rounded-xl bg-emerald-700 px-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(4,120,87,0.18)] xl:min-h-14 xl:gap-4 xl:px-4"
				>
					<CalendarDays className="size-5" aria-hidden="true" />
					Reserve table
				</Link>
			) : null}
			<p className="text-sm font-black tracking-[0.12em] text-slate-500">
				MENU
			</p>
			<nav className="mt-6 grid gap-2 xl:gap-3">
				<button
					type="button"
					onClick={() => onSelectCategory("all")}
					className={cn(
						"flex min-h-12 items-center gap-3 rounded-lg px-3 text-left text-sm font-black text-slate-700 xl:min-h-14 xl:gap-4 xl:px-4",
						activeCategoryId === "all" && "bg-emerald-50 text-emerald-800",
					)}
				>
					<Grid2X2 className="size-5" aria-hidden="true" />
					All Items
				</button>
				{categories.map((category) => {
					const Icon = getCategoryIcon(category.name);
					return (
						<button
							key={category.id}
							type="button"
							onClick={() => onSelectCategory(category.id)}
							className={cn(
								"flex min-h-12 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-slate-800 xl:min-h-14 xl:gap-4 xl:px-4",
								activeCategoryId === category.id &&
									"bg-emerald-50 font-black text-emerald-800",
							)}
						>
							<Icon className="size-5" aria-hidden="true" />
							{category.name}
						</button>
					);
				})}
			</nav>
		</aside>
	);
}
