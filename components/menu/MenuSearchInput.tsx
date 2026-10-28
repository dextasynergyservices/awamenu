"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function MenuSearchInput({
	value,
	onChange,
	className,
}: {
	value: string;
	onChange: (value: string) => void;
	className?: string;
}) {
	return (
		<div className={cn("relative", className)}>
			<label htmlFor="menu-search" className="sr-only">
				Search the menu
			</label>
			<Search
				className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400"
				aria-hidden="true"
			/>
			<input
				id="menu-search"
				type="search"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Search the menu"
				autoComplete="off"
				enterKeyHint="search"
				className="h-11 w-full rounded-full border border-slate-200 bg-white pr-10 pl-10 text-base font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 md:text-sm [&::-webkit-search-cancel-button]:hidden"
			/>
			{value ? (
				<button
					type="button"
					onClick={() => onChange("")}
					className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
					aria-label="Clear search"
				>
					<X className="size-4" aria-hidden="true" />
				</button>
			) : null}
		</div>
	);
}
