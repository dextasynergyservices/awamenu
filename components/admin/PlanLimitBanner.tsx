import { FileImage, Folder, ListChecks, ShieldCheck } from "lucide-react";

type PlanLimitBannerProps = {
	planName: string;
	categoryCount: number;
	maxCategories: number;
	menuItemCount: number;
	maxMenuItems: number;
	bannerCount: number;
};

function formatLimit(current: number, max: number) {
	return max < 0 ? `${current} / Unlimited` : `${current} / ${max}`;
}

function isAtLimit(current: number, max: number) {
	return max >= 0 && current >= max;
}

export function PlanLimitBanner({
	planName,
	categoryCount,
	maxCategories,
	menuItemCount,
	maxMenuItems,
	bannerCount,
}: PlanLimitBannerProps) {
	const categoryLimitReached = isAtLimit(categoryCount, maxCategories);
	const itemLimitReached = isAtLimit(menuItemCount, maxMenuItems);

	return (
		<section className="rounded-2xl border border-slate-100 bg-white p-2 md:p-3">
			<div className="grid grid-cols-3 gap-2 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
				<div className="hidden min-w-0 items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2.5 md:flex">
					<span className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
						<ShieldCheck className="size-4" aria-hidden="true" />
					</span>
					<div className="min-w-0">
						<p className="truncate text-sm font-black text-slate-950">
							{planName} plan
						</p>
						<p className="truncate text-xs font-medium text-slate-500">
							Limits apply while you edit
						</p>
					</div>
				</div>
				<LimitStat
					icon={Folder}
					label="Categories"
					value={formatLimit(categoryCount, maxCategories)}
					tone="emerald"
					full={categoryLimitReached}
				/>
				<LimitStat
					icon={ListChecks}
					label="Menu items"
					value={formatLimit(menuItemCount, maxMenuItems)}
					tone="yellow"
					full={itemLimitReached}
				/>
				<LimitStat
					icon={FileImage}
					label="Banners"
					value={`${bannerCount} / Unlimited`}
					tone="blue"
				/>
			</div>
			{categoryLimitReached || itemLimitReached ? (
				<p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
					Plan limit reached. Upgrade before adding more{" "}
					{categoryLimitReached && itemLimitReached
						? "categories or items"
						: categoryLimitReached
							? "categories"
							: "items"}
					.
				</p>
			) : null}
		</section>
	);
}

function LimitStat({
	icon: Icon,
	label,
	value,
	tone,
	full = false,
}: {
	icon: typeof Folder;
	label: string;
	value: string;
	tone: "emerald" | "yellow" | "blue";
	full?: boolean;
}) {
	const color =
		tone === "emerald"
			? "bg-emerald-50 text-emerald-700"
			: tone === "yellow"
				? "bg-yellow-50 text-yellow-700"
				: "bg-blue-50 text-blue-700";

	return (
		<div
			className={`grid min-w-0 justify-items-center gap-1 rounded-xl border p-2 text-center md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:justify-items-start md:gap-3 md:px-3 md:py-2.5 md:text-left ${
				full ? "border-red-200 bg-red-50/40" : "border-slate-100"
			}`}
		>
			<span
				className={`grid size-7 shrink-0 place-items-center rounded-lg md:size-9 ${color}`}
			>
				<Icon className="size-3.5 md:size-4" aria-hidden="true" />
			</span>
			<div className="min-w-0">
				<p className="truncate text-[11px] font-bold text-slate-500 md:text-xs">
					{label}
				</p>
				<p className="truncate text-xs font-black text-slate-950 md:text-lg md:leading-6">
					{value}
				</p>
			</div>
		</div>
	);
}
