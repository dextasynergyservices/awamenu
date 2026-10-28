"use client";

import { Utensils } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { staffSetSoldOutAction } from "@/actions/staff.actions";
import { MenuSearchInput } from "@/components/menu/MenuSearchInput";
import { PinPromptModal } from "@/components/staff/PinPromptModal";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";

type StaffMenuCategory = {
	id: string;
	name: string;
	items: Array<{ id: string; name: string; soldOut: boolean }>;
};

/**
 * "Menu" on the staff dashboard: mark a dish sold out until tomorrow, or back
 * in stock, without waiting for the owner. Staff ID + PIN, like every staff
 * action, so the audit trail says who did it.
 */
export function StaffMenuAvailability({
	slug,
	categories,
}: {
	slug: string;
	categories: StaffMenuCategory[];
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [pending, setPending] = useState<{
		itemId: string;
		name: string;
		soldOut: "today" | "off";
	} | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [isSaving, startTransition] = useTransition();

	const soldOutCount = categories.reduce(
		(total, c) => total + c.items.filter((i) => i.soldOut).length,
		0,
	);
	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return categories;
		return categories
			.map((c) => ({
				...c,
				items: c.items.filter((i) => i.name.toLowerCase().includes(q)),
			}))
			.filter((c) => c.items.length > 0);
	}, [categories, query]);

	function submit(staffId: string, pin: string) {
		if (!pending) return;
		const target = pending;
		setPending(null);
		setError(null);
		setMessage(null);
		const fd = new FormData();
		fd.set("slug", slug);
		fd.set("staffId", staffId);
		fd.set("pin", pin);
		fd.set("itemId", target.itemId);
		fd.set("soldOut", target.soldOut);
		startTransition(async () => {
			const result = await staffSetSoldOutAction(fd);
			if (result && "error" in result) {
				setError(result.error);
				return;
			}
			setMessage(
				target.soldOut === "today"
					? `${target.name} is sold out until tomorrow.`
					: `${target.name} is back on the menu.`,
			);
			router.refresh();
		});
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
			>
				<Utensils className="size-4" aria-hidden="true" />
				Menu
				{soldOutCount > 0 ? (
					<span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-black text-white">
						{soldOutCount} sold out
					</span>
				) : null}
			</button>

			{/* Steps aside while the PIN prompt (its own dialog) is up, then returns. */}
			{open && !pending ? (
				<Dialog
					open
					onOpenChange={(next) => {
						if (!next) setOpen(false);
					}}
					size="md"
				>
					<DialogHeader title="Menu availability" />
					<DialogBody>
						<p className="text-sm font-medium text-slate-600">
							Ran out of something? Mark it sold out and customers can&apos;t
							order it until tomorrow.
						</p>
						<MenuSearchInput
							value={query}
							onChange={setQuery}
							className="mt-3"
						/>
						{message ? (
							<p
								role="status"
								className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800"
							>
								{message}
							</p>
						) : null}
						{error ? (
							<p
								role="alert"
								className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700"
							>
								{error}
							</p>
						) : null}
						<div className="mt-3 grid max-h-[55vh] gap-4 overflow-y-auto pr-1">
							{filtered.length === 0 ? (
								<p className="py-6 text-center text-sm font-medium text-slate-500">
									{query ? "No dishes match." : "No published dishes."}
								</p>
							) : (
								filtered.map((category) => (
									<section key={category.id}>
										<h3 className="text-xs font-black uppercase tracking-wide text-slate-500">
											{category.name}
										</h3>
										<ul className="mt-1.5 grid divide-y divide-slate-100 rounded-xl border border-slate-100">
											{category.items.map((item) => (
												<li
													key={item.id}
													className="flex items-center justify-between gap-3 px-3 py-2"
												>
													<span
														className={cn(
															"min-w-0 truncate text-sm font-bold",
															item.soldOut
																? "text-slate-400 line-through"
																: "text-slate-900",
														)}
													>
														{item.name}
													</span>
													<button
														type="button"
														disabled={isSaving}
														onClick={() =>
															setPending({
																itemId: item.id,
																name: item.name,
																soldOut: item.soldOut ? "off" : "today",
															})
														}
														className={cn(
															"min-h-9 shrink-0 rounded-lg px-3 text-xs font-black disabled:opacity-50",
															item.soldOut
																? "bg-emerald-700 text-white hover:bg-emerald-800"
																: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
														)}
													>
														{item.soldOut ? "Back in stock" : "Mark sold out"}
													</button>
												</li>
											))}
										</ul>
									</section>
								))
							)}
						</div>
					</DialogBody>
				</Dialog>
			) : null}

			{pending ? (
				<PinPromptModal onPinEnter={submit} onClose={() => setPending(null)} />
			) : null}
		</>
	);
}
