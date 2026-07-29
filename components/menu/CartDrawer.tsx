"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { CartItem } from "@/components/menu/CartItem";
import { getCartSubtotal, useCart } from "@/hooks/useCart";

type CartDrawerProps = {
	currency: string;
	restaurantSlug: string;
	appendOrderId?: string;
};

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

export function CartDrawer({
	currency,
	restaurantSlug,
	appendOrderId,
}: CartDrawerProps) {
	const items = useCart((state) => state.items);
	const isOpen = useCart((state) => state.isOpen);
	const storedAppendOrderId = useCart((state) => state.appendOrderId);
	const openCart = useCart((state) => state.openCart);
	const closeCart = useCart((state) => state.closeCart);
	const setAppendOrderId = useCart((state) => state.setAppendOrderId);
	const subtotal = getCartSubtotal(items);
	const itemCount = items.reduce((total, item) => total + item.quantity, 0);
	const checkoutHref = storedAppendOrderId
		? `/${restaurantSlug}/cart?orderId=${storedAppendOrderId}`
		: `/${restaurantSlug}/cart`;

	useEffect(() => {
		setAppendOrderId(appendOrderId ?? null);
	}, [appendOrderId, setAppendOrderId]);

	return (
		<>
			{itemCount > 0 ? (
				<div className="fixed inset-x-3 bottom-3 z-30 rounded-[1.5rem] bg-emerald-950 p-2.5 text-white shadow-[0_18px_45px_rgba(6,95,70,0.28)] md:inset-x-auto md:right-8 md:bottom-8 md:w-[30rem] md:p-3">
					<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
						<button
							type="button"
							onClick={openCart}
							className="flex min-w-0 items-center gap-3 text-left"
						>
							<span className="relative grid size-9 shrink-0 place-items-center rounded-2xl bg-white text-emerald-900 md:size-14">
								<ShoppingCart
									className="size-3.5 md:size-7"
									aria-hidden="true"
								/>
								<span className="-right-1 -top-1 absolute grid size-6 place-items-center rounded-full bg-yellow-300 text-xs font-semibold text-emerald-950">
									{itemCount}
								</span>
							</span>
							<span className="min-w-0">
								<span className="block text-xs font-semibold md:text-lg lg:text-xl">
									View Cart
								</span>
								<span className="block truncate text-xs font-medium text-emerald-50 md:text-base">
									{itemCount} item{itemCount === 1 ? "" : "s"} ·{" "}
									{formatMoney(subtotal, currency)}
								</span>
							</span>
						</button>
						<Link
							href={checkoutHref}
							className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-yellow-300 p-2 md:px-4 text-xs font-semibold text-emerald-950 md:min-h-12 md:text-base"
						>
							Checkout
							<ArrowRight className="size-3.5 md:size-5" aria-hidden="true" />
						</Link>
					</div>
				</div>
			) : null}

			<AnimatePresence>
				{isOpen ? (
					<div className="fixed inset-0 z-40">
						<motion.button
							type="button"
							className="absolute inset-0 bg-slate-950/35"
							aria-label="Close cart"
							onClick={closeCart}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
						/>
						<motion.aside
							className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-hidden rounded-t-[2rem] bg-slate-50 shadow-2xl md:left-auto md:right-6 md:bottom-6 md:w-[28rem] md:rounded-[2rem]"
							initial={{ y: "100%" }}
							animate={{ y: 0 }}
							exit={{ y: "100%" }}
							transition={{ type: "spring", damping: 28, stiffness: 260 }}
						>
							<div className="flex items-center justify-between border-slate-200 border-b bg-white px-5 py-4">
								<div>
									<h2 className="text-sm font-semibold text-slate-950">Cart</h2>
									<p className="text-xs font-medium text-slate-500">
										{itemCount} item{itemCount === 1 ? "" : "s"}
									</p>
								</div>
								<button
									type="button"
									onClick={closeCart}
									className="grid size-11 place-items-center rounded-full bg-slate-100 text-slate-700"
									aria-label="Close cart"
								>
									<X className="size-5" aria-hidden="true" />
								</button>
							</div>
							<div className="max-h-[58vh] space-y-3 overflow-y-auto px-4 py-4">
								{items.length > 0 ? (
									items.map((item) => (
										<CartItem key={item.id} item={item} currency={currency} />
									))
								) : (
									<div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
										<p className="text-sm font-semibold text-slate-950">
											Your cart is empty
										</p>
									</div>
								)}
							</div>
							<div className="border-slate-200 border-t bg-white px-5 py-4">
								<div className="flex items-center justify-between">
									<span className="text-xs font-semibold text-slate-600">
										Subtotal
									</span>
									<span className="text-lg font-semibold text-slate-950 md:text-xl">
										{formatMoney(subtotal, currency)}
									</span>
								</div>
								<Link
									href={checkoutHref}
									onClick={closeCart}
									className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-xs font-semibold text-white aria-disabled:pointer-events-none aria-disabled:opacity-50 md:text-base"
									aria-disabled={items.length === 0}
								>
									Checkout
								</Link>
							</div>
						</motion.aside>
					</div>
				) : null}
			</AnimatePresence>
		</>
	);
}
