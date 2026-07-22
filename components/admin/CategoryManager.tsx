"use client";

import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
	createCategoryAction,
	deleteCategoryAction,
	updateCategoryAction,
} from "@/actions/menu.actions";
import { FormSubmitButton, SubmitButton } from "@/components/ui/action-button";

type CategoryManagerProps = {
	restaurantId: string;
	slug: string;
	canCreateCategory: boolean;
	categories: Array<{
		id: string;
		name: string;
		emoji: string | null;
		sortOrder: number;
		isActive: boolean;
		items?: Array<unknown>;
	}>;
};

const CATEGORIES_PER_PAGE = 5;

export function CategoryManager({
	restaurantId,
	slug,
	canCreateCategory,
	categories,
}: CategoryManagerProps) {
	const [categoryPage, setCategoryPage] = useState(1);
	const pageCount = Math.max(
		1,
		Math.ceil(categories.length / CATEGORIES_PER_PAGE),
	);
	const visibleCategories = categories.slice(
		(categoryPage - 1) * CATEGORIES_PER_PAGE,
		categoryPage * CATEGORIES_PER_PAGE,
	);

	return (
		<section className="rounded-3xl border border-slate-100 bg-white p-4">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h2 className="text-xl font-black text-slate-950">Categories</h2>
					<p className="mt-1 text-sm font-medium text-slate-500">
						Create, edit, order, and publish menu categories.
					</p>
				</div>
				<form action={createCategoryAction} className="flex gap-2">
					<input type="hidden" name="restaurantId" value={restaurantId} />
					<input type="hidden" name="slug" value={slug} />
					<input type="hidden" name="emoji" value="" />
					<input type="hidden" name="sortOrder" value={categories.length + 1} />
					<input
						name="name"
						required
						placeholder="New category"
						className="hidden min-h-9 w-36 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-emerald-700 sm:block"
					/>
					<SubmitButton
						disabled={!canCreateCategory}
						loadingText="Creating..."
						successText="Created"
						className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-50 px-3 text-sm font-black text-emerald-800 disabled:opacity-50"
					>
						<Plus className="size-4" aria-hidden="true" />
						Add category
					</SubmitButton>
				</form>
			</div>

			<div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
				<table className="w-full text-left text-sm">
					<thead className="bg-slate-50 text-xs font-black text-slate-500">
						<tr>
							<th className="px-3 py-3">Order</th>
							<th className="px-3 py-3">Category</th>
							<th className="px-3 py-3">Items</th>
							<th className="px-3 py-3">Status</th>
							<th className="px-3 py-3 text-right">Actions</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{categories.length > 0 ? (
							visibleCategories.map((category) => (
								<tr key={category.id} className="bg-white">
									<td className="px-3 py-3 align-middle">
										<div className="flex items-center gap-2">
											<GripVertical
												className="size-4 text-slate-400"
												aria-hidden="true"
											/>
											<span className="text-sm font-black text-slate-700">
												{category.sortOrder}
											</span>
										</div>
									</td>
									<td className="px-3 py-3 align-middle">
										<form
											id={`category-${category.id}`}
											action={updateCategoryAction}
											className="flex items-center gap-3"
										>
											<input
												type="hidden"
												name="restaurantId"
												value={restaurantId}
											/>
											<input type="hidden" name="slug" value={slug} />
											<input
												type="hidden"
												name="categoryId"
												value={category.id}
											/>
											{category.isActive ? (
												<input type="hidden" name="isActive" value="on" />
											) : null}
											<input
												name="emoji"
												defaultValue={category.emoji ?? ""}
												placeholder="🍽"
												className="size-9 rounded-lg border border-slate-200 bg-white text-center text-sm outline-none focus:border-emerald-700"
											/>
											<input
												name="name"
												defaultValue={category.name}
												required
												className="min-h-9 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 text-sm font-black text-slate-950 outline-none focus:border-emerald-700 focus:bg-white"
											/>
											<input
												name="sortOrder"
												type="number"
												min="0"
												defaultValue={category.sortOrder}
												className="sr-only"
											/>
										</form>
									</td>
									<td className="px-3 py-3 align-middle font-black">
										{category.items?.length ?? 0}
									</td>
									<td className="px-3 py-3 align-middle">
										<span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
											{category.isActive ? "Published" : "Draft"}
										</span>
									</td>
									<td className="px-3 py-3 align-middle">
										<div className="flex justify-end gap-2">
											<FormSubmitButton
												loadingText="Saving..."
												successText="Saved"
												form={`category-${category.id}`}
												className="inline-flex min-h-9 min-w-24 items-center justify-center gap-2 rounded-lg px-3 text-slate-600 hover:bg-slate-50"
												aria-label={`Save ${category.name}`}
											>
												<Pencil className="size-4" aria-hidden="true" />
												<span className="sr-only">Save</span>
											</FormSubmitButton>
											<form action={deleteCategoryAction}>
												<input
													type="hidden"
													name="restaurantId"
													value={restaurantId}
												/>
												<input type="hidden" name="slug" value={slug} />
												<input
													type="hidden"
													name="categoryId"
													value={category.id}
												/>
												<SubmitButton
													loadingText="Deleting..."
													successText="Deleted"
													className="inline-flex min-h-9 min-w-24 items-center justify-center gap-2 rounded-lg px-3 text-red-600 hover:bg-red-50"
													aria-label={`Delete ${category.name}`}
												>
													<Trash2 className="size-4" aria-hidden="true" />
													<span className="sr-only">Delete</span>
												</SubmitButton>
											</form>
										</div>
									</td>
								</tr>
							))
						) : (
							<tr>
								<td
									colSpan={5}
									className="px-3 py-8 text-center text-sm font-bold text-slate-500"
								>
									No categories yet.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
			<p className="mt-4 text-sm font-medium text-slate-400">
				Drag to reorder categories
			</p>
			<div className="mt-3 flex items-center justify-between gap-3 text-sm font-bold text-slate-500">
				<span>
					Page {categoryPage} of {pageCount}
				</span>
				<div className="flex gap-2">
					<button
						type="button"
						disabled={categoryPage === 1}
						onClick={() => setCategoryPage((page) => Math.max(1, page - 1))}
						className="min-h-9 rounded-lg border border-slate-200 px-3 disabled:opacity-40"
					>
						Prev
					</button>
					<button
						type="button"
						disabled={categoryPage === pageCount}
						onClick={() =>
							setCategoryPage((page) => Math.min(pageCount, page + 1))
						}
						className="min-h-9 rounded-lg border border-slate-200 px-3 disabled:opacity-40"
					>
						Next
					</button>
				</div>
			</div>
		</section>
	);
}
