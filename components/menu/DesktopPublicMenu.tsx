"use client";

import { Plus, Utensils } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { DesktopCheckoutSidebar } from "@/components/menu/DesktopCheckoutSidebar";
import { DesktopMenuSidebar } from "@/components/menu/DesktopMenuSidebar";
import { OrderLookupForm } from "@/components/menu/OrderLookupForm";
import { PublicMenuNavbar } from "@/components/menu/PublicMenuNavbar";
import { useCart } from "@/hooks/useCart";
import type { BannerItem } from "@/lib/banners";
import type { OpeningPeriod, OpenState } from "@/lib/opening-hours";
import { cn } from "@/lib/utils";

type DesktopCategory = {
	id: string;
	name: string;
	items: Array<{
		id: string;
		name: string;
		description: string | null;
		price: number;
		imageUrl: string | null;
	}>;
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
	const addItem = useCart((state) => state.addItem);
	const selectedCategory = categories.find(
		(category) => category.id === activeCategoryId,
	);
	const [activeBannerIndex, setActiveBannerIndex] = useState(0);
	const [previousBannerIndex, setPreviousBannerIndex] = useState<number | null>(
		null,
	);
	const displayItems = useMemo(
		() =>
			activeCategoryId === "all"
				? categories.flatMap((category) => category.items)
				: (selectedCategory?.items ?? []),
		[activeCategoryId, categories, selectedCategory],
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
					onSelectCategory={setActiveCategoryId}
					categories={categories}
					restaurantSlug={restaurantSlug}
					tableReservationEnabled={tableReservationEnabled}
				/>

				<main className="min-w-0">
					<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
						<div>
							<h2 className="text-2xl font-semibold text-slate-950">
								{selectedCategory?.name ?? "All Items"}
							</h2>
							<p className="mt-2 text-sm font-medium text-slate-500">
								Discover our full menu of delicious meals and refreshing drinks.
							</p>
						</div>
						<OrderLookupForm restaurantSlug={restaurantSlug} compact />
					</div>

					<div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4 xl:gap-4">
						{displayItems.map((item, index) => (
							<article
								key={item.id}
								className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.04)]"
							>
								<div className="relative h-28 bg-emerald-50 xl:h-32">
									{item.imageUrl ? (
										<Image
											src={item.imageUrl}
											alt={item.name}
											fill
											className="object-cover"
											sizes="(min-width: 1280px) 25vw, 33vw"
											unoptimized
										/>
									) : (
										<div className="grid h-full place-items-center text-4xl">
											<Utensils className="size-10 text-emerald-700" />
										</div>
									)}
									{index === 0 ? (
										<span className="absolute top-3 left-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900 shadow-sm">
											Bestseller
										</span>
									) : null}
								</div>
								<div className="grid gap-2.5 p-3">
									<div>
										<h3 className="line-clamp-1 text-sm font-semibold text-slate-950">
											{item.name}
										</h3>
										{item.description ? (
											<p className="mt-1 line-clamp-2 min-h-9 text-xs font-medium leading-4 text-slate-600 xl:text-sm xl:leading-5">
												{item.description}
											</p>
										) : (
											<p className="mt-1 min-h-9 text-xs font-medium leading-4 text-slate-400 xl:text-sm xl:leading-5">
												Freshly prepared.
											</p>
										)}
									</div>
									<div className="flex items-center justify-between gap-3">
										<p className="text-sm font-semibold text-emerald-800 xl:text-lg">
											{formatMoney(item.price, currency)}
										</p>
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
		</div>
	);
}
