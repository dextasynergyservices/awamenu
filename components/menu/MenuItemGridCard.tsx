"use client";

import { Plus } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { MenuItemDetailsModal } from "@/components/menu/MenuItemDetailsModal";
import { useCart } from "@/hooks/useCart";

type MenuItemGridCardProps = {
	item: {
		id: string;
		name: string;
		description: string | null;
		price: number;
		imageUrl: string | null;
	};
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

export function MenuItemGridCard({
	item,
	restaurantSlug,
	currency,
}: MenuItemGridCardProps) {
	const addItem = useCart((state) => state.addItem);
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
			<article className="overflow-hidden rounded-2xl border border-emerald-50 bg-white shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
				<div className="relative aspect-square w-full overflow-hidden bg-emerald-50">
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
								className="object-cover"
								sizes="(min-width: 768px) 220px, 45vw"
								unoptimized
							/>
						) : (
							<div className="grid h-full place-items-center text-4xl">🍽️</div>
						)}
					</button>
					<button
						type="button"
						onClick={() => addItem(cartItem)}
						className="absolute right-2 bottom-2 grid size-9 place-items-center rounded-full bg-yellow-300 text-emerald-950 shadow-md transition-colors hover:bg-yellow-200 md:size-10"
						aria-label={`Add ${item.name} to cart`}
					>
						<Plus className="size-4 md:size-5" aria-hidden="true" />
					</button>
				</div>
				<button
					type="button"
					onClick={() => setIsDetailsOpen(true)}
					className="block w-full p-3 text-left"
				>
					<h3 className="line-clamp-1 text-sm font-semibold leading-tight text-slate-950 md:text-base">
						{item.name}
					</h3>
					{item.description ? (
						<p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-500">
							{item.description}
						</p>
					) : null}
					<p className="mt-2 text-xs font-semibold text-emerald-700 md:text-sm">
						{formatMoney(item.price, currency)}
					</p>
				</button>
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
