"use client";

import { useState } from "react";

export type SalesPoint = {
	label: string;
	value: number;
};

type SalesRange = "day" | "week" | "month";

type DashboardSalesChartProps = {
	currency: string;
	day: SalesPoint[];
	week: SalesPoint[];
	month: SalesPoint[];
};

const ranges: Array<{ key: SalesRange; label: string; periodLabel: string }> = [
	{ key: "day", label: "Day", periodLabel: "Total sales today" },
	{ key: "week", label: "Week", periodLabel: "Total sales this week" },
	{ key: "month", label: "Month", periodLabel: "Total sales this month" },
];

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

export function DashboardSalesChart({
	currency,
	day,
	week,
	month,
}: DashboardSalesChartProps) {
	const [range, setRange] = useState<SalesRange>("day");
	const points = range === "day" ? day : range === "week" ? week : month;
	const total = points.reduce((sum, point) => sum + point.value, 0);
	const maxValue = Math.max(1, ...points.map((point) => point.value));
	const activeRange = ranges.find((entry) => entry.key === range) ?? ranges[0];

	const coords = points.map((point, index) => ({
		...point,
		x: points.length > 1 ? (index / (points.length - 1)) * 100 : 50,
		y: 100 - (point.value / maxValue) * 100,
	}));
	const salesLine = coords.map((point) => `${point.x},${point.y}`).join(" ");
	const maxLabels = 8;
	const labelStep = Math.max(1, Math.ceil(coords.length / maxLabels));
	const visibleLabels = coords.filter((_, index) => index % labelStep === 0);

	return (
		<div className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-5 xl:p-6">
			<div className="grid gap-4 sm:flex sm:items-start sm:justify-between">
				<div>
					<h3 className="text-sm font-black text-slate-950 sm:text-xl">
						Sales Overview
					</h3>
					<p className="mt-4 text-xl font-black text-slate-950 sm:text-3xl xl:text-4xl">
						{formatMoney(total, currency)}
					</p>
					<p className="text-sm font-medium text-slate-500">
						{activeRange.periodLabel}
					</p>
				</div>
				<div className="grid min-w-0 grid-cols-3 overflow-hidden rounded-xl border border-slate-200 text-xs font-black sm:w-auto sm:text-sm">
					{ranges.map((entry) => (
						<button
							key={entry.key}
							type="button"
							onClick={() => setRange(entry.key)}
							className={`min-w-0 px-3 py-2 text-center transition-colors sm:px-4 ${
								range === entry.key
									? "bg-emerald-700 text-white"
									: "text-slate-600 hover:bg-slate-50"
							}`}
						>
							{entry.label}
						</button>
					))}
				</div>
			</div>
			<div className="mt-6 h-40 max-w-full overflow-hidden rounded-2xl bg-emerald-50 p-3 sm:mt-8 sm:h-52 sm:p-4 xl:h-64 xl:p-5">
				{total > 0 ? (
					<div className="relative h-full">
						<svg
							viewBox="0 0 100 100"
							preserveAspectRatio="none"
							className="absolute inset-x-0 top-0 h-[82%] w-full overflow-visible"
							aria-label="Sales trend"
						>
							<defs>
								<linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1">
									<stop offset="0%" stopColor="#059669" stopOpacity="0.22" />
									<stop offset="100%" stopColor="#059669" stopOpacity="0" />
								</linearGradient>
							</defs>
							<polygon
								points={`0,100 ${salesLine} 100,100`}
								fill="url(#salesFill)"
							/>
							<polyline
								points={salesLine}
								fill="none"
								stroke="#059669"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2.6"
								vectorEffect="non-scaling-stroke"
							/>
							{coords.map((point) => (
								<circle
									key={point.label}
									cx={point.x}
									cy={point.y}
									fill="#ffffff"
									r="1.8"
									stroke="#059669"
									strokeWidth="1.4"
									vectorEffect="non-scaling-stroke"
								/>
							))}
						</svg>
						<div className="absolute inset-x-0 bottom-0 flex justify-between text-xs font-bold text-slate-500">
							{visibleLabels.map((point) => (
								<span key={point.label} className="text-center">
									{point.label}
								</span>
							))}
						</div>
					</div>
				) : (
					<div className="grid h-full place-items-center text-center">
						<p className="text-xs font-bold text-slate-500 sm:text-sm">
							No sales recorded yet for this period.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
