"use client";

import { ShoppingCart } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { MenuItemDetailsModal } from "@/components/menu/MenuItemDetailsModal";
import { useCart } from "@/hooks/useCart";

type MenuItemCardProps = {
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

export function MenuItemCard({
	item,
	restaurantSlug,
	currency,
}: MenuItemCardProps) {
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
			<article className="rounded-3xl border border-emerald-50 bg-white p-3 shadow-[0_18px_42px_rgba(15,23,42,0.08)] md:p-4">
				<div className="grid grid-cols-[5.5rem_minmax(0,1fr)_3rem] items-center gap-3 md:grid-cols-[9rem_minmax(0,1fr)_3.5rem] md:gap-4">
					<button
						type="button"
						onClick={() => setIsDetailsOpen(true)}
						className="relative h-24 overflow-hidden rounded-2xl bg-emerald-50 md:h-36"
					>
						{item.imageUrl ? (
							<Image
								src={item.imageUrl}
								alt={item.name}
								fill
								className="object-cover"
								sizes="(min-width: 768px) 144px, 88px"
								unoptimized
							/>
						) : (
							<div className="grid h-full place-items-center text-3xl">🍽️</div>
						)}
					</button>
					<div className="min-w-0">
						<button
							type="button"
							onClick={() => setIsDetailsOpen(true)}
							className="block w-full text-left"
						>
							<h3 className="line-clamp-1 text-sm font-semibold leading-tight text-slate-950 md:text-xl">
								{item.name}
							</h3>
							{item.description ? (
								<p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-500 md:text-base">
									{item.description}
								</p>
							) : null}
							<p className="mt-2 text-xs font-semibold text-emerald-700 md:text-xl">
								{formatMoney(item.price, currency)}
							</p>
						</button>
					</div>
					<button
						type="button"
						onClick={() => addItem(cartItem)}
						className="grid size-10 place-items-center rounded-full bg-yellow-300 text-emerald-950 transition-colors hover:bg-yellow-200 md:size-14"
						aria-label={`Add ${item.name} to cart`}
					>
						<ShoppingCart className="size-3.5 md:size-6" aria-hidden="true" />
					</button>
				</div>
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
