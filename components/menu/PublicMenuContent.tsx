"use client";

import { ChevronLeft, ChevronRight, Utensils } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CategoryNav } from "@/components/menu/CategoryNav";
import { MenuItemCard } from "@/components/menu/MenuItemCard";

type PublicMenuCategory = {
	id: string;
	name: string;
	emoji: string | null;
	items: Array<{
		id: string;
		name: string;
		description: string | null;
		price: number;
		imageUrl: string | null;
	}>;
};

type PublicMenuContentProps = {
	categories: PublicMenuCategory[];
	restaurantSlug: string;
	currency: string;
};

const INITIAL_VISIBLE_ITEMS = 8;
const LOAD_MORE_ITEMS = 6;
const MOBILE_PAGE_SIZE = 8;

export function PublicMenuContent({
	categories,
	restaurantSlug,
	currency,
}: PublicMenuContentProps) {
	const [activeCategoryId, setActiveCategoryId] = useState("all");
	const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ITEMS);
	const [mobilePage, setMobilePage] = useState(0);
	const loadMoreRef = useRef<HTMLDivElement | null>(null);
	const visibleCategories = useMemo(
		() =>
			activeCategoryId === "all"
				? categories
				: categories.filter((category) => category.id === activeCategoryId),
		[activeCategoryId, categories],
	);
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
		let cursor = 0;

		return visibleCategories
			.map((category) => {
				const catStart = cursor;
				const catEnd = cursor + category.items.length;
				cursor = catEnd;

				if (catEnd <= start || catStart >= end) {
					return { ...category, items: [] };
				}

				const sliceStart = Math.max(start - catStart, 0);
				const sliceEnd = Math.min(end - catStart, category.items.length);
				return {
					...category,
					items: category.items.slice(sliceStart, sliceEnd),
				};
			})
			.filter((category) => category.items.length > 0);
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
			<CategoryNav
				activeCategoryId={activeCategoryId}
				onSelectCategory={handleSelectCategory}
				categories={categories}
			/>

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
								<div className="grid gap-5">
									{category.items.map((item) => (
										<MenuItemCard
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
							<p>No available items in this category.</p>
							<p className="mt-2 font-medium">Check back soon!</p>
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
										<h2 className="text-xl font-semibold text-slate-950">
											{category.name}
										</h2>
									</div>
									<div className="grid gap-5">
										{category.items.map((item) => (
											<MenuItemCard
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
										className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-700 disabled:opacity-40"
									>
										<ChevronLeft className="size-4" aria-hidden="true" />
										Previous
									</button>
									<p className="text-sm font-semibold text-slate-500">
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
										className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-bold text-slate-700 disabled:opacity-40"
									>
										Next
										<ChevronRight className="size-4" aria-hidden="true" />
									</button>
								</div>
							) : null}
						</>
					) : (
						<div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-base font-semibold text-slate-500">
							<Utensils
								className="mx-auto mb-3 size-10 text-slate-300"
								aria-hidden="true"
							/>
							<p>No available items in this category.</p>
							<p className="mt-2 font-medium">Check back soon!</p>
						</div>
					)
				) : (
					<div className="rounded-3xl border border-dashed border-emerald-100 bg-white p-8 text-center">
						<p className="text-lg font-semibold text-slate-950">
							Menu is coming soon
						</p>
					</div>
				)}
			</div>
		</>
	);
}
