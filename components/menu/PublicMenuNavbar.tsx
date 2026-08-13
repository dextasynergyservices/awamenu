import { CalendarDays } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { CustomerAccountDrawer } from "@/components/menu/CustomerAccountDrawer";
import { OpenStatusBadge } from "@/components/menu/OpenStatusBadge";
import type { OpeningPeriod, OpenState } from "@/lib/opening-hours";
import { cn } from "@/lib/utils";

type PublicMenuNavbarProps = {
	name: string;
	logoUrl: string | null;
	mode: "mobile" | "desktop";
	restaurantSlug: string;
	/** Computed server-side from the restaurant's own hours and timezone — see
	 * lib/opening-hours.ts. Absent means hours aren't configured. */
	openState?: OpenState;
	/** Passed through so the badge can re-evaluate itself on a timer rather
	 * than going stale on a page left open across closing time. */
	openingPeriods?: OpeningPeriod[];
	timezone?: string;
	/** Adds a reservation entry point. Desktop had none at all — the only
	 * link was a mobile-only floating bar. */
	reservationsEnabled?: boolean;
};

export function PublicMenuNavbar({
	name,
	logoUrl,
	mode,
	restaurantSlug,
	openState,
	openingPeriods,
	timezone,
	reservationsEnabled = false,
}: PublicMenuNavbarProps) {
	const status = openState ?? { isOpen: true, label: "Open now" };
	if (mode === "mobile") {
		return (
			<header className="bg-emerald-900 text-white md:hidden">
				<div className="mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-5">
					<div className="flex items-center justify-between gap-3">
						<div className="flex min-w-0 items-center gap-3">
							<RestaurantLogo
								name={name}
								logoUrl={logoUrl}
								className="size-12 rounded-2xl shadow-[0_14px_35px_rgba(0,0,0,0.18)] md:size-14"
								fallbackClassName="size-12 rounded-2xl text-xl shadow-[0_14px_35px_rgba(0,0,0,0.18)] md:size-14 md:text-2xl"
								size={56}
							/>
							<div className="min-w-0">
								<h1 className="truncate text-sm font-semibold md:text-3xl">
									{name}
								</h1>
								<OpenStatusBadge
									initial={status}
									periods={openingPeriods ?? []}
									timezone={timezone ?? "Africa/Lagos"}
									variant="mobile"
								/>
							</div>
						</div>
						<CustomerAccountDrawer restaurantSlug={restaurantSlug} />
					</div>
					{reservationsEnabled ? (
						<Link
							href={`/${restaurantSlug}/tables`}
							className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-white/10 text-sm font-black text-white backdrop-blur transition-colors hover:bg-white/20"
						>
							<CalendarDays className="size-4" aria-hidden="true" />
							Reserve a table
						</Link>
					) : null}
				</div>
			</header>
		);
	}

	return (
		<header className="sticky top-0 z-40 border-slate-200 border-b bg-white/95 px-4 py-3 backdrop-blur lg:px-6">
			<div className="flex items-center justify-between gap-4">
				<div className="flex min-w-0 items-center gap-3">
					<RestaurantLogo
						name={name}
						logoUrl={logoUrl}
						className="size-11 rounded-xl"
						fallbackClassName="size-11 rounded-xl text-lg"
						size={44}
					/>
					<p className="truncate text-xl font-semibold text-slate-950">
						{name}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-3">
					<OpenStatusBadge
						initial={status}
						periods={openingPeriods ?? []}
						timezone={timezone ?? "Africa/Lagos"}
						variant="desktop"
					/>
					{reservationsEnabled ? (
						<Link
							href={`/${restaurantSlug}/tables`}
							className="inline-flex min-h-9 items-center gap-2 rounded-full border border-emerald-700 px-4 text-sm font-black text-emerald-700 transition-colors hover:bg-emerald-50"
						>
							<CalendarDays className="size-4" aria-hidden="true" />
							Reserve a table
						</Link>
					) : null}
					<CustomerAccountDrawer restaurantSlug={restaurantSlug} />
				</div>
			</div>
		</header>
	);
}

function RestaurantLogo({
	name,
	logoUrl,
	className,
	fallbackClassName,
	size,
}: {
	name: string;
	logoUrl: string | null;
	className: string;
	fallbackClassName: string;
	size: number;
}) {
	if (logoUrl) {
		return (
			<Image
				src={logoUrl}
				alt={`${name} logo`}
				width={size}
				height={size}
				className={cn("object-cover", className)}
				unoptimized
			/>
		);
	}

	return (
		<div
			className={cn(
				"grid place-items-center bg-yellow-300 font-semibold text-emerald-950",
				fallbackClassName,
			)}
		>
			{name.charAt(0).toUpperCase()}
		</div>
	);
}
