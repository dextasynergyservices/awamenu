"use client";

import { ChevronLeft, ChevronRight, Utensils } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CategoryNav } from "@/components/menu/CategoryNav";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { MenuItemCompactRow } from "@/components/menu/MenuItemCompactRow";
import { MenuItemGridCard } from "@/components/menu/MenuItemGridCard";
import { MenuItemMagazineCard } from "@/components/menu/MenuItemMagazineCard";
import { MenuSearchInput } from "@/components/menu/MenuSearchInput";
import { matchesMenuSearch, type PublicMenuItem } from "@/lib/menu-tags";

type PublicMenuCategory = {
	id: string;
	name: string;
	emoji: string | null;
	items: PublicMenuItem[];
};

export type MenuGridTemplate = "classic" | "grid" | "compact" | "magazine";

type PublicMenuContentProps = {
	categories: PublicMenuCategory[];
	restaurantSlug: string;
	currency: string;
	template?: MenuGridTemplate;
};

const itemsWrapperClass: Record<MenuGridTemplate, string> = {
	classic: "grid gap-5",
	grid: "grid grid-cols-2 gap-3 sm:grid-cols-3",
	compact: "grid",
	magazine: "grid gap-5",
};

const INITIAL_VISIBLE_ITEMS = 8;
const LOAD_MORE_ITEMS = 6;
const MOBILE_PAGE_SIZE = 8;

const templateComponents = {
	classic: MenuItemCard,
	grid: MenuItemGridCard,
	compact: MenuItemCompactRow,
	magazine: MenuItemMagazineCard,
};

