"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import type { CartLine } from "@/hooks/useCart";
import { useCart } from "@/hooks/useCart";

type CartItemProps = {
	item: CartLine;
	currency: string;
};

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

export function CartItem({ item, currency }: CartItemProps) {
	const setQuantity = useCart((state) => state.setQuantity);
	const setNotes = useCart((state) => state.setNotes);
	const removeItem = useCart((state) => state.removeItem);

	return (
		<div className="rounded-2xl border border-slate-100 bg-white p-4">
			<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
				<div className="min-w-0">
					<p className="truncate text-sm font-semibold text-slate-950">
						{item.name}
					</p>
					<p className="mt-1 text-xs font-semibold text-emerald-700">
						{formatMoney(item.price * item.quantity, currency)}
					</p>
				</div>
				<button
					type="button"
					onClick={() => removeItem(item.id)}
					className="grid size-11 place-items-center rounded-full bg-red-50 text-red-600"
					aria-label={`Remove ${item.name}`}
				>
					<Trash2 className="size-4" aria-hidden="true" />
				</button>
			</div>
			<div className="mt-4 flex items-center justify-between gap-3">
				<div className="inline-flex items-center rounded-full border border-slate-200 bg-white">
					<button
						type="button"
						onClick={() => setQuantity(item.id, item.quantity - 1)}
						className="grid size-11 place-items-center text-slate-700"
						aria-label={`Reduce ${item.name}`}
					>
						<Minus className="size-4" aria-hidden="true" />
					</button>
					<span className="min-w-8 text-center text-xs font-semibold">
						{item.quantity}
					</span>
					<button
						type="button"
						onClick={() => setQuantity(item.id, item.quantity + 1)}
						className="grid size-11 place-items-center text-slate-700"
						aria-label={`Increase ${item.name}`}
					>
						<Plus className="size-4" aria-hidden="true" />
					</button>
				</div>
			</div>
			<label className="mt-4 block">
				<span className="text-xs font-semibold text-slate-700">Item notes</span>
				<textarea
					value={item.notes}
					onChange={(event) => setNotes(item.id, event.target.value)}
					rows={2}
					className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-700"
					placeholder="No onions, extra pepper..."
				/>
			</label>
		</div>
	);
}
