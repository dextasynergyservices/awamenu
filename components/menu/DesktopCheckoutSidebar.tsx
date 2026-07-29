"use client";

import {
	ArrowRight,
	Minus,
	Plus,
	ShieldCheck,
	ShoppingBag,
	Trash2,
	Utensils,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { getCartSubtotal, useCart } from "@/hooks/useCart";
import { cn } from "@/lib/utils";

type DesktopCheckoutSidebarProps = {
	restaurantSlug: string;
	currency: string;
	appendOrderId?: string;
};

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

export function DesktopCheckoutSidebar({
	restaurantSlug,
	currency,
	appendOrderId,
}: DesktopCheckoutSidebarProps) {
	const removeItem = useCart((state) => state.removeItem);
	const setQuantity = useCart((state) => state.setQuantity);
	const storedAppendOrderId = useCart((state) => state.appendOrderId);
	const setAppendOrderId = useCart((state) => state.setAppendOrderId);
	const allCartItems = useCart((state) => state.items);
	const cartItems = useMemo(
		() => allCartItems.filter((item) => item.restaurantSlug === restaurantSlug),
		[allCartItems, restaurantSlug],
	);
	const subtotal = getCartSubtotal(cartItems);
	const itemCount = cartItems.reduce((count, item) => count + item.quantity, 0);
	const checkoutHref = storedAppendOrderId
		? `/${restaurantSlug}/cart?orderId=${storedAppendOrderId}`
		: `/${restaurantSlug}/cart`;

	useEffect(() => {
		setAppendOrderId(appendOrderId ?? null);
	}, [appendOrderId, setAppendOrderId]);

	return (
		<aside className="sticky top-[76px] hidden max-h-[calc(100vh-88px)] overflow-y-auto rounded-2xl border border-slate-200 bg-white px-4 py-5 md:block lg:px-5 lg:py-6 xl:px-8 xl:py-8">
			<div className="flex items-center justify-between gap-4">
				<div>
					<h2 className="text-xl font-black text-slate-950">Your Order</h2>
					<p className="mt-1 text-sm font-black text-emerald-700">
						{itemCount} Item{itemCount === 1 ? "" : "s"}
					</p>
				</div>
				<div className="grid size-12 place-items-center rounded-xl bg-emerald-50 text-emerald-800">
					<ShoppingBag className="size-5" aria-hidden="true" />
				</div>
			</div>

			<div className="mt-7 grid gap-4">
				{cartItems.length > 0 ? (
					cartItems.map((item) => (
						<div
							key={item.id}
							className="rounded-xl border border-slate-200 bg-white p-4"
						>
							<div className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] gap-4">
								<div className="relative size-14 overflow-hidden rounded-lg bg-emerald-50">
									{item.imageUrl ? (
										<Image
											src={item.imageUrl}
											alt={item.name}
											fill
											className="object-cover"
											sizes="56px"
											unoptimized
										/>
									) : (
										<div className="grid h-full place-items-center">
											<Utensils className="size-5 text-emerald-700" />
										</div>
									)}
								</div>
								<div className="min-w-0">
									<p className="truncate text-sm font-black text-slate-950">
										{item.name}
									</p>
									<div className="mt-3 inline-flex items-center rounded-lg border border-slate-200">
										<button
											type="button"
											onClick={() => setQuantity(item.id, item.quantity - 1)}
											className="grid size-8 place-items-center text-emerald-800"
											aria-label={`Reduce ${item.name}`}
										>
											<Minus className="size-4" aria-hidden="true" />
										</button>
										<span className="min-w-8 text-center text-sm font-black">
											{item.quantity}
										</span>
										<button
											type="button"
											onClick={() => setQuantity(item.id, item.quantity + 1)}
											className="grid size-8 place-items-center text-emerald-800"
											aria-label={`Increase ${item.name}`}
										>
											<Plus className="size-4" aria-hidden="true" />
										</button>
									</div>
								</div>
								<div className="grid justify-items-end gap-3">
									<button
										type="button"
										onClick={() => removeItem(item.id)}
										className="grid size-7 place-items-center rounded-full bg-slate-100 text-slate-500"
										aria-label={`Remove ${item.name}`}
									>
										<Trash2 className="size-3.5" aria-hidden="true" />
									</button>
									<p className="text-sm font-black text-slate-950">
										{formatMoney(item.price * item.quantity, currency)}
									</p>
								</div>
							</div>
						</div>
					))
				) : (
					<div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm font-bold text-slate-500">
						Your order is empty.
					</div>
				)}
			</div>

			<div className="mt-7 grid gap-4 border-slate-200 border-t pt-6">
				<div className="flex justify-between text-sm">
					<span>Subtotal</span>
					<span className="font-black">{formatMoney(subtotal, currency)}</span>
				</div>
				<div className="flex justify-between border-slate-200 border-t pt-5 text-xl font-black">
					<span>Total</span>
					<span className="text-emerald-800">
						{formatMoney(subtotal, currency)}
					</span>
				</div>
				<Link
					href={checkoutHref}
					className={cn(
						"inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-emerald-800 px-5 text-sm font-black text-white",
						cartItems.length === 0 && "pointer-events-none opacity-50",
					)}
				>
					Checkout
					<ArrowRight className="size-5" aria-hidden="true" />
				</Link>
			</div>

			<div className="mt-6 rounded-lg bg-emerald-50 p-5">
				<div className="flex gap-4">
					<ShieldCheck className="size-8 shrink-0 text-emerald-700" />
					<div>
						<p className="text-sm font-black text-emerald-800">
							Secure checkout
						</p>
						<p className="mt-1 text-xs font-medium leading-5 text-slate-600">
							Your payment information is safe and encrypted
						</p>
					</div>
				</div>
			</div>

			<div className="mt-8 border-slate-200 border-t pt-6">
				<p className="text-sm font-black text-slate-950">We accept</p>
				<div className="mt-3 flex flex-wrap gap-3">
					<span className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black tracking-tight text-blue-700">
						VISA
					</span>
					<span className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2">
						<span className="sr-only">Mastercard</span>
						<span className="size-4 rounded-full bg-red-500" />
						<span className="-ml-2 size-4 rounded-full bg-yellow-400 opacity-90" />
					</span>
					<span className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-red-600">
						Verve
					</span>
					<span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-900">
						<span className="grid size-4 place-items-center rounded bg-[#09a5db] text-[10px] font-black text-white">
							P
						</span>
						<span className="text-[#09a5db]">pay</span>
						<span className="text-slate-900">stack</span>
					</span>
					<span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-950">
						<span className="text-sm leading-none"></span>
						Pay
					</span>
				</div>
			</div>
		</aside>
	);
}
