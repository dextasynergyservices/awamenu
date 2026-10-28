"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toggleRatingHiddenAction } from "@/actions/super-admin.actions";
import { MobileModal } from "@/components/ui/MobileModal";
import { RowActionForm, RowActions } from "@/components/ui/RowActions";

type ReviewRow = {
	id: string;
	restaurantName: string;
	overallRating: number;
	comment: string | null;
	customerName: string | null;
	isHidden: boolean;
	createdAt: string;
};

function HideToggleItem({ review }: { review: ReviewRow }) {
	return (
		<RowActionForm
			action={toggleRatingHiddenAction}
			fields={{ ratingId: review.id, isHidden: String(!review.isHidden) }}
			icon={review.isHidden ? Eye : EyeOff}
			tone={review.isHidden ? "success" : "danger"}
		>
			{review.isHidden ? "Show review" : "Hide review"}
		</RowActionForm>
	);
}

export function ReviewsTable({ reviews }: { reviews: ReviewRow[] }) {
	const [selectedReview, setSelectedReview] = useState<ReviewRow | null>(null);

	if (reviews.length === 0) {
		return (
			<div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm font-medium text-slate-500">
				No reviews found.
			</div>
		);
	}

	return (
		<>
			<div className="grid gap-2 md:hidden">
				{reviews.map((review) => (
					<button
						key={review.id}
						type="button"
						onClick={() => setSelectedReview(review)}
						className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white p-3 text-left"
					>
						<div className="min-w-0">
							<p className="truncate text-sm font-black text-slate-900">
								{review.restaurantName}
							</p>
							<p className="truncate text-xs font-medium text-slate-400">
								{review.overallRating.toFixed(1)} ★
								{review.comment ? ` · ${review.comment}` : ""}
							</p>
						</div>
						<span
							className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${
								review.isHidden
									? "bg-slate-100 text-slate-500"
									: "bg-emerald-100 text-emerald-700"
							}`}
						>
							{review.isHidden ? "Hidden" : "Visible"}
						</span>
					</button>
				))}
			</div>

			<div className="hidden overflow-x-auto rounded-2xl border border-slate-100 bg-white md:block">
				<table className="w-full min-w-[760px] text-left text-sm">
					<thead>
						<tr className="border-b border-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
							<th className="p-4">Restaurant</th>
							<th className="p-4">Rating</th>
							<th className="p-4">Comment</th>
							<th className="p-4">Status</th>
							<th className="p-4">Date</th>
							<th className="w-12 p-4">
								<span className="sr-only">Actions</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{reviews.map((review) => (
							<tr
								key={review.id}
								className="border-b border-slate-50 last:border-0"
							>
								<td className="p-4">
									<p className="font-black text-slate-900">
										{review.restaurantName}
									</p>
									{review.customerName ? (
										<p className="text-xs font-medium text-slate-400">
											{review.customerName}
										</p>
									) : null}
								</td>
								<td className="p-4 font-semibold text-slate-700">
									{review.overallRating.toFixed(1)} ★
								</td>
								<td className="max-w-xs p-4 font-medium text-slate-600">
									<p className="line-clamp-2">{review.comment ?? "—"}</p>
								</td>
								<td className="p-4">
									<span
										className={`rounded-full px-2.5 py-1 text-xs font-black ${
											review.isHidden
												? "bg-slate-100 text-slate-500"
												: "bg-emerald-100 text-emerald-700"
										}`}
									>
										{review.isHidden ? "Hidden" : "Visible"}
									</span>
								</td>
								<td className="p-4 font-medium text-slate-500">
									{new Date(review.createdAt).toLocaleDateString()}
								</td>
								<td className="p-4">
									<RowActions
										label={`Actions for review by ${review.customerName ?? "customer"}`}
									>
										<HideToggleItem review={review} />
									</RowActions>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<MobileModal
				open={selectedReview !== null}
				onClose={() => setSelectedReview(null)}
				title={selectedReview?.restaurantName ?? ""}
				description={
					selectedReview?.customerName ??
					(selectedReview
						? new Date(selectedReview.createdAt).toLocaleDateString()
						: undefined)
				}
			>
				{selectedReview ? (
					<div className="grid gap-3 pb-2">
						<div>
							<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								Rating
							</p>
							<p className="mt-0.5 text-sm font-semibold text-slate-700">
								{selectedReview.overallRating.toFixed(1)} ★
							</p>
						</div>
						<div>
							<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								Comment
							</p>
							<p className="mt-0.5 text-sm font-medium text-slate-700">
								{selectedReview.comment ?? "—"}
							</p>
						</div>
						<div>
							<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								Date
							</p>
							<p className="mt-0.5 text-sm font-semibold text-slate-700">
								{new Date(selectedReview.createdAt).toLocaleDateString()}
							</p>
						</div>
						<div>
							<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								Status
							</p>
							<span
								className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-black ${
									selectedReview.isHidden
										? "bg-slate-100 text-slate-500"
										: "bg-emerald-100 text-emerald-700"
								}`}
							>
								{selectedReview.isHidden ? "Hidden" : "Visible"}
							</span>
						</div>
						<div className="grid gap-0.5 rounded-xl border border-slate-100 p-1">
							<HideToggleItem review={selectedReview} />
						</div>
					</div>
				) : null}
			</MobileModal>
		</>
	);
}
