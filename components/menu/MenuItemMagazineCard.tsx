"use client";

import { Plus } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { MenuItemBadges, SoldOutPill } from "@/components/menu/MenuItemBadges";
import { MenuItemDetailsModal } from "@/components/menu/MenuItemDetailsModal";
import { useOrderingPaused } from "@/components/menu/OrderingPaused";
import { useCart } from "@/hooks/useCart";
import type { PublicMenuItem } from "@/lib/menu-tags";
import { cn } from "@/lib/utils";

type MenuItemMagazineCardProps = {
	item: PublicMenuItem;
	restaurantSlug: string;
	currency: string;
};

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

export function MenuItemMagazineCard({
	item,
	restaurantSlug,
	currency,
}: MenuItemMagazineCardProps) {
	const addItem = useCart((state) => state.addItem);
	const paused = useOrderingPaused();
	const [isDetailsOpen, setIsDetailsOpen] = useState(false);
	const cartItem = {
		id: item.id,
		restaurantSlug,
		name: item.name,
		price: item.price,
		imageUrl: item.imageUrl,
	};

	return (
		<>
			<article className="overflow-hidden rounded-3xl border border-emerald-50 bg-white shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
				<div className="relative aspect-16/9 w-full overflow-hidden bg-emerald-50">
					<button
						type="button"
						onClick={() => setIsDetailsOpen(true)}
						className="absolute inset-0"
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
								sizes="(min-width: 768px) 600px, 100vw"
								unoptimized
							/>
						) : (
							<div className="grid h-full place-items-center text-5xl">🍽️</div>
						)}
					</button>
					<div className="pointer-events-none absolute inset-x-0 bottom-0 bg-slate-950/70 p-4 text-white md:p-6">
						<h3 className="line-clamp-1 text-base font-semibold leading-tight md:text-2xl">
							{item.name}
						</h3>
						<p className="mt-1 text-sm font-semibold text-yellow-300 md:text-lg">
							{formatMoney(item.price, currency)}
						</p>
					</div>
					{item.soldOut ? (
						<SoldOutPill className="absolute right-3 bottom-3 md:right-4 md:bottom-4" />
					) : paused ? null : (
						<button
							type="button"
							onClick={() => addItem(cartItem)}
							className="absolute right-3 bottom-3 grid size-10 place-items-center rounded-full bg-yellow-300 text-emerald-950 shadow-md transition-colors hover:bg-yellow-200 md:right-4 md:bottom-4 md:size-12"
							aria-label={`Add ${item.name} to cart`}
						>
							<Plus className="size-5 md:size-6" aria-hidden="true" />
						</button>
					)}
				</div>
				<MenuItemBadges item={item} className="px-4 pt-3 md:px-5" />
				{item.description ? (
					<button
						type="button"
						onClick={() => setIsDetailsOpen(true)}
						className="block w-full p-4 text-left md:p-5"
					>
						<p className="line-clamp-2 text-xs font-medium leading-5 text-slate-500 md:text-sm">
							{item.description}
						</p>
					</button>
				) : null}
			</article>

			{isDetailsOpen ? (
				<MenuItemDetailsModal
					item={item}
					restaurantSlug={restaurantSlug}
					currency={currency}
					onClose={() => setIsDetailsOpen(false)}
				/>
			) : null}
		</>
	);
}
