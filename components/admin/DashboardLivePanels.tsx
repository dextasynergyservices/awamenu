import {
	CalendarDays,
	ChefHat,
	ChevronRight,
	Clock,
	ImageOff,
	PackageCheck,
	Star,
	Utensils,
} from "lucide-react";
import Link from "next/link";
import { formatInTimeZone } from "@/lib/zoned-time";

/**
 * Owner home panels about *now*: open or closed, the kitchen pipeline,
 * today's bookings, the latest reviews and menu health. Server components.
 */

const card =
	"min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-5";

export function RightNowPanel({
	base,
	open,
	pipeline,
}: {
	base: string;
	open: { isOpen: boolean; label: string };
	pipeline: { pending: number; preparing: number; ready: number };
}) {
	const stages = [
		{
			key: "pending",
			label: "To accept",
			count: pipeline.pending,
			icon: Clock,
			status: "PENDING_APPROVAL",
			tone: "bg-amber-50 text-amber-800",
		},
		{
			key: "preparing",
			label: "In the kitchen",
			count: pipeline.preparing,
			icon: ChefHat,
			status: null,
			tone: "bg-blue-50 text-blue-700",
		},
		{
			key: "ready",
			label: "Ready",
			count: pipeline.ready,
			icon: PackageCheck,
			status: "READY",
			tone: "bg-emerald-50 text-emerald-700",
		},
	];
	return (
		<section className={card}>
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-sm font-black text-slate-950 sm:text-lg">
					Right now
				</h3>
				<span
					className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
						open.isOpen
							? "bg-emerald-50 text-emerald-700"
							: "bg-slate-100 text-slate-600"
					}`}
				>
					<span
						className={`size-2 rounded-full ${open.isOpen ? "bg-emerald-500" : "bg-slate-400"}`}
					/>
					{open.isOpen ? open.label : `Closed · ${open.label}`}
				</span>
			</div>
			<ul className="mt-4 grid grid-cols-3 gap-2">
				{stages.map((s) => {
					const Icon = s.icon;
					return (
						<li key={s.key}>
							<Link
								href={
									s.status
										? `${base}/orders?status=${s.status}`
										: `${base}/orders`
								}
								className="grid gap-1 rounded-2xl border border-slate-100 p-3 transition-colors hover:bg-slate-50"
							>
								<span
									className={`grid size-8 place-items-center rounded-lg ${s.tone}`}
								>
									<Icon className="size-4" aria-hidden="true" />
								</span>
								<span className="text-2xl font-black text-slate-950">
									{s.count}
								</span>
								<span className="text-xs font-bold text-slate-500">
									{s.label}
								</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</section>
	);
}

export function TodaysBookingsPanel({
	base,
	timeZone,
	enabled,
	bookings,
}: {
	base: string;
	timeZone: string;
	enabled: boolean;
	bookings: Array<{
		id: string;
		customerName: string;
		partySize: number;
		startsAt: Date;
		status: string;
		table: string;
	}>;
}) {
	return (
		<section className={card}>
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-sm font-black text-slate-950 sm:text-lg">
					Today&apos;s bookings
				</h3>
				<Link
					href={`${base}/reservations`}
					className="text-xs font-black text-emerald-700 sm:text-sm"
				>
					View all
				</Link>
			</div>
			{!enabled ? (
				<p className="mt-4 text-sm font-medium text-slate-500">
					Table bookings are off.{" "}
					<Link
						href={`${base}/reservations/tables`}
						className="font-bold text-emerald-700"
					>
						Turn them on
					</Link>
				</p>
			) : bookings.length === 0 ? (
				<p className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-500">
					<CalendarDays className="size-4 text-slate-400" aria-hidden="true" />
					No bookings for the rest of today.
				</p>
			) : (
				<ul className="mt-3 divide-y divide-slate-100">
					{bookings.map((b) => (
						<li
							key={b.id}
							className="flex items-center justify-between gap-3 py-2.5"
						>
							<div className="min-w-0">
								<p className="truncate text-sm font-bold text-slate-900">
									{b.customerName}
								</p>
								<p className="text-xs font-medium text-slate-500">
									{b.partySize} guest{b.partySize === 1 ? "" : "s"} · {b.table}
								</p>
							</div>
							<div className="shrink-0 text-right">
								<p className="text-sm font-black text-slate-950">
									{formatInTimeZone(b.startsAt, timeZone, {
										hour: "numeric",
										minute: "2-digit",
									})}
								</p>
								<p className="text-[11px] font-bold text-slate-500">
									{b.status === "PENDING_APPROVAL"
										? "Needs approval"
										: b.status === "APPROVED"
											? "Awaiting payment"
											: b.status === "CHECKED_IN"
												? "Seated"
												: "Confirmed"}
								</p>
							</div>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}

export function LatestReviewsPanel({
	base,
	average,
	reviews,
}: {
	base: string;
	/** Last 30 days. */
	average: number | null;
	reviews: Array<{
		id: string;
		rating: number;
		comment: string | null;
		name: string | null;
		createdAt: Date;
	}>;
}) {
	return (
		<section className={card}>
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-sm font-black text-slate-950 sm:text-lg">
					Latest reviews
				</h3>
				{average !== null ? (
					<span className="inline-flex items-center gap-1 text-sm font-black text-slate-950">
						<Star
							className="size-4 fill-amber-400 text-amber-400"
							aria-hidden="true"
						/>
						{average.toFixed(1)}
						<span className="text-xs font-semibold text-slate-400">
							30 days
						</span>
					</span>
				) : null}
			</div>
			{reviews.length === 0 ? (
				<p className="mt-4 text-sm font-medium text-slate-500">
					No reviews yet. Customers are asked to rate after their order.
				</p>
			) : (
				<ul className="mt-3 grid gap-3">
					{reviews.map((r) => (
						<li key={r.id} className="rounded-2xl bg-slate-50 p-3">
							<div className="flex items-center justify-between gap-2">
								<span
									className="flex gap-0.5"
									role="img"
									aria-label={`${r.rating} out of 5 stars`}
								>
									{[1, 2, 3, 4, 5].map((n) => (
										<Star
											key={n}
											className={`size-3.5 ${n <= r.rating ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
											aria-hidden="true"
										/>
									))}
								</span>
								<span className="text-[11px] font-semibold text-slate-400">
									{r.createdAt.toLocaleDateString("en-GB", {
										day: "numeric",
										month: "short",
									})}
								</span>
							</div>
							{r.comment ? (
								<p className="mt-1.5 line-clamp-2 text-sm text-slate-700">
									&ldquo;{r.comment}&rdquo;
								</p>
							) : null}
							<p className="mt-1 text-xs font-bold text-slate-500">
								{r.name ?? "Guest"}
							</p>
						</li>
					))}
				</ul>
			)}
			<Link
				href={`${base}/analytics`}
				className="mt-3 inline-block text-xs font-black text-emerald-700"
			>
				Review breakdown in Analytics
			</Link>
		</section>
	);
}

