import Image from "next/image";
import { CustomerAccountDrawer } from "@/components/menu/CustomerAccountDrawer";
import { cn } from "@/lib/utils";

type PublicMenuNavbarProps = {
	name: string;
	logoUrl: string | null;
	mode: "mobile" | "desktop";
	restaurantSlug: string;
};

export function PublicMenuNavbar({
	name,
	logoUrl,
	mode,
	restaurantSlug,
}: PublicMenuNavbarProps) {
	if (mode === "mobile") {
		return (
			<header className="bg-[radial-gradient(circle_at_15%_0%,#0b6b4b_0,#003f2f_40%,#002d25_100%)] text-white md:hidden">
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
								<h1 className="truncate text-xl font-semibold md:text-3xl">
									{name}
								</h1>
								<p className="mt-1 flex items-center gap-2 text-sm font-semibold text-emerald-300 md:text-base">
									<span className="size-2.5 rounded-full bg-emerald-400" />
									Open now
								</p>
							</div>
						</div>
						<CustomerAccountDrawer restaurantSlug={restaurantSlug} />
					</div>
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
					<p className="inline-flex min-h-9 items-center gap-2 rounded-full bg-emerald-50 px-4 text-sm font-semibold text-emerald-700">
						<span className="size-2.5 rounded-full bg-emerald-500" />
						Open now
					</p>
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
