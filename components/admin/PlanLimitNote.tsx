import { ArrowRight, Info } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Shown next to an "Add …" control once the plan's limit is reached, so the
 * owner sees why it's unavailable right where they tried, and how to get more.
 * Informational on purpose: hitting a plan limit isn't an error.
 */
export function PlanLimitNote({
	slug,
	planName,
	max,
	noun,
	className,
}: {
	slug: string;
	planName: string;
	max: number;
	/** Singular and plural, e.g. ["category", "categories"]. */
	noun: [string, string];
	className?: string;
}) {
	return (
		<div
			role="note"
			className={cn(
				"flex items-start gap-2.5 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-xs text-sky-900",
				className,
			)}
		>
			<Info
				className="mt-0.5 size-4 shrink-0 text-sky-600"
				aria-hidden="true"
			/>
			<p className="min-w-0 font-medium">
				Your {planName} plan includes {max} {max === 1 ? noun[0] : noun[1]}.{" "}
				<Link
					href={`/dashboard/${slug}/billing`}
					className="inline-flex items-center gap-1 font-black text-sky-700 underline-offset-2 hover:underline"
				>
					Upgrade to add more
					<ArrowRight className="size-3.5" aria-hidden="true" />
				</Link>
			</p>
		</div>
	);
}
