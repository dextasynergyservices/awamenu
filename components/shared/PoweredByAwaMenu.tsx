import Image from "next/image";
import { LOGO_ICON_URL } from "@/lib/logo";

type PoweredByAwaMenuProps = {
	/** "footer" — bordered strip closing out a customer-facing page.
	 *  "inline" — bare centered line, for use inside an existing container
	 *  (loading screens, cards) that already provides its own spacing. */
	variant?: "footer" | "inline";
	className?: string;
};

/**
 * Attribution shown on customer-facing pages for restaurants whose plan
 * doesn't include `removeAwamenuBranding`.
 *
 * Callers must gate on `PlanFeatures.showAwamenuBranding` — this component
 * deliberately doesn't resolve the plan itself, so it stays usable from both
 * server pages and the client-side loading screen (which reads the flag from
 * `RestaurantBrandContext` rather than hitting the database).
 */
export function PoweredByAwaMenu({
	variant = "footer",
	className = "",
}: PoweredByAwaMenuProps) {
	const label = (
		<span className="inline-flex items-center gap-1.5">
			<Image
				src={LOGO_ICON_URL}
				alt=""
				width={16}
				height={16}
				className="size-4 shrink-0 rounded-[4px] object-contain"
				aria-hidden="true"
			/>
			<span>
				Powered by <span className="text-emerald-700">AwaMenu</span>
			</span>
		</span>
	);

	if (variant === "inline") {
		return (
			<p
				className={`text-center text-xs font-bold text-slate-400 ${className}`}
			>
				{label}
			</p>
		);
	}

	return (
		<footer
			className={`border-emerald-100 border-t bg-white px-4 py-6 text-center text-sm font-bold text-slate-500 ${className}`}
		>
			{label}
		</footer>
	);
}
