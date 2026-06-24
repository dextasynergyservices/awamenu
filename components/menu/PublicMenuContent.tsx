"use client";

import { Utensils } from "lucide-react";
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

export function PublicMenuContent({
	categories,
	restaurantSlug,
	currency,
}: PublicMenuContentProps) {
	const [activeCategoryId, setActiveCategoryId] = useState("all");
	const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_ITEMS);
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

	function handleSelectCategory(categoryId: string) {
		setActiveCategoryId(categoryId);
		setVisibleCount(INITIAL_VISIBLE_ITEMS);
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

			<div
				id="all-items"
				className="mx-auto grid max-w-5xl gap-8 px-4 py-5 pb-32 md:px-6 md:py-8"
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
		</>
	);
}