export function MenuHealthPanel({
	base,
	health,
}: {
	base: string;
	health: {
		published: number;
		noPhoto: number;
		soldOut: number;
		drafts: number;
	};
}) {
	const rows = [
		{
			label: "Published dishes",
			value: health.published,
			icon: Utensils,
			warn: health.published === 0,
		},
		{
			label: "Without a photo",
			value: health.noPhoto,
			icon: ImageOff,
			warn: health.noPhoto > 0,
		},
		{
			label: "Sold out today",
			value: health.soldOut,
			icon: PackageCheck,
			warn: false,
		},
		{
			label: "Drafts (hidden)",
			value: health.drafts,
			icon: Clock,
			warn: false,
		},
	];
	return (
		<section className={card}>
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-sm font-black text-slate-950 sm:text-lg">
					Menu health
				</h3>
				<Link
					href={`${base}/menu`}
					className="text-xs font-black text-emerald-700 sm:text-sm"
				>
					Edit menu
				</Link>
			</div>
			<ul className="mt-3 divide-y divide-slate-100">
				{rows.map((r) => {
					const Icon = r.icon;
					return (
						<li
							key={r.label}
							className="flex items-center justify-between gap-3 py-2.5"
						>
							<span className="flex items-center gap-2 text-sm font-bold text-slate-700">
								<Icon
									className={`size-4 ${r.warn ? "text-amber-600" : "text-slate-400"}`}
									aria-hidden="true"
								/>
								{r.label}
							</span>
							<span
								className={`text-sm font-black ${r.warn ? "text-amber-700" : "text-slate-950"}`}
							>
								{r.value}
							</span>
						</li>
					);
				})}
			</ul>
			{health.noPhoto > 0 ? (
				<p className="mt-2 flex items-center gap-1 text-xs font-medium text-slate-500">
					Dishes with photos usually sell better.
					<ChevronRight className="size-3" aria-hidden="true" />
				</p>
			) : null}
		</section>
	);
}
