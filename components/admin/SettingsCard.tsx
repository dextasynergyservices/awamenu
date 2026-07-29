"use client";

import { ChevronRight, X } from "lucide-react";
import { useState } from "react";

interface SettingsCardProps {
	icon: React.ElementType;
	title: string;
	description: string;
	headerAction?: React.ReactNode;
	children: React.ReactNode;
}

export function SettingsCard({
	icon: Icon,
	title,
	description,
	headerAction,
	children,
}: SettingsCardProps) {
	const [isModalOpen, setIsModalOpen] = useState(false);

	return (
		<>
			<div className="min-w-0 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.03)]">
				{/* A real <button> can't be used here — `headerAction` may render
				    its own interactive elements (e.g. a button), and buttons
				    can't contain nested interactive content. */}
				{/* biome-ignore lint/a11y/useSemanticElements: can't be a <button> — headerAction may render its own nested button */}
				<div
					role="button"
					tabIndex={0}
					className="flex cursor-pointer items-center justify-between border-b border-slate-100 p-2.5 sm:p-4 transition-colors hover:bg-slate-50 md:cursor-default md:p-5 md:hover:bg-transparent"
					onClick={() => {
						if (window.innerWidth < 768) setIsModalOpen(true);
					}}
					onKeyDown={(event) => {
						if (
							(event.key === "Enter" || event.key === " ") &&
							window.innerWidth < 768
						) {
							event.preventDefault();
							setIsModalOpen(true);
						}
					}}
				>
					<div className="flex items-center gap-2.5 sm:gap-3">
						<div className="grid size-8 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700 sm:size-10 md:size-10">
							<Icon className="size-3.5 sm:size-5 md:size-5" />
						</div>
						<div className="min-w-0">
							<h2 className="text-sm font-bold text-slate-950 sm:text-base md:text-lg">
								{title}
							</h2>
							<p className="mt-0.5 text-xs font-medium text-slate-500 line-clamp-1 sm:text-xs md:text-sm md:line-clamp-none">
								{description}
							</p>
						</div>
					</div>
					<div className="flex items-center">
						{headerAction && (
							<div className="hidden md:block">{headerAction}</div>
						)}
						<ChevronRight className="ml-2 size-3.5 text-slate-400 md:hidden" />
					</div>
				</div>

				<div className="hidden p-4 md:block md:p-5">{children}</div>
			</div>

			{/* Mobile Bottom Sheet Modal */}
			{isModalOpen && (
				<div className="fixed inset-0 z-50 flex flex-col bg-white md:hidden animate-in slide-in-from-bottom-full duration-200">
					<div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 shadow-sm">
						<div className="flex items-center gap-2.5">
							<div className="grid size-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
								<Icon className="size-4" />
							</div>
							<div>
								<h2 className="text-sm font-black text-slate-950">{title}</h2>
							</div>
						</div>
						<button
							type="button"
							onClick={() => setIsModalOpen(false)}
							className="grid size-8 place-items-center rounded-full text-slate-400 hover:bg-slate-50 hover:text-slate-600"
						>
							<X className="size-5" />
						</button>
					</div>
					<div className="flex-1 overflow-y-auto p-4 bg-slate-50/50 pb-24">
						{headerAction && (
							<div className="mb-4 flex justify-end">{headerAction}</div>
						)}
						{children}
					</div>
				</div>
			)}
		</>
	);
}
