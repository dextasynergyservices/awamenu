"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { MenuItemDetailsModal } from "@/components/menu/MenuItemDetailsModal";
import { useCart } from "@/hooks/useCart";

type MenuItemCompactRowProps = {
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

export function MenuItemCompactRow({
	item,
	restaurantSlug,
	currency,
}: MenuItemCompactRowProps) {
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
			<div className="flex items-center gap-3 border-b border-dashed border-emerald-100 py-3 last:border-b-0">
				<button
					type="button"
					onClick={() => setIsDetailsOpen(true)}
					className="min-w-0 flex-1 text-left"
				>
					<h3 className="line-clamp-1 text-sm font-semibold leading-tight text-slate-950">
						{item.name}
					</h3>
					{item.description ? (
						<p className="mt-0.5 line-clamp-1 text-xs font-medium leading-5 text-slate-500">
							{item.description}
						</p>
					) : null}
				</button>
				<p className="shrink-0 text-xs font-semibold text-emerald-700 md:text-sm">
					{formatMoney(item.price, currency)}
				</p>
				<button
					type="button"
					onClick={() => addItem(cartItem)}
					className="grid size-8 shrink-0 place-items-center rounded-full bg-yellow-300 text-emerald-950 transition-colors hover:bg-yellow-200 md:size-9"
					aria-label={`Add ${item.name} to cart`}
				>
					<Plus className="size-3.5 md:size-4" aria-hidden="true" />
				</button>
			</div>

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
