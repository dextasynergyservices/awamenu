"use client";

import { CalendarOff, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
	addBlackoutDateAction,
	removeBlackoutDateAction,
} from "@/actions/reservation.actions";

type Blackout = { date: string; reason: string | null };

/**
 * One-off closures.
 *
 * Opening hours describe the repeating week and cannot say "closed on the
 * 25th". Without this a restaurant has to switch reservations off entirely for
 * a single day — and remember to switch them back, which is the part that
 * goes wrong.
 */
export function BlackoutDatesEditor({
	slug,
	dates,
}: {
	slug: string;
	dates: Blackout[];
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [date, setDate] = useState("");
	const [reason, setReason] = useState("");
	const [error, setError] = useState<string | null>(null);

	const today = new Date().toISOString().slice(0, 10);

	function add() {
		if (!date) return;
		setError(null);
		startTransition(async () => {
			const result = await addBlackoutDateAction({ slug, date, reason });
			if ("error" in result) {
				setError(result.error);
				return;
			}
			setDate("");
			setReason("");
			router.refresh();
		});
	}

	function remove(value: string) {
		setError(null);
		startTransition(async () => {
			const result = await removeBlackoutDateAction({ slug, date: value });
			if ("error" in result) setError(result.error);
			else router.refresh();
		});
	}

	// Past closures are noise once they've been and gone.
	const upcoming = dates
		.filter((entry) => entry.date >= today)
		.sort((a, b) => a.date.localeCompare(b.date));

	return (
		<div className="grid min-w-0 gap-3">
			<div>
				<p className="flex items-center gap-2 text-sm font-black text-slate-900">
					<CalendarOff className="size-4 text-slate-500" aria-hidden="true" />
					Closed dates
				</p>
				<p className="mt-1 text-xs font-medium leading-5 text-slate-500">
					Block a single day — a holiday, a private event. Customers can&apos;t
					book it, and the reason is shown if you give one.
				</p>
			</div>

			<div className="flex min-w-0 flex-wrap items-end gap-2">
				<label className="min-w-0 flex-1">
					<span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
						Date
					</span>
					<input
						type="date"
						value={date}
						min={today}
						onChange={(event) => setDate(event.target.value)}
						className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 sm:text-sm"
					/>
				</label>
				<label className="min-w-0 flex-[2]">
					<span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">
						Reason (optional)
					</span>
					<input
						type="text"
						value={reason}
						maxLength={120}
						placeholder="Christmas Day"
						onChange={(event) => setReason(event.target.value)}
						className="min-h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 sm:text-sm"
					/>
				</label>
				<button
					type="button"
					onClick={add}
					disabled={!date || isPending}
					className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-xs font-black text-white disabled:opacity-50"
				>
					<Plus className="size-3.5" aria-hidden="true" />
					Add
				</button>
			</div>

			{error ? (
				<p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
					{error}
				</p>
			) : null}

			{upcoming.length === 0 ? (
				<p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
					No closed dates coming up.
				</p>
			) : (
				<ul className="grid gap-2">
					{upcoming.map((entry) => (
						<li
							key={entry.date}
							className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2"
						>
							<span className="min-w-0">
								<span className="block text-sm font-black text-slate-900">
									{new Date(`${entry.date}T00:00:00`).toLocaleDateString(
										"en-GB",
										{ weekday: "short", day: "numeric", month: "long" },
									)}
								</span>
								{entry.reason ? (
									<span className="block truncate text-xs font-medium text-slate-500">
										{entry.reason}
									</span>
								) : null}
							</span>
							<button
								type="button"
								onClick={() => remove(entry.date)}
								disabled={isPending}
								aria-label={`Remove ${entry.date}`}
								className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-red-600 disabled:opacity-50"
							>
								<X className="size-4" aria-hidden="true" />
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
