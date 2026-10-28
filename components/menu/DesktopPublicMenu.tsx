"use client";

import { Plus, Utensils } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { DesktopCheckoutSidebar } from "@/components/menu/DesktopCheckoutSidebar";
import { DesktopMenuSidebar } from "@/components/menu/DesktopMenuSidebar";
import { MenuItemBadges, SoldOutPill } from "@/components/menu/MenuItemBadges";
import { MenuItemDetailsModal } from "@/components/menu/MenuItemDetailsModal";
import { MenuSearchInput } from "@/components/menu/MenuSearchInput";
import { useOrderingPaused } from "@/components/menu/OrderingPaused";
import { OrderLookupForm } from "@/components/menu/OrderLookupForm";
import { PublicMenuNavbar } from "@/components/menu/PublicMenuNavbar";
import { useCart } from "@/hooks/useCart";
import type { BannerItem } from "@/lib/banners";
import { matchesMenuSearch, type PublicMenuItem } from "@/lib/menu-tags";
import type { OpeningPeriod, OpenState } from "@/lib/opening-hours";
import { cn } from "@/lib/utils";

type DesktopCategory = {
	id: string;
	name: string;
	items: PublicMenuItem[];
};

type DesktopPublicMenuProps = {
	name: string;
	logoUrl: string | null;
	bannerItems: BannerItem[];
	categories: DesktopCategory[];
	restaurantSlug: string;
	openState?: OpenState;
	openingPeriods?: OpeningPeriod[];
	timezone?: string;
	reservationsEnabled?: boolean;
	currency: string;
	appendOrderId?: string;
	tableReservationEnabled: boolean;
};

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

