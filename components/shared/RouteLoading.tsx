import Image from "next/image";
import { FlipText } from "@/components/ui/FlipText";
import { LOGO_ICON_URL, LOGO_LOADING_URL } from "@/lib/logo";

type RouteLoadingProps = {
	/** "page" — full-screen premium brand loader (public customer routes,
	 *  and any route segment's own layout-level data fetch).
	 *  "panel" — fits inside an existing dashboard/staff/admin shell. */
	variant?: "page" | "panel";
};

/**
 * Shared route-level loading UI. Each route's `loading.tsx` is a thin
 * wrapper around this so the fallback UI stays visually consistent across
 * the app instead of every route hand-rolling its own.
 */
export function RouteLoading({ variant = "page" }: RouteLoadingProps) {
	const skeleton = (
		<div className="mx-auto max-w-lg animate-pulse space-y-4">
			<div className="h-7 w-2/3 rounded-xl bg-slate-200" />
			<div className="h-36 rounded-3xl border border-slate-100 bg-white shadow-sm" />
			<div className="h-24 rounded-3xl border border-slate-100 bg-white shadow-sm" />
			<div className="h-24 rounded-3xl border border-slate-100 bg-white shadow-sm" />
		</div>
	);

	if (variant === "panel") {
		return (
			<div className="py-6">
				<div className="mx-auto mb-6 flex max-w-lg items-center justify-center gap-2">
					<Image
						src={LOGO_ICON_URL}
						alt="AwaMenu"
						width={24}
						height={24}
						className="size-6 shrink-0 rounded-md object-contain"
						priority
					/>
					<FlipText
						className="text-sm font-black tracking-tight text-emerald-800"
						duration={0.9}
					>
						Loading
					</FlipText>
				</div>
				{skeleton}
			</div>
		);
	}

	return (
		<main className="grid min-h-screen place-items-center bg-[#f6faf7] px-4">
			<div className="flex flex-col items-center gap-5">
				<Image
					src={LOGO_LOADING_URL}
					alt="AwaMenu"
					width={220}
					height={51}
					className="h-11 w-auto drop-shadow-[0_16px_40px_rgba(6,78,59,0.14)] sm:h-14"
					priority
				/>
				<FlipText
					className="text-sm font-black uppercase tracking-[0.2em] text-emerald-700"
					duration={0.9}
				>
					Loading
				</FlipText>
			</div>
		</main>
	);
}
