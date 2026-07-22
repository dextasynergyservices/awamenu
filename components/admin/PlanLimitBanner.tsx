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
		<section className="rounded-lg border border-slate-100 bg-white p-1 md:rounded-2xl md:p-2 lg:rounded-3xl lg:p-5">
			<div className="grid grid-cols-3 gap-1 md:grid-cols-[0.9fr_0.7fr_0.7fr_0.7fr] md:gap-2 lg:grid-cols-[1.1fr_1fr_1fr_1fr] lg:gap-5">
				<div className="hidden items-center gap-2 rounded-lg bg-emerald-50 p-2 md:flex lg:gap-5 lg:rounded-2xl lg:p-5">
					<div className="grid size-7 shrink-0 place-items-center rounded-md bg-emerald-100 text-emerald-700 lg:size-14 lg:rounded-2xl">
						<ShieldCheck className="size-3.5 lg:size-6" aria-hidden="true" />
					</div>
					<div>
						<p className="text-xs font-black text-emerald-700 lg:text-sm">
							{planName} Plan
						</p>
						<h2 className="text-xs font-black text-slate-950 lg:mt-1 lg:text-2xl">
							Plan limits
						</h2>
						<p className="text-[0.68rem] font-medium leading-3.5 text-slate-500 lg:mt-1 lg:text-base lg:leading-6">
							Category and item limits are enforced while editing this menu.
						</p>
					</div>
				</div>
				<LimitStat
					icon={Folder}
					label="Categories"
					value={formatLimit(categoryCount, maxCategories)}
					tone="emerald"
				/>
				<LimitStat
					icon={ListChecks}
					label="Menu items"
					value={formatLimit(menuItemCount, maxMenuItems)}
					tone="yellow"
				/>
				<LimitStat
					icon={FileImage}
					label="Banner images"
					value={`${bannerCount} / Unlimited`}
					tone="blue"
				/>
			</div>
			{categoryLimitReached || itemLimitReached ? (
				<p className="mt-2 rounded-xl bg-red-50 p-2 text-xs font-black text-red-700 lg:mt-4 lg:rounded-2xl lg:p-4 lg:text-base">
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
}: {
	icon: typeof Folder;
	label: string;
	value: string;
	tone: "emerald" | "yellow" | "blue";
}) {
	const color =
		tone === "emerald"
			? "bg-emerald-50 text-emerald-700 after:bg-emerald-600"
			: tone === "yellow"
				? "bg-yellow-50 text-yellow-700 after:bg-yellow-500"
				: "bg-blue-50 text-blue-700 after:bg-blue-500";

	return (
		<div className="relative grid min-h-14 justify-items-center gap-0.5 overflow-hidden rounded-lg border border-slate-100 p-1 text-center after:absolute after:right-2 after:bottom-0 after:left-2 after:h-0.5 after:rounded-full md:min-h-16 md:p-1.5 lg:min-h-28 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:justify-items-start lg:gap-4 lg:rounded-2xl lg:p-5 lg:text-left lg:after:right-4 lg:after:left-20 lg:after:h-1">
			<div
				className={`grid size-6 shrink-0 place-items-center rounded-md lg:size-14 lg:rounded-2xl ${color}`}
			>
				<Icon className="size-3 lg:size-6" aria-hidden="true" />
			</div>
			<div className="min-w-0">
				<p className="text-[0.65rem] font-black leading-3 text-slate-700 lg:text-base lg:leading-5">
					{label}
				</p>
				<p className="text-[0.65rem] font-black leading-3 text-slate-950 lg:mt-2 lg:text-2xl lg:leading-7">
					{value}
				</p>
			</div>
		</div>
	);
}
