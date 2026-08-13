"use client";

import { CalendarCheck, CalendarX, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleTableReservationsAction } from "@/actions/reservation.actions";

/**
 * Says plainly whether customers can book, and flips it in one click.
 *
 * The master switch was a checkbox labelled "Enabled" in the corner of a
 * collapsed settings panel. Restaurants added tables, saw them listed, and had
 * no idea nothing was published — the public menu simply never showed a
 * "Reserve a table" link and there was nothing anywhere to explain why.
 */
export function ReservationStatusBanner({
	slug,
	enabled,
	tableCount,
}: {
	slug: string;
	enabled: boolean;
	tableCount: number;
}) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function toggle() {
		setError(null);
		startTransition(async () => {
			const result = await toggleTableReservationsAction({
				slug,
				enabled: !enabled,
			});
			if ("error" in result) setError(result.error);
			else router.refresh();
		});
	}

	return (
		<div
			className={`min-w-0 rounded-2xl border p-4 ${
				enabled
					? "border-emerald-200 bg-emerald-50"
					: "border-amber-200 bg-amber-50"
			}`}
		>
			<div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
				<div className="flex min-w-0 items-start gap-3">
					<span
						className={`grid size-10 shrink-0 place-items-center rounded-xl ${
							enabled
								? "bg-emerald-100 text-emerald-700"
								: "bg-amber-100 text-amber-700"
						}`}
					>
						{enabled ? (
							<CalendarCheck className="size-5" aria-hidden="true" />
						) : (
							<CalendarX className="size-5" aria-hidden="true" />
						)}
					</span>
					<div className="min-w-0">
						<p
							className={`font-black ${
								enabled ? "text-emerald-900" : "text-amber-900"
							}`}
						>
							{enabled ? "Reservations are live" : "Customers can't book yet"}
						</p>
						<p className="mt-0.5 text-xs font-medium leading-5 text-slate-600">
							{enabled ? (
								<>
									A &ldquo;Reserve a table&rdquo; button shows on your menu, and{" "}
									{tableCount === 1 ? "1 table is" : `${tableCount} tables are`}{" "}
									bookable.
								</>
							) : tableCount === 0 ? (
								"Add a table below, then turn reservations on to publish them."
							) : (
								<>
									You have{" "}
									{tableCount === 1 ? "1 table" : `${tableCount} tables`} set
									up, but reservations are switched off — nothing appears on
									your public menu.
								</>
							)}
						</p>
						{error ? (
							<p className="mt-2 text-xs font-bold text-red-700">{error}</p>
						) : null}
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{enabled ? (
						<Link
							href={`/${slug}/tables`}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-emerald-300 px-3 text-xs font-black text-emerald-800 hover:bg-white"
						>
							<ExternalLink className="size-3.5" aria-hidden="true" />
							View booking page
						</Link>
					) : null}
					<button
						type="button"
						onClick={toggle}
						disabled={isPending}
						className={`inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-xs font-black text-white disabled:opacity-50 ${
							enabled ? "bg-slate-950" : "bg-emerald-700"
						}`}
					>
						{isPending
							? "Saving…"
							: enabled
								? "Turn off reservations"
								: "Turn on reservations"}
					</button>
				</div>
			</div>
		</div>
	);
}
