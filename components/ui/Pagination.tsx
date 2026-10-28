import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import {
	PAGE_SIZES,
	type PageInfo,
	pageWindow,
	withQuery,
} from "@/lib/pagination";
import { cn } from "@/lib/utils";

/**
 * "Showing 26–50 of 312", page numbers, and rows per page. Plain links, so it
 * works in server components and keeps every other filter in the URL.
 */
export function Pagination({
	info,
	basePath,
	query,
	noun = "results",
	className,
}: {
	info: PageInfo;
	basePath: string;
	query: Record<string, string | string[] | undefined>;
	noun?: string;
	className?: string;
}) {
	const href = (changes: Record<string, string | number | null>) =>
		withQuery(basePath, query, changes);
	const { page, pageCount } = info;
	const step =
		"inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-bold";

	if (info.total === 0) return null;

	return (
		<nav
			aria-label="Pagination"
			className={cn(
				"flex flex-wrap items-center justify-between gap-3 text-sm",
				className,
			)}
		>
			<p className="font-medium text-slate-500">
				Showing{" "}
				<span className="font-black text-slate-900">
					{info.from.toLocaleString()}–{info.to.toLocaleString()}
				</span>{" "}
				of{" "}
				<span className="font-black text-slate-900">
					{info.total.toLocaleString()}
				</span>{" "}
				{noun}
			</p>

			<div className="flex flex-wrap items-center gap-3">
				{pageCount > 1 ? (
					<div className="flex items-center gap-1">
						{page > 1 ? (
							<Link
								href={href({ page: page - 1 })}
								className={cn(step, "text-slate-600 hover:bg-slate-100")}
								aria-label="Previous page"
								rel="prev"
							>
								<ChevronLeft className="size-4" aria-hidden="true" />
							</Link>
						) : (
							<span className={cn(step, "text-slate-300")} aria-hidden="true">
								<ChevronLeft className="size-4" />
							</span>
						)}
						{pageWindow(page, pageCount).map((p, i) =>
							p === "gap" ? (
								<span
									// biome-ignore lint/suspicious/noArrayIndexKey: separators have no identity
									key={`gap-${i}`}
									className="px-1 text-slate-400"
								>
									…
								</span>
							) : (
								<Link
									key={p}
									href={href({ page: p })}
									aria-current={p === page ? "page" : undefined}
									className={cn(
										step,
										p === page
											? "bg-slate-900 text-white"
											: "text-slate-600 hover:bg-slate-100",
										// Phones show only the current page and the ends.
										p !== page &&
											p !== 1 &&
											p !== pageCount &&
											"hidden sm:inline-flex",
									)}
								>
									{p}
								</Link>
							),
						)}
						{page < pageCount ? (
							<Link
								href={href({ page: page + 1 })}
								className={cn(step, "text-slate-600 hover:bg-slate-100")}
								aria-label="Next page"
								rel="next"
							>
								<ChevronRight className="size-4" aria-hidden="true" />
							</Link>
						) : (
							<span className={cn(step, "text-slate-300")} aria-hidden="true">
								<ChevronRight className="size-4" />
							</span>
						)}
					</div>
				) : null}

				<div className="flex items-center gap-1 text-xs font-bold text-slate-500">
					<span className="hidden sm:inline">Per page</span>
					{PAGE_SIZES.map((size) => (
						<Link
							key={size}
							href={href({ size, page: null })}
							aria-current={size === info.pageSize ? "true" : undefined}
							className={cn(
								"rounded-md px-2 py-1",
								size === info.pageSize
									? "bg-slate-100 text-slate-900"
									: "hover:bg-slate-50",
							)}
						>
							{size}
						</Link>
					))}
				</div>
			</div>
		</nav>
	);
}