export function PublicMenuContent({
	categories,
	restaurantSlug,
	currency,
	template = "classic",
}: PublicMenuContentProps) {
	const ItemComponent = templateComponents[template] ?? MenuItemCard;
	const wrapperClass = itemsWrapperClass[template] ?? itemsWrapperClass.classic;
	const [activeCategoryId, setActiveCategoryId] = useState("all");
	const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ITEMS);
	const [mobilePage, setMobilePage] = useState(0);
	const loadMoreRef = useRef<HTMLDivElement | null>(null);
	const [query, setQuery] = useState("");
	const searching = query.trim().length > 0;
	// A search looks across the whole menu, whichever category is selected.
	const visibleCategories = useMemo(
		() =>
			searching
				? categories
						.map((category) => ({
							...category,
							items: category.items.filter((item) =>
								matchesMenuSearch(item, query),
							),
						}))
						.filter((category) => category.items.length > 0)
				: activeCategoryId === "all"
					? categories
					: categories.filter((category) => category.id === activeCategoryId),
		[activeCategoryId, categories, query, searching],
	);

	function handleSearch(value: string) {
		setQuery(value);
		setVisibleCount(INITIAL_VISIBLE_ITEMS);
		setMobilePage(0);
	}
	const totalVisibleItems = visibleCategories.reduce(
		(total, category) => total + category.items.length,
		0,
	);

	// Desktop: progressive reveal via IntersectionObserver
	const renderedCategories = useMemo(
		() =>
			visibleCategories
				.map((category, index) => {
					const previousItemsCount = visibleCategories
						.slice(0, index)
						.reduce((total, entry) => total + entry.items.length, 0);
					const items = category.items.slice(
						0,
						Math.max(visibleCount - previousItemsCount, 0),
					);

					return { ...category, items };
				})
				.filter((category) => category.items.length > 0),
		[visibleCategories, visibleCount],
	);

	// Mobile: paginated categories with sliced items
	const mobileTotalPages = Math.max(
		1,
		Math.ceil(totalVisibleItems / MOBILE_PAGE_SIZE),
	);
	const mobileRenderedCategories = useMemo(() => {
		const start = mobilePage * MOBILE_PAGE_SIZE;
		const end = start + MOBILE_PAGE_SIZE;

		return visibleCategories.reduce(
			(acc, category) => {
				const catStart = acc.cursor;
				const catEnd = acc.cursor + category.items.length;

				if (catEnd > start && catStart < end) {
					const sliceStart = Math.max(start - catStart, 0);
					const sliceEnd = Math.min(end - catStart, category.items.length);
					const items = category.items.slice(sliceStart, sliceEnd);
					if (items.length > 0) {
						acc.result.push({ ...category, items });
					}
				}

				acc.cursor = catEnd;
				return acc;
			},
			{
				cursor: 0,
				result: [] as Array<
					PublicMenuCategory & { items: PublicMenuCategory["items"] }
				>,
			},
		).result;
	}, [visibleCategories, mobilePage]);

	function handleSelectCategory(categoryId: string) {
		setActiveCategoryId(categoryId);
		setVisibleCount(INITIAL_VISIBLE_ITEMS);
		setMobilePage(0);
	}

	useEffect(() => {
		const target = loadMoreRef.current;
		if (!target) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					setVisibleCount((current) =>
						Math.min(current + LOAD_MORE_ITEMS, totalVisibleItems),
					);
				}
			},
			{ rootMargin: "240px" },
		);

		observer.observe(target);
		return () => observer.disconnect();
	}, [totalVisibleItems]);

	return (
		<>
			{categories.length > 0 ? (
				<div className="mx-auto max-w-5xl px-4 pt-3 md:px-6">
					<MenuSearchInput value={query} onChange={handleSearch} />
					{searching ? (
						<p
							className="mt-2 text-xs font-semibold text-slate-500"
							aria-live="polite"
						>
							{totalVisibleItems} dish{totalVisibleItems === 1 ? "" : "es"}{" "}
							match
							{totalVisibleItems === 1 ? "es" : ""} &ldquo;{query.trim()}&rdquo;
						</p>
					) : null}
				</div>
			) : null}
			{searching ? null : (
				<CategoryNav
					activeCategoryId={activeCategoryId}
					onSelectCategory={handleSelectCategory}
					categories={categories}
				/>
			)}

			{/* Desktop: infinite scroll */}
			<div
				id="all-items"
				className="mx-auto hidden max-w-5xl gap-8 px-4 py-5 pb-32 md:grid md:px-6 md:py-8"
			>
				{categories.length > 0 ? (
					renderedCategories.length > 0 ? (
						renderedCategories.map((category) => (
							<section
								key={category.id}
								id={`category-${category.id}`}
								className="scroll-mt-24"
							>
								<div className="mb-4">
									<h2 className="text-xl font-semibold text-slate-950">
										{category.name}
									</h2>
								</div>
								<div className={wrapperClass}>
									{category.items.map((item) => (
										<ItemComponent
											key={item.id}
											item={item}
											restaurantSlug={restaurantSlug}
											currency={currency}
										/>
									))}
								</div>
							</section>
						))
					) : (
						<div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-base font-semibold text-slate-500">
							<Utensils
								className="mx-auto mb-3 size-10 text-slate-300"
								aria-hidden="true"
							/>
							<p>
								{searching
									? `No dishes match “${query.trim()}”.`
									: "No available items in this category."}
							</p>
							<p className="mt-2 font-medium">
								{searching ? "Try a different word." : "Check back soon!"}
							</p>
						</div>
					)
				) : (
					<div className="rounded-3xl border border-dashed border-emerald-100 bg-white p-8 text-center">
						<p className="text-lg font-semibold text-slate-950">
							Menu is coming soon
						</p>
					</div>
				)}

				{visibleCount < totalVisibleItems ? (
					<div ref={loadMoreRef} className="h-10" aria-hidden="true" />
				) : null}
			</div>

			{/* Mobile: paginated */}
			<div className="mx-auto grid max-w-5xl gap-8 px-4 py-5 pb-32 md:hidden">
				{categories.length > 0 ? (
					mobileRenderedCategories.length > 0 ? (
						<>
							{mobileRenderedCategories.map((category) => (
								<section
									key={category.id}
									id={`category-mobile-${category.id}`}
									className="scroll-mt-24"
								>
									<div className="mb-4">
										<h2 className="text-sm font-bold text-slate-950">
											{category.name}
										</h2>
									</div>
									<div className={wrapperClass}>
										{category.items.map((item) => (
											<ItemComponent
												key={item.id}
												item={item}
												restaurantSlug={restaurantSlug}
												currency={currency}
											/>
										))}
									</div>
								</section>
							))}

							{/* Mobile pagination controls */}
							{mobileTotalPages > 1 ? (
								<div className="flex items-center justify-between gap-3 pt-2">
									<button
										type="button"
										onClick={() => setMobilePage((p) => Math.max(0, p - 1))}
										disabled={mobilePage === 0}
										className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 disabled:opacity-40"
									>
										<ChevronLeft className="size-3.5" aria-hidden="true" />
										Previous
									</button>
									<p className="text-xs font-semibold text-slate-500">
										Page {mobilePage + 1} of {mobileTotalPages}
									</p>
									<button
										type="button"
										onClick={() =>
											setMobilePage((p) =>
												Math.min(mobileTotalPages - 1, p + 1),
											)
										}
										disabled={mobilePage >= mobileTotalPages - 1}
										className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-700 disabled:opacity-40"
									>
										Next
										<ChevronRight className="size-3.5" aria-hidden="true" />
									</button>
								</div>
							) : null}
						</>
					) : (
						<div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs font-semibold text-slate-500">
							<Utensils
								className="mx-auto mb-3 size-10 text-slate-300"
								aria-hidden="true"
							/>
							<p>
								{searching
									? `No dishes match “${query.trim()}”.`
									: "No available items in this category."}
							</p>
							<p className="mt-2 font-medium">
								{searching ? "Try a different word." : "Check back soon!"}
							</p>
						</div>
					)
				) : (
					<div className="rounded-3xl border border-dashed border-emerald-100 bg-white p-8 text-center">
						<p className="text-sm font-semibold text-slate-950">
							Menu is coming soon
						</p>
					</div>
				)}
			</div>
		</>
	);
}
