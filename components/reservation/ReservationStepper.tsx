"use client";

import { ArrowLeft, Check } from "lucide-react";

export type ReservationStep = 1 | 2 | 3 | 4;

export type StepDefinition = {
	id: ReservationStep;
	label: string;
	/** Short label for the compact mobile rail. */
	short: string;
};

/**
 * Progress across the booking steps.
 *
 * The page previously showed everything at once on mobile and a two-step
 * wizard on desktop, from the same markup — so the two behaved like different
 * products. One flow, one state, rendered at whatever width.
 *
 * Steps are numbered because the order carries real meaning: party size and
 * time decide which tables are available, so they genuinely come first. The
 * old page asked for date and time last-but-one, after a table had already
 * been chosen against them.
 */
export function ReservationStepper({
	steps,
	current,
	furthest,
	onSelect,
}: {
	steps: StepDefinition[];
	current: ReservationStep;
	/** The highest step reached, so completed ones stay clickable. */
	furthest: ReservationStep;
	onSelect: (step: ReservationStep) => void;
}) {
	return (
		<nav aria-label="Booking steps" className="min-w-0">
			<ol className="flex min-w-0 items-center gap-1.5 sm:gap-2">
				{steps.map((step, index) => {
					const done = step.id < furthest;
					const active = step.id === current;
					const reachable = step.id <= furthest;

					return (
						<li
							key={step.id}
							className="flex min-w-0 flex-1 items-center gap-1.5"
						>
							<button
								type="button"
								onClick={() => reachable && onSelect(step.id)}
								disabled={!reachable}
								aria-current={active ? "step" : undefined}
								className="group flex min-w-0 flex-1 flex-col gap-1.5 text-left disabled:cursor-default"
							>
								{/* A bar rather than a numbered circle: it doubles as the
								    progress track, which is what someone mid-booking on a
								    phone actually wants to know. */}
								<span
									className={`h-1.5 w-full rounded-full transition-colors ${
										active
											? "bg-emerald-700"
											: done
												? "bg-emerald-300"
												: "bg-slate-200"
									}`}
								/>
								<span className="flex min-w-0 items-center gap-1">
									{done ? (
										<Check
											className="size-3 shrink-0 text-emerald-600"
											aria-hidden="true"
										/>
									) : (
										<span
											className={`text-[11px] font-black tabular-nums ${
												active ? "text-emerald-700" : "text-slate-400"
											}`}
										>
											{index + 1}
										</span>
									)}
									<span
										className={`truncate text-[11px] font-black uppercase tracking-wide ${
											active
												? "text-emerald-700"
												: done
													? "text-slate-500"
													: "text-slate-400"
										}`}
									>
										<span className="sm:hidden">{step.short}</span>
										<span className="hidden sm:inline">{step.label}</span>
									</span>
								</span>
							</button>
						</li>
					);
				})}
			</ol>
		</nav>
	);
}

/**
 * The sticky action bar.
 *
 * Fixed to the bottom on mobile so the next action is always in reach without
 * scrolling to find it, and the blocked reason sits directly above the button
 * rather than somewhere up the page.
 */
export function ReservationStepActions({
	onBack,
	onNext,
	nextLabel,
	nextDisabled,
	blockedReason,
	showBack,
	children,
}: {
	onBack: () => void;
	onNext?: () => void;
	nextLabel: string;
	nextDisabled?: boolean;
	blockedReason?: string | null;
	showBack: boolean;
	/** Submit button on the final step, in place of the Next button. */
	children?: React.ReactNode;
}) {
	return (
		<div className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-slate-100 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:px-4 lg:static lg:mt-6">
			{blockedReason ? (
				<p className="mb-2 text-center text-xs font-bold text-amber-700">
					{blockedReason}
				</p>
			) : null}
			<div className="flex min-w-0 items-center gap-2">
				{showBack ? (
					<button
						type="button"
						onClick={onBack}
						className="inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50"
					>
						<ArrowLeft className="size-4" aria-hidden="true" />
						<span className="hidden sm:inline">Back</span>
					</button>
				) : null}

				{children ?? (
					<button
						type="button"
						onClick={onNext}
						disabled={nextDisabled}
						className="inline-flex min-h-12 min-w-0 flex-1 items-center justify-center rounded-2xl bg-emerald-700 px-5 text-sm font-black text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
					>
						{nextLabel}
					</button>
				)}
			</div>
		</div>
	);
}