export function DesktopPublicMenu({
	name,
	logoUrl,
	bannerItems,
	categories,
	restaurantSlug,
	openState,
	openingPeriods,
	timezone,
	reservationsEnabled,
	currency,
	appendOrderId,
	tableReservationEnabled,
}: DesktopPublicMenuProps) {
	const [activeCategoryId, setActiveCategoryId] = useState("all");
	const [detailsItem, setDetailsItem] = useState<PublicMenuItem | null>(null);
	const addItem = useCart((state) => state.addItem);
	const paused = useOrderingPaused();
	const selectedCategory = categories.find(
		(category) => category.id === activeCategoryId,
	);
	const [activeBannerIndex, setActiveBannerIndex] = useState(0);
	const [previousBannerIndex, setPreviousBannerIndex] = useState<number | null>(
		null,
	);
	const [query, setQuery] = useState("");
	const searching = query.trim().length > 0;
	const displayItems = useMemo(
		() =>
			searching
				? categories
						.flatMap((category) => category.items)
						.filter((item) => matchesMenuSearch(item, query))
				: activeCategoryId === "all"
					? categories.flatMap((category) => category.items)
					: (selectedCategory?.items ?? []),
		[activeCategoryId, categories, selectedCategory, query, searching],
	);

	useEffect(() => {
		if (bannerItems.length < 2) return;

		const timer = window.setInterval(() => {
			setActiveBannerIndex((current) => {
				setPreviousBannerIndex(current);
				return (current + 1) % bannerItems.length;
			});
		}, 5000);

		return () => window.clearInterval(timer);
	}, [bannerItems.length]);

	return (
		<div className="hidden min-h-screen bg-white md:block">
			<PublicMenuNavbar
				name={name}
				logoUrl={logoUrl}
				mode="desktop"
				restaurantSlug={restaurantSlug}
				openState={openState}
				openingPeriods={openingPeriods}
				timezone={timezone}
				reservationsEnabled={reservationsEnabled}
			/>

			{bannerItems.length > 0 ? (
				<section className="relative z-30 bg-white px-2 pt-2">
					<div className="relative h-[130px] overflow-hidden rounded-2xl bg-white md:h-[160px] lg:h-[170px] xl:h-[190px]">
						{bannerItems.map((banner, index) => {
							const isActive = index === activeBannerIndex;
							const isPrevious = index === previousBannerIndex;

							return (
								<div
									key={banner.id ?? banner.url}
									className={cn(
										"absolute inset-0 transition-transform duration-700 ease-out",
										isActive && "z-20 translate-x-0",
										isPrevious && "z-10 -translate-x-full",
										!isActive && !isPrevious && "z-0 translate-x-full",
									)}
								>
									<Image
										src={banner.url}
										alt={`${name} banner ${index + 1}`}
										fill
										className="object-cover"
										sizes="100vw"
										priority={index === 0}
										unoptimized
									/>
									{banner.title || banner.subtitle ? (
										<div className="absolute inset-0 flex items-center bg-emerald-950/55 px-8 text-white">
											<div className="max-w-sm">
												{banner.title ? (
													<h2 className="text-3xl font-semibold leading-tight lg:text-4xl">
														{banner.title}
													</h2>
												) : null}
												{banner.subtitle ? (
													<p className="mt-3 text-sm font-medium text-white/90 lg:text-lg">
														{banner.subtitle}
													</p>
												) : null}
											</div>
										</div>
									) : null}
								</div>
							);
						})}
						{bannerItems.length > 1 ? (
							<div className="absolute right-4 bottom-4 flex gap-2">
								{bannerItems.map((banner, index) => (
									<button
										key={banner.id ?? banner.url}
										type="button"
										onClick={() => {
											if (index === activeBannerIndex) return;
											setPreviousBannerIndex(activeBannerIndex);
											setActiveBannerIndex(index);
										}}
										className={
											index === activeBannerIndex
												? "size-2.5 rounded-full bg-yellow-300"
												: "size-2.5 rounded-full bg-white/70"
										}
										aria-label={`Show banner ${index + 1}`}
									/>
								))}
							</div>
						) : null}
					</div>
				</section>
			) : null}

			<div className="grid grid-cols-[180px_minmax(0,1fr)_260px] gap-3 px-2 py-4 lg:grid-cols-[220px_minmax(0,1fr)_320px] lg:gap-4 xl:grid-cols-[300px_minmax(0,1fr)_390px]">
				<DesktopMenuSidebar
					activeCategoryId={activeCategoryId}
					onSelectCategory={(id) => {
						setQuery("");
						setActiveCategoryId(id);
					}}
					categories={categories}
					restaurantSlug={restaurantSlug}
					tableReservationEnabled={tableReservationEnabled}
				/>

				<main className="min-w-0">
					<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
						<div>
							<h2 className="text-2xl font-semibold text-slate-950">
								{searching
									? "Search results"
									: (selectedCategory?.name ?? "All Items")}
							</h2>
							<p
								className="mt-2 text-sm font-medium text-slate-500"
								aria-live="polite"
							>
								{searching
									? `${displayItems.length} dish${displayItems.length === 1 ? "" : "es"} match “${query.trim()}”`
									: "Discover our full menu of delicious meals and refreshing drinks."}
							</p>
						</div>
						<OrderLookupForm restaurantSlug={restaurantSlug} compact />
					</div>
					{categories.length > 0 ? (
						<MenuSearchInput
							value={query}
							onChange={setQuery}
							className="mt-4 max-w-md"
						/>
					) : null}
					{displayItems.length === 0 ? (
						<p className="mt-6 rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">
							{searching
								? `No dishes match “${query.trim()}”. Try a different word.`
								: "No dishes in this category yet."}
						</p>
					) : null}

					<div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4 xl:gap-4">
						{displayItems.map((item) => (
							<article
								key={item.id}
								className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
							>
								<button
									type="button"
									onClick={() => setDetailsItem(item)}
									className="relative block h-28 w-full bg-emerald-50 xl:h-32"
									aria-label={`View ${item.name} details`}
								>
									{item.imageUrl ? (
										<Image
											src={item.imageUrl}
											alt={item.name}
											fill
											className={cn(
												"object-cover",
												item.soldOut && "opacity-60 grayscale",
											)}
											sizes="(min-width: 1280px) 25vw, 33vw"
											unoptimized
										/>
									) : (
										<span className="grid h-full place-items-center text-4xl">
											<Utensils className="size-10 text-emerald-700" />
										</span>
									)}
								</button>
								<div className="grid min-w-0 gap-2.5 p-3">
									<button
										type="button"
										onClick={() => setDetailsItem(item)}
										className="block w-full min-w-0 text-left"
									>
										<h3 className="line-clamp-1 text-sm font-semibold text-slate-950">
											{item.name}
										</h3>
										<MenuItemBadges item={item} className="mt-1" maxTags={2} />
										<p className="mt-1 line-clamp-2 min-h-8 text-xs font-medium leading-4 text-slate-600 xl:min-h-10 xl:text-sm xl:leading-5">
											{item.description}
										</p>
									</button>
									<div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
										<p className="text-sm font-semibold text-emerald-800 xl:text-lg">
											{formatMoney(item.price, currency)}
										</p>
										{item.soldOut ? (
											<SoldOutPill />
										) : paused ? null : (
											<button
												type="button"
												onClick={() =>
													addItem({
														id: item.id,
														restaurantSlug,
														name: item.name,
														price: item.price,
														imageUrl: item.imageUrl,
													})
												}
												className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-emerald-800 px-3 text-xs font-semibold text-white xl:min-h-9 xl:px-4 xl:text-sm"
											>
												Add
												<Plus className="size-4" aria-hidden="true" />
											</button>
										)}
									</div>
								</div>
							</article>
						))}
					</div>
				</main>

				<DesktopCheckoutSidebar
					restaurantSlug={restaurantSlug}
					currency={currency}
					appendOrderId={appendOrderId}
				/>
			</div>
			{detailsItem ? (
				<MenuItemDetailsModal
					item={detailsItem}
					restaurantSlug={restaurantSlug}
					currency={currency}
					onClose={() => setDetailsItem(null)}
				/>
			) : null}
		</div>
	);
}
