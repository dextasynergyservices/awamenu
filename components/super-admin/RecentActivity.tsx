import { Store, TrendingUp, XCircle } from "lucide-react";

export type ActivityEntry = {
	type: "registered" | "upgraded" | "cancelled";
	label: string;
	timestamp: Date;
};

function timeAgo(date: Date) {
	const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
	if (diffSec < 60) return "Just now";
	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;
	const diffDay = Math.floor(diffHr / 24);
	return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

function activityTone(type: ActivityEntry["type"]) {
	if (type === "registered") {
		return { icon: Store, tone: "bg-emerald-50 text-emerald-700" };
	}
	if (type === "upgraded") {
		return { icon: TrendingUp, tone: "bg-blue-50 text-blue-700" };
	}
	return { icon: XCircle, tone: "bg-red-50 text-red-700" };
}

export function RecentActivity({ activity }: { activity: ActivityEntry[] }) {
	return (
		<div className="rounded-2xl border border-slate-100 bg-white p-5">
			<h2 className="mb-4 text-sm font-black text-slate-800">
				Recent Activity
			</h2>
			{activity.length > 0 ? (
				<div className="grid gap-3">
					{activity.map((entry) => {
						const { icon: Icon, tone } = activityTone(entry.type);
						return (
							<div
								key={`${entry.type}-${entry.timestamp.getTime()}-${entry.label}`}
								className="flex items-center gap-3"
							>
								<span
									className={`grid size-9 shrink-0 place-items-center rounded-full ${tone}`}
								>
									<Icon className="size-4" aria-hidden="true" />
								</span>
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-bold text-slate-900">
										{entry.label}
									</p>
									<p className="text-xs font-medium text-slate-500">
										{timeAgo(entry.timestamp)}
									</p>
								</div>
							</div>
						);
					})}
				</div>
			) : (
				<p className="text-sm font-medium text-slate-500">
					No recent activity yet.
				</p>
			)}
		</div>
	);
}
