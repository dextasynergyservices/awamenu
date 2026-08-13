"use client";

import { Clock, Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { saveOpeningHoursAction } from "@/actions/restaurant.actions";
import { SettingsCard } from "@/components/admin/SettingsCard";
import { DAY_LABELS } from "@/lib/opening-hours";

type Period = { dayOfWeek: number; opensAt: string; closesAt: string };

/** Client-side identity so removing a row doesn't shuffle React's state onto
 * the wrong input — an array index would. Never persisted. */
type Row = Period & { key: string };

let nextKey = 0;
const makeKey = () => `row-${nextKey++}`;

/**
 * Day-by-day opening hours.
 *
 * Each day holds a list rather than one open/close pair, because a kitchen
 * that shuts between lunch and dinner needs two periods on the same day — the
 * single-pair-per-day shortcut can't express that and is hard to undo later.
 */
export function OpeningHoursEditor({
	slug,
	timezone,
	initial,
}: {
	slug: string;
	timezone: string;
	initial: Period[];
}) {
	const [periods, setPeriods] = useState<Row[]>(() =>
		initial.map((period) => ({ ...period, key: makeKey() })),
	);
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	function update(index: number, patch: Partial<Period>) {
		setSaved(false);
		setPeriods((current) =>
			current.map((period, i) =>
				i === index ? { ...period, ...patch } : period,
			),
		);
	}

	function addPeriod(dayOfWeek: number) {
		setSaved(false);
		setPeriods((current) => [
			...current,
			{ dayOfWeek, opensAt: "09:00", closesAt: "17:00", key: makeKey() },
		]);
	}

	function removePeriod(index: number) {
		setSaved(false);
		setPeriods((current) => current.filter((_, i) => i !== index));
	}

	function save() {
		setError(null);
		setSaved(false);
		startTransition(async () => {
			const result = await saveOpeningHoursAction({
				slug,
				periods: periods.map(({ key: _key, ...period }) => period),
			});
			if ("error" in result) setError(result.error);
			else setSaved(true);
		});
	}

	return (
		<SettingsCard
			title="Opening Hours"
			anchorId="hours"
			description="Shows customers whether you're open right now."
			icon={Clock}
		>
			<div className="grid min-w-0 gap-3">
				<p className="text-xs font-medium leading-5 text-slate-500">
					Times are in your restaurant&apos;s timezone ({timezone}). A closing
					time earlier than the opening time means you close after midnight —
					6:00 PM to 2:00 AM is one period, not two. Leave a day empty to show
					as closed.
				</p>

				{DAY_LABELS.map((label, dayOfWeek) => {
					const dayPeriods = periods
						.map((period, index) => ({ period, index }))
						.filter(({ period }) => period.dayOfWeek === dayOfWeek);

					return (
						<div
							key={label}
							className="min-w-0 rounded-xl border border-slate-200 p-3"
						>
							<div className="flex flex-wrap items-center justify-between gap-2">
								<p className="text-sm font-black text-slate-900">{label}</p>
								<button
									type="button"
									onClick={() => addPeriod(dayOfWeek)}
									className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 hover:underline"
								>
									<Plus className="size-3.5" aria-hidden="true" />
									Add hours
								</button>
							</div>

							{dayPeriods.length === 0 ? (
								<p className="mt-1 text-xs font-medium text-slate-400">
									Closed all day
								</p>
							) : (
								<div className="mt-2 grid gap-2">
									{dayPeriods.map(({ period, index }) => (
										<div
											key={period.key}
											className="flex min-w-0 flex-wrap items-center gap-2"
										>
											<input
												type="time"
												value={period.opensAt}
												onChange={(event) =>
													update(index, { opensAt: event.target.value })
												}
												aria-label={`${label} opening time`}
												className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 sm:text-sm"
											/>
											<span className="text-xs font-bold text-slate-400">
												to
											</span>
											<input
												type="time"
												value={period.closesAt}
												onChange={(event) =>
													update(index, { closesAt: event.target.value })
												}
												aria-label={`${label} closing time`}
												className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 sm:text-sm"
											/>
											<button
												type="button"
												onClick={() => removePeriod(index)}
												aria-label={`Remove ${label} hours`}
												className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-red-600"
											>
												<X className="size-4" aria-hidden="true" />
											</button>
										</div>
									))}
								</div>
							)}
						</div>
					);
				})}

				{error ? (
					<p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
						{error}
					</p>
				) : null}
				{saved ? (
					<p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
						Opening hours saved.
					</p>
				) : null}

				<button
					type="button"
					onClick={save}
					disabled={isPending}
					className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-50 sm:w-auto sm:justify-self-start"
				>
					{isPending ? "Saving…" : "Save opening hours"}
				</button>
			</div>
		</SettingsCard>
	);
}
