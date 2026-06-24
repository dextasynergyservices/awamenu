"use client";

import { ArrowRight, ReceiptText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type OrderLookupFormProps = {
	restaurantSlug: string;
	compact?: boolean;
};

export function OrderLookupForm({
	restaurantSlug,
	compact = false,
}: OrderLookupFormProps) {
	const router = useRouter();
	const [orderId, setOrderId] = useState("");

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				const normalizedOrderId = orderId.replace(/^#/, "").trim();
				if (!normalizedOrderId) return;

				router.push(
					`/${restaurantSlug}/order/${encodeURIComponent(normalizedOrderId)}`,
				);
			}}
			className={
				compact
					? "grid gap-2 rounded-xl border border-slate-200 bg-white p-3"
					: "mx-auto grid max-w-5xl gap-3 px-4 py-3"
			}
		>
			<label
				htmlFor={`order-lookup-${compact ? "desktop" : "mobile"}`}
				className="text-sm font-black text-slate-700"
			>
				Track your order
			</label>
			<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
				<span className="relative">
					<ReceiptText className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-slate-400" />
					<input
						id={`order-lookup-${compact ? "desktop" : "mobile"}`}
						value={orderId}
						onChange={(event) => setOrderId(event.target.value)}
						placeholder="Enter order ID"
						className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-10 text-base font-bold outline-none focus:border-emerald-700"
					/>
				</span>
				<button
					type="submit"
					className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-white"
					aria-label="Track order"
				>
					<ArrowRight className="size-5" aria-hidden="true" />
				</button>
			</div>
		</form>
	);
}
