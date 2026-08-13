"use client";

import { ArrowRight, Check, ChevronDown, Rocket, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { dismissSetupChecklistAction } from "@/actions/restaurant.actions";
import type { SetupTask } from "@/lib/setup-checklist";

/**
 * What's left to do before the restaurant is properly open.
 *
 * A checklist rather than a guided tour: connecting a payout account needs a
 * bank account, branding needs a logo file, the menu needs photos and prices.
 * Nobody finishes that in one sitting, and an abandoned tour leaves the work
 * undone with nothing to show for it. This is still here tomorrow.
 *
 * Dismissing collapses it to a single line rather than deleting it — someone
 * who dismissed this in week one still needs to find it in week three.
 */
export function SetupChecklist({
	slug,
	tasks,
	dismissed,
}: {
	slug: string;
	tasks: SetupTask[];
	dismissed: boolean;
}) {
	const router = useRouter();
	const [collapsed, setCollapsed] = useState(dismissed);
	const [isPending, startTransition] = useTransition();

	const done = tasks.filter((task) => task.done).length;
	const total = tasks.length;

	// It removes itself once there's nothing left, with no congratulations.
	if (total === 0 || done === total) return null;

	const remaining = tasks.filter((task) => !task.done);
	const blocking = remaining.filter((task) => task.blocking);

	function dismiss() {
		setCollapsed(true);
		startTransition(async () => {
			await dismissSetupChecklistAction({ slug });
			router.refresh();
		});
	}

	if (collapsed) {
		return (
			<button
				type="button"
				onClick={() => setCollapsed(false)}
				className="mb-4 flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 text-left transition-colors hover:bg-slate-50"
			>
				<span className="flex min-w-0 items-center gap-2">
					<Rocket
						className="size-4 shrink-0 text-emerald-700"
						aria-hidden="true"
					/>
					<span className="truncate text-sm font-black text-slate-800">
						Setup {done} of {total}
					</span>
					{blocking.length > 0 ? (
						<span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-700">
							{blocking.length} needed to trade
						</span>
					) : null}
				</span>
				<ChevronDown
					className="size-4 shrink-0 text-slate-400"
					aria-hidden="true"
				/>
			</button>
		);
	}

	return (
		<section className="mb-5 min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
			<div className="flex min-w-0 items-start justify-between gap-3 border-b border-slate-100 p-4">
				<div className="flex min-w-0 items-start gap-3">
					<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
						<Rocket className="size-5" aria-hidden="true" />
					</span>
					<div className="min-w-0">
						<p className="font-black text-slate-950">Finish setting up</p>
						<p className="mt-0.5 text-xs font-medium leading-5 text-slate-500">
							{done} of {total} done
							{blocking.length > 0
								? ` · ${blocking.length} still needed before you can take orders`
								: " · the rest is polish"}
						</p>
					</div>
				</div>
				<button
					type="button"
					onClick={dismiss}
					disabled={isPending}
					aria-label="Collapse setup checklist"
					className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
				>
					<X className="size-4" aria-hidden="true" />
				</button>
			</div>

			{/* Progress as a bar, because "3 of 6" alone doesn't show how close
			    they are to being finished. */}
			<div className="h-1.5 w-full bg-slate-100">
				<div
					className="h-full rounded-r-full bg-emerald-600 transition-all duration-500"
					style={{ width: `${(done / total) * 100}%` }}
				/>
			</div>

			<ul className="divide-y divide-slate-100">
				{tasks.map((task) => (
					<li key={task.id} className="min-w-0">
						{task.done ? (
							<div className="flex min-w-0 items-center gap-3 px-4 py-3">
								<span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700">
									<Check className="size-3.5" aria-hidden="true" />
								</span>
								<span className="min-w-0 truncate text-sm font-bold text-slate-400 line-through">
									{task.label}
								</span>
							</div>
						) : (
							<Link
								href={task.href}
								className="flex min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
							>
								<span className="size-6 shrink-0 rounded-full border-2 border-slate-200" />
								<span className="min-w-0 flex-1">
									<span className="flex flex-wrap items-center gap-2">
										<span className="text-sm font-black text-slate-900">
											{task.label}
										</span>
										{task.blocking ? (
											<span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-700">
												Needed
											</span>
										) : null}
									</span>
									<span className="mt-0.5 block text-xs font-medium leading-5 text-slate-500">
										{task.why}
									</span>
								</span>
								<ArrowRight
									className="size-4 shrink-0 text-slate-300"
									aria-hidden="true"
								/>
							</Link>
						)}
					</li>
				))}
			</ul>
		</section>
	);
}
