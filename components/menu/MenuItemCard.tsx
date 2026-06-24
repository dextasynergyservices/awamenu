"use client";

import { Minus, Plus, ShoppingCart, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
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
	const setQuantity = useCart((state) => state.setQuantity);
	const line = useCart((state) =>
		state.items.find((cartItem) => cartItem.id === item.id),
	);
	const quantity = line?.quantity ?? 0;
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
							<h3 className="line-clamp-1 text-base font-semibold leading-tight text-slate-950 md:text-xl">
								{item.name}
							</h3>
							{item.description ? (
								<p className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-slate-500 md:text-base">
									{item.description}
								</p>
							) : null}
							<p className="mt-2 text-base font-semibold text-emerald-700 md:text-xl">
								{formatMoney(item.price, currency)}
							</p>
						</button>
						{/* <div className="mt-2 inline-flex items-center rounded-full border border-emerald-100 bg-white shadow-sm md:mt-4">
							<button
								type="button"
								onClick={() => setQuantity(item.id, quantity - 1)}
								disabled={quantity === 0}
								className="grid size-9 place-items-center rounded-full text-emerald-700 disabled:text-slate-300 md:size-10"
								aria-label={`Reduce ${item.name}`}
							>
								<Minus className="size-4" aria-hidden="true" />
							</button>
							<span className="min-w-7 text-center text-sm font-semibold text-emerald-950 md:min-w-8 md:text-base">
								{quantity}
							</span>
							<button
								type="button"
								onClick={() => addItem(cartItem)}
								className="grid size-9 place-items-center rounded-full text-emerald-700 md:size-10"
								aria-label={`Increase ${item.name}`}
							>
								<Plus className="size-5" aria-hidden="true" />
							</button>
						</div> */}
					</div>
					<button
						type="button"
						onClick={() => addItem(cartItem)}
						className="grid size-12 place-items-center rounded-full bg-yellow-300 text-emerald-950 transition-colors hover:bg-yellow-200 md:size-14"
						aria-label={`Add ${item.name} to cart`}
					>
						<ShoppingCart className="size-5 md:size-6" aria-hidden="true" />
					</button>
				</div>
			</article>

			{isDetailsOpen ? (
				<div className="fixed inset-0 z-50">
					<button
						type="button"
						className="absolute inset-0 bg-slate-950/45"
						aria-label="Close item details"
						onClick={() => setIsDetailsOpen(false)}
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
								onClick={() => setIsDetailsOpen(false)}
								className="absolute top-4 right-4 grid size-11 place-items-center rounded-full bg-white/95 text-slate-900 shadow-sm"
								aria-label="Close item details"
							>
								<X className="size-5" aria-hidden="true" />
							</button>
						</div>
						<div className="grid max-h-[42vh] gap-4 overflow-y-auto p-5">
							<div>
								<h2 className="text-2xl font-semibold leading-tight text-slate-950">
									{item.name}
								</h2>
								<p className="mt-2 text-xl font-semibold text-emerald-700">
									{formatMoney(item.price, currency)}
								</p>
							</div>
							{item.description ? (
								<p className="text-base font-medium leading-7 text-slate-600">
									{item.description}
								</p>
							) : null}
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
									className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-yellow-300 px-5 text-sm font-semibold text-emerald-950"
								>
									<ShoppingCart className="size-5" aria-hidden="true" />
									Add to cart
								</button>
							</div>
						</div>
					</div>
				</div>
			) : null}
		</>
	);
}
