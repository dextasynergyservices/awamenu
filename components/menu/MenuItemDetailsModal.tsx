"use client";

import { Minus, Plus, ShoppingCart, X } from "lucide-react";
import Image from "next/image";
import { MenuItemBadges, SoldOutPill } from "@/components/menu/MenuItemBadges";
import { useOrderingPaused } from "@/components/menu/OrderingPaused";
import { useCart } from "@/hooks/useCart";
import type { PublicMenuItem } from "@/lib/menu-tags";
import { MENU_TAGS } from "@/lib/menu-tags";

export type MenuItemDetailsItem = PublicMenuItem;

type MenuItemDetailsModalProps = {
	item: MenuItemDetailsItem;
	restaurantSlug: string;
	currency: string;
	onClose: () => void;
};

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

export function MenuItemDetailsModal({
	item,
	restaurantSlug,
	currency,
	onClose,
}: MenuItemDetailsModalProps) {
	const addItem = useCart((state) => state.addItem);
	const paused = useOrderingPaused();
	const setQuantity = useCart((state) => state.setQuantity);
	const line = useCart((state) =>
		state.items.find((cartItem) => cartItem.id === item.id),
	);
	const quantity = line?.quantity ?? 0;
	const cartItem = {
		id: item.id,
		restaurantSlug,
		name: item.name,
		price: item.price,
		imageUrl: item.imageUrl,
	};

	return (
		<div className="fixed inset-0 z-50">
			<button
				type="button"
				className="absolute inset-0 bg-slate-950/45"
				aria-label="Close item details"
				onClick={onClose}
			/>
			<div className="-translate-x-1/2 absolute bottom-0 left-1/2 w-full max-w-lg rounded-t-[2rem] bg-white shadow-2xl md:top-1/2 md:bottom-auto md:-translate-y-1/2 md:rounded-[2rem]">
				<div className="relative h-64 overflow-hidden rounded-t-[2rem] bg-emerald-50 md:h-80 md:rounded-t-[2rem]">
					{item.imageUrl ? (
						<Image
							src={item.imageUrl}
							alt={item.name}
							fill
							className="object-cover"
							sizes="(min-width: 768px) 512px, 100vw"
							unoptimized
						/>
					) : (
						<div className="grid h-full place-items-center text-6xl">🍽️</div>
					)}
					<button
						type="button"
						onClick={onClose}
						className="absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-white/95 text-slate-900 shadow-sm"
						aria-label="Close item details"
					>
						<X className="size-5" aria-hidden="true" />
					</button>
				</div>
				<div className="grid max-h-[42vh] gap-4 overflow-y-auto p-5">
					<div>
						<h2 className="text-sm font-semibold leading-tight text-slate-950 md:text-2xl">
							{item.name}
						</h2>
						<p className="mt-2 text-xs font-semibold text-emerald-700 md:text-xl">
							{formatMoney(item.price, currency)}
						</p>
						<MenuItemBadges
							item={item}
							className="mt-2"
							maxTags={MENU_TAGS.length}
						/>
					</div>
					{item.description ? (
						<p className="text-xs font-medium leading-6 text-slate-600 md:text-base md:leading-7">
							{item.description}
						</p>
					) : null}
					{paused ? (
						<p className="rounded-2xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
							Online ordering is paused right now. Please order at the
							restaurant.
						</p>
					) : item.soldOut ? (
						<div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-100 p-3">
							<p className="text-sm font-bold text-slate-700">
								Sold out for today. Please check back tomorrow.
							</p>
							<SoldOutPill />
						</div>
					) : (
						<div className="flex items-center justify-between gap-3">
							<div className="inline-flex items-center rounded-full border border-emerald-100 bg-white shadow-sm">
								<button
									type="button"
									onClick={() => setQuantity(item.id, quantity - 1)}
									disabled={quantity === 0}
									className="grid size-11 place-items-center rounded-full text-emerald-700 disabled:text-slate-300"
									aria-label={`Reduce ${item.name}`}
								>
									<Minus className="size-4" aria-hidden="true" />
								</button>
								<span className="min-w-9 text-center text-base font-semibold text-emerald-950">
									{quantity}
								</span>
								<button
									type="button"
									onClick={() => addItem(cartItem)}
									className="grid size-11 place-items-center rounded-full text-emerald-700"
									aria-label={`Increase ${item.name}`}
								>
									<Plus className="size-5" aria-hidden="true" />
								</button>
							</div>
							<button
								type="button"
								onClick={() => addItem(cartItem)}
								className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-yellow-300 px-5 text-xs font-semibold text-emerald-950 md:text-sm"
							>
								<ShoppingCart
									className="size-3.5 md:size-5"
									aria-hidden="true"
								/>
								Add to cart
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
