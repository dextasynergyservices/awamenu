import { Phone, Store } from "lucide-react";
import Image from "next/image";

/**
 * Shown to customers when a restaurant can't be used: suspended by AwaMenu,
 * or (with `kind="bookings"`) when table bookings are paused. Never a 404 — a
 * printed QR code on a table should always land somewhere that makes sense.
 */
export function RestaurantUnavailable({
	name,
	logoUrl,
	phone,
	title,
	message,
	backHref,
}: {
	name: string;
	logoUrl?: string | null;
	phone?: string | null;
	title?: string;
	message?: string;
	/** e.g. back to the menu from the bookings page. */
	backHref?: string;
}) {
	return (
		<main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
			{logoUrl ? (
				<Image
					src={logoUrl}
					alt=""
					width={64}
					height={64}
					className="mb-6 size-16 rounded-2xl object-cover"
					unoptimized
				/>
			) : (
				<span className="mb-6 grid size-16 place-items-center rounded-2xl bg-slate-200 text-slate-500">
					<Store className="size-8" aria-hidden="true" />
				</span>
			)}
			<h1 className="text-2xl font-black text-slate-950 sm:text-3xl">
				{title ?? `${name} is temporarily unavailable`}
			</h1>
			<p className="mt-3 max-w-md text-sm font-medium leading-6 text-slate-600 sm:text-base">
				{message ??
					"This restaurant's online menu is offline for now. Please check back later or contact the restaurant directly."}
			</p>
			<div className="mt-6 flex flex-wrap justify-center gap-2">
				{phone ? (
					<a
						href={`tel:${phone.replace(/\s+/g, "")}`}
						className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white"
					>
						<Phone className="size-4" aria-hidden="true" />
						Call {name}
					</a>
				) : null}
				{backHref ? (
					<a
						href={backHref}
						className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
					>
						View the menu
					</a>
				) : null}
			</div>
		</main>
	);
}
