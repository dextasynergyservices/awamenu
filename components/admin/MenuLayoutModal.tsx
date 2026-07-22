"use client";

import { Lock, X } from "lucide-react";
import { useState } from "react";
import { updateRestaurantBrandingAction } from "@/actions/restaurant.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { cn } from "@/lib/utils";

type MenuTemplateId = "classic" | "grid" | "compact" | "magazine";

const templates: Array<{
	id: MenuTemplateId;
	name: string;
	description: string;
	level: number;
	requiredPlan: string;
}> = [
	{
		id: "classic",
		name: "Classic",
		description: "Row list with photo, name, and price.",
		level: 1,
		requiredPlan: "Free",
	},
	{
		id: "grid",
		name: "Grid",
		description: "2-column photo-forward card grid.",
		level: 2,
		requiredPlan: "Starter",
	},
	{
		id: "compact",
		name: "Compact",
		description: "Dense text list, no photos.",
		level: 3,
		requiredPlan: "Pro",
	},
	{
		id: "magazine",
		name: "Magazine",
		description: "Large hero-style photo cards.",
		level: 4,
		requiredPlan: "Pro",
	},
];

function planLevel(planTier: string) {
	if (planTier === "PRO") return 4;
	if (planTier === "STARTER") return 2;
	return 1;
}

function MenuLayoutPreview({ id }: { id: MenuTemplateId }) {
	if (id === "classic") {
		return (
			<div className="grid gap-1">
				{[0, 1].map((row) => (
					<div key={row} className="flex items-center gap-1">
						<span className="size-3 shrink-0 rounded-sm bg-emerald-200" />
						<span className="h-1.5 flex-1 rounded-full bg-emerald-100" />
					</div>
				))}
			</div>
		);
	}

	if (id === "grid") {
		return (
			<div className="grid grid-cols-2 gap-1">
				{[0, 1, 2, 3].map((cell) => (
					<span
						key={cell}
						className="aspect-square rounded-sm bg-emerald-200"
					/>
				))}
			</div>
		);
	}

	if (id === "compact") {
		return (
			<div className="grid gap-1">
				{[0, 1, 2].map((row) => (
					<span key={row} className="h-1.5 rounded-full bg-emerald-100" />
				))}
			</div>
		);
	}

	return <span className="block aspect-video rounded-sm bg-emerald-200" />;
}

export function MenuLayoutModal({
	slug,
	activeTemplate,
	planTier,
	onClose,
}: {
	slug: string;
	activeTemplate: string;
	planTier: string;
	onClose: () => void;
}) {
	const [selected, setSelected] = useState<MenuTemplateId>(
		templates.some((template) => template.id === activeTemplate)
			? (activeTemplate as MenuTemplateId)
			: "classic",
	);
	const currentLevel = planLevel(planTier);

	return (
		<div className="fixed inset-0 z-100 grid items-end bg-slate-950/45 p-3 md:place-items-center md:p-4">
			<button
				type="button"
				className="absolute inset-0"
				aria-label="Close menu layout picker"
				onClick={onClose}
			/>
			<div className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-[1.5rem] bg-white p-4 md:max-w-lg md:rounded-[1.5rem] md:p-6">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h3 className="text-sm font-black text-slate-950 md:text-xl">
							Menu Layout
						</h3>
						<p className="mt-1 text-xs font-medium text-slate-500 md:text-sm">
							Choose how menu items appear to customers.
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="grid size-9 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-600 md:size-10"
						aria-label="Close menu layout picker"
					>
						<X className="size-4 md:size-5" aria-hidden="true" />
					</button>
				</div>

				<form
					action={updateRestaurantBrandingAction}
					className="mt-4 grid gap-4"
				>
					<input type="hidden" name="slug" value={slug} />
					<input type="hidden" name="activeTemplate" value={selected} />

					<div className="grid grid-cols-2 gap-3">
						{templates.map((template) => {
							const isLocked = currentLevel < template.level;
							return (
								<label
									key={template.id}
									className={cn(
										"relative flex cursor-pointer flex-col gap-2 rounded-2xl border p-3 transition-colors",
										selected === template.id
											? "border-emerald-500 bg-emerald-50 shadow-sm"
											: "border-slate-200 bg-white hover:bg-slate-50",
										isLocked && "cursor-not-allowed opacity-60 grayscale",
									)}
								>
									<input
										type="radio"
										disabled={isLocked}
										checked={selected === template.id}
										onChange={() => setSelected(template.id)}
										className="sr-only"
									/>
									<div className="rounded-lg bg-white p-2">
										<MenuLayoutPreview id={template.id} />
									</div>
									<div>
										<span className="text-xs font-black text-slate-950 md:text-sm">
											{template.name}
										</span>
										<p className="mt-0.5 text-xs font-medium text-slate-500">
											{template.description}
										</p>
									</div>
									{isLocked ? (
										<div className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
											<Lock className="size-3" aria-hidden="true" />
											Requires {template.requiredPlan}
										</div>
									) : null}
								</label>
							);
						})}
					</div>

					<SubmitButton
						loadingText="Saving..."
						successText="Saved"
						onSuccess={onClose}
						className="min-h-11 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white md:text-sm"
					>
						Save layout
					</SubmitButton>
				</form>
			</div>
		</div>
	);
}
