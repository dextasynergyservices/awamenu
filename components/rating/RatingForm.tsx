"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { submitRatingAction } from "@/actions/rating.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { RATING_METRIC_LABELS, type RatingMetric } from "@/lib/rating-metrics";

type RatingFormProps = {
	orderId: string;
	slug: string;
	orderCode: string;
	restaurantName: string;
	metrics: RatingMetric[];
	customerName?: string | null;
	customerPhone?: string | null;
};

function StarRatingInput({
	name,
	label,
	required,
	value,
	onChange,
}: {
	name: string;
	label: string;
	required?: boolean;
	value: number;
	onChange: (value: number) => void;
}) {
	const [hovered, setHovered] = useState(0);

	return (
		<div>
			<p className="mb-2 text-sm font-black text-slate-800">
				{label}
				{required ? <span className="text-red-500"> *</span> : null}
			</p>
			<div
				role="radiogroup"
				aria-label={label}
				className="flex items-center gap-1.5"
				onMouseLeave={() => setHovered(0)}
			>
				{[1, 2, 3, 4, 5].map((star) => {
					const filled = (hovered || value) >= star;
					return (
						<button
							key={star}
							type="button"
							onMouseEnter={() => setHovered(star)}
							onClick={() => onChange(star)}
							className="p-0.5"
							aria-label={`${star} star${star > 1 ? "s" : ""}`}
						>
							<Star
								className={`size-8 transition-colors ${
									filled
										? "fill-amber-400 text-amber-400"
										: "fill-none text-slate-300"
								}`}
							/>
						</button>
					);
				})}
			</div>
			<input type="hidden" name={name} value={value || ""} />
		</div>
	);
}

export function RatingForm({
	orderId,
	slug,
	orderCode,
	restaurantName,
	metrics,
	customerName,
	customerPhone,
}: RatingFormProps) {
	const [overallRating, setOverallRating] = useState(0);
	const [metricRatings, setMetricRatings] = useState<Record<string, number>>(
		{},
	);

	return (
		<form action={submitRatingAction} className="grid gap-6">
			<input type="hidden" name="orderId" value={orderId} />
			<input type="hidden" name="slug" value={slug} />
			{customerName ? (
				<input type="hidden" name="customerName" value={customerName} />
			) : null}
			{customerPhone ? (
				<input type="hidden" name="customerPhone" value={customerPhone} />
			) : null}

			<div>
				<p className="text-sm font-bold text-slate-500">{restaurantName}</p>
				<h1 className="mt-1 text-2xl font-black text-slate-950">
					Rate your order {orderCode}
				</h1>
				<p className="mt-2 text-sm font-medium text-slate-600">
					Your feedback helps {restaurantName} improve.
				</p>
			</div>

			<div className="rounded-2xl border border-slate-100 bg-white p-5">
				<StarRatingInput
					name="overallRating"
					label="Overall Rating"
					required
					value={overallRating}
					onChange={setOverallRating}
				/>
			</div>

			<div className="grid gap-5 rounded-2xl border border-slate-100 bg-white p-5">
				{metrics.map((metric) => (
					<StarRatingInput
						key={metric}
						name={metric}
						label={RATING_METRIC_LABELS[metric]}
						value={metricRatings[metric] ?? 0}
						onChange={(value) =>
							setMetricRatings((prev) => ({ ...prev, [metric]: value }))
						}
					/>
				))}
			</div>

			<div>
				<label
					htmlFor="comment"
					className="mb-2 block text-sm font-black text-slate-800"
				>
					Additional comments (optional)
				</label>
				<textarea
					id="comment"
					name="comment"
					rows={4}
					maxLength={1000}
					placeholder="Tell us more about your experience..."
					className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
				/>
			</div>

			<SubmitButton
				disabled={overallRating === 0}
				loadingText="Submitting..."
				successText="Thank you!"
				className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white disabled:opacity-50"
			>
				Submit Rating
			</SubmitButton>
		</form>
	);
}
