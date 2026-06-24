"use client";

import { Pencil, Plus, Trash2, Upload, Utensils, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import {
	createMenuItemAction,
	deleteMenuItemAction,
	updateMenuItemAction,
} from "@/actions/menu.actions";
import { FormSubmitButton, SubmitButton } from "@/components/ui/action-button";

type MenuEditorProps = {
	restaurantId: string;
	slug: string;
	canCreateItem: boolean;
	categories: Array<{
		id: string;
		name: string;
		items: Array<{
			id: string;
			name: string;
			description: string | null;
			price: number;
			imageUrl: string | null;
			sortOrder: number;
			isAvailable: boolean;
			isTodaySpecial: boolean;
		}>;
	}>;
};

const ITEMS_PER_PAGE = 5;

async function uploadItemPhoto(
	restaurantId: string,
	file: File,
	input: HTMLInputElement,
) {
	if (!file) return;
	if (!["image/webp", "image/jpeg", "image/png"].includes(file.type)) {
		throw new Error("Item photos must be WebP, JPG, or PNG images.");
	}

	const res = await fetch("/api/upload", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			restaurantId,
			kind: "item",
			contentType: file.type,
		}),
	});

	if (!res.ok) {
		throw new Error("Unable to create upload URL.");
	}

	const payload = (await res.json()) as {
		apiKey: string;
		folder: string;
		publicId: string;
		signature: string;
		timestamp: number;
		uploadUrl: string;
	};
	const uploadData = new FormData();
	uploadData.set("file", file);
	uploadData.set("api_key", payload.apiKey);
	uploadData.set("folder", payload.folder);
	uploadData.set("public_id", payload.publicId);
	uploadData.set("signature", payload.signature);
	uploadData.set("timestamp", String(payload.timestamp));
	const uploadRes = await fetch(payload.uploadUrl, {
		method: "POST",
		body: uploadData,
	});

	if (!uploadRes.ok) {
		throw new Error("Unable to upload item photo.");
	}

	const uploadPayload = (await uploadRes.json()) as { secure_url?: string };
	if (!uploadPayload.secure_url) {
		throw new Error("Cloudinary did not return an image URL.");
	}

	input.value = uploadPayload.secure_url.replace(
		"/upload/",
		"/upload/f_webp,q_auto/",
	);
}

function ImageUploadField({
	restaurantId,
	inputId,
	defaultValue,
	autoSave = false,
}: {
	restaurantId: string;
	inputId: string;
	defaultValue?: string | null;
	autoSave?: boolean;
}) {
	const [previewUrl, setPreviewUrl] = useState(defaultValue ?? "");
	const [isUploading, setIsUploading] = useState(false);

	return (
		<div className="grid gap-2">
			<input
				type="hidden"
				id={inputId}
				name="imageUrl"
				defaultValue={defaultValue ?? ""}
			/>
			<label className="grid gap-2">
				<span className="text-sm font-black text-slate-700">Photo upload</span>
				<input
					type="file"
					accept="image/webp,image/jpeg,image/png"
					className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
					onChange={async (event) => {
						const fileInput = event.currentTarget;
						const file = event.currentTarget.files?.[0];
						const hiddenInput = document.getElementById(inputId);
						if (!file || !(hiddenInput instanceof HTMLInputElement)) return;
						try {
							setIsUploading(true);
							await uploadItemPhoto(restaurantId, file, hiddenInput);
							setPreviewUrl(hiddenInput.value);
							if (autoSave) {
								hiddenInput.form?.requestSubmit();
							}
						} finally {
							setIsUploading(false);
							fileInput.value = "";
						}
					}}
				/>
			</label>
			{isUploading ? (
				<p className="text-xs font-black text-emerald-700">Uploading...</p>
			) : null}
			{previewUrl ? (
				<div className="grid gap-2">
					<div className="relative h-28 overflow-hidden rounded-xl border border-emerald-100 bg-emerald-50">
						<Image
							src={previewUrl}
							alt="Menu item photo preview"
							fill
							className="object-cover"
							sizes="320px"
							unoptimized
						/>
					</div>
					<p className="truncate text-xs font-bold text-emerald-700">
						{autoSave
							? "Uploaded and saving item..."
							: "Uploaded. Add item to publish."}
					</p>
				</div>
			) : null}
		</div>
	);
}

export function MenuEditor({
	restaurantId,
	slug,
	canCreateItem,
	categories,
}: MenuEditorProps) {
	const firstCategory = categories[0];
	const items = categories.flatMap((category) =>
		category.items.map((item) => ({
			...item,
			categoryId: category.id,
			categoryName: category.name,
		})),
	);
	const [itemPage, setItemPage] = useState(1);
	const [editingItem, setEditingItem] = useState<(typeof items)[number] | null>(
		null,
	);
	const pageCount = Math.max(1, Math.ceil(items.length / ITEMS_PER_PAGE));
	const visibleItems = items.slice(
		(itemPage - 1) * ITEMS_PER_PAGE,
		itemPage * ITEMS_PER_PAGE,
	);

	return (
		<section className="rounded-3xl border border-slate-100 bg-white p-4">
			<div className="flex items-start justify-between gap-4">
				<div>
					<h2 className="text-xl font-black text-slate-950">Menu Items</h2>
					<p className="mt-1 text-sm font-medium text-slate-500">
						Create, edit, publish, and upload WebP photos for menu items.
					</p>
				</div>
				<FormSubmitButton
					form="new-menu-item-form"
					disabled={!canCreateItem || categories.length === 0}
					loadingText="Creating..."
					successText="Created"
					className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-50 px-3 text-sm font-black text-emerald-800 disabled:opacity-50"
				>
					<Plus className="size-4" aria-hidden="true" />
					Add new item
				</FormSubmitButton>
			</div>

			<form
				id="new-menu-item-form"
				action={createMenuItemAction}
				className="mt-4 grid gap-3"
			>
				<input type="hidden" name="restaurantId" value={restaurantId} />
				<input type="hidden" name="slug" value={slug} />
				<input type="hidden" name="sortOrder" value={items.length + 1} />
				<input type="hidden" name="isAvailable" value="on" />
				<input type="hidden" name="isTodaySpecial" value="" />
				<div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
					<select
						name="categoryId"
						required
						defaultValue={firstCategory?.id}
						className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-700"
					>
						{categories.map((category) => (
							<option key={category.id} value={category.id}>
								{category.name}
							</option>
						))}
					</select>
					<input
						name="name"
						required
						placeholder="Item name"
						className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-700"
					/>
					<input
						name="price"
						type="number"
						min="0"
						step="0.01"
						required
						placeholder="Price"
						className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-700"
					/>
				</div>
				<input
					name="description"
					placeholder="Short description"
					className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-700"
				/>
				<ImageUploadField
					restaurantId={restaurantId}
					inputId="new-item-image"
				/>
			</form>

			<div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1.2fr]">
				<select className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none">
					<option>All categories</option>
					{categories.map((category) => (
						<option key={category.id}>{category.name}</option>
					))}
				</select>
				<select className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none">
					<option>All status</option>
					<option>Published</option>
					<option>Draft</option>
				</select>
				<input
					placeholder="Search items..."
					className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none"
				/>
			</div>

			<div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
				<table className="w-full text-left text-sm">
					<thead className="bg-slate-50 text-xs font-black text-slate-500">
						<tr>
							<th className="px-3 py-3">Item</th>
							<th className="px-3 py-3">Category</th>
							<th className="px-3 py-3">Price</th>
							<th className="px-3 py-3">Status</th>
							<th className="px-3 py-3 text-right">Actions</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{items.length > 0 ? (
							visibleItems.map((item) => (
								<tr key={item.id} className="bg-white">
									<td className="px-3 py-3 align-middle">
										<div className="flex min-w-0 items-center gap-3">
											<div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-emerald-50">
												{item.imageUrl ? (
													<Image
														src={item.imageUrl}
														alt={item.name}
														fill
														className="object-cover"
														sizes="40px"
														unoptimized
													/>
												) : (
													<div className="grid h-full place-items-center">
														<Utensils className="size-5 text-emerald-700" />
													</div>
												)}
											</div>
											<form
												id={`item-${item.id}`}
												action={updateMenuItemAction}
												className="min-w-0 flex-1"
											>
												<input
													type="hidden"
													name="restaurantId"
													value={restaurantId}
												/>
												<input type="hidden" name="slug" value={slug} />
												<input type="hidden" name="itemId" value={item.id} />
												<input
													type="hidden"
													name="sortOrder"
													value={item.sortOrder}
												/>
												<input
													type="hidden"
													name="isAvailable"
													value={item.isAvailable ? "on" : ""}
												/>
												<input
													type="hidden"
													name="isTodaySpecial"
													value={item.isTodaySpecial ? "on" : ""}
												/>
												<input
													name="name"
													required
													defaultValue={item.name}
													className="block min-h-6 w-full rounded border border-transparent bg-transparent px-1 text-sm font-black text-slate-950 outline-none focus:border-emerald-700"
												/>
												<input
													name="description"
													defaultValue={item.description ?? ""}
													placeholder="Description"
													className="mt-1 block min-h-6 w-full rounded border border-transparent bg-transparent px-1 text-xs font-medium text-slate-500 outline-none focus:border-emerald-700"
												/>
												<input
													type="hidden"
													id={`item-image-${item.id}`}
													name="imageUrl"
													defaultValue={item.imageUrl ?? ""}
												/>
											</form>
										</div>
									</td>
									<td className="px-3 py-3 align-middle">
										<select
											name="categoryId"
											form={`item-${item.id}`}
											defaultValue={item.categoryId}
											className="min-h-8 rounded-lg border border-transparent bg-emerald-50 px-2 text-xs font-black text-emerald-700 outline-none focus:border-emerald-700"
										>
											{categories.map((category) => (
												<option key={category.id} value={category.id}>
													{category.name}
												</option>
											))}
										</select>
									</td>
									<td className="px-3 py-3 align-middle">
										<input
											name="price"
											form={`item-${item.id}`}
											type="number"
											min="0"
											step="0.01"
											required
											defaultValue={item.price}
											className="min-h-8 w-24 rounded-lg border border-transparent bg-transparent px-2 text-sm font-black text-slate-950 outline-none focus:border-emerald-700"
										/>
									</td>
									<td className="px-3 py-3 align-middle">
										<span className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
											{item.isAvailable ? "Published" : "Draft"}
										</span>
									</td>
									<td className="px-3 py-3 align-middle">
										<div className="flex justify-end gap-2">
											<label
												className="grid size-9 cursor-pointer place-items-center rounded-lg text-slate-600 hover:bg-slate-50"
												aria-label={`Upload ${item.name} photo`}
											>
												<Upload className="size-4" aria-hidden="true" />
												<input
													type="file"
													accept="image/webp,image/jpeg,image/png"
													className="sr-only"
													onChange={async (event) => {
														const fileInput = event.currentTarget;
														const file = fileInput.files?.[0];
														const hiddenInput = document.getElementById(
															`item-image-${item.id}`,
														);
														if (
															!file ||
															!(hiddenInput instanceof HTMLInputElement)
														) {
															return;
														}
														try {
															await uploadItemPhoto(
																restaurantId,
																file,
																hiddenInput,
															);
															hiddenInput.form?.requestSubmit();
														} finally {
															fileInput.value = "";
														}
													}}
												/>
											</label>
											<button
												type="button"
												onClick={() => setEditingItem(item)}
												className="grid size-9 place-items-center rounded-lg text-slate-600 hover:bg-slate-50"
												aria-label={`Edit ${item.name}`}
											>
												<Pencil className="size-4" aria-hidden="true" />
											</button>
											<form action={deleteMenuItemAction}>
												<input
													type="hidden"
													name="restaurantId"
													value={restaurantId}
												/>
												<input type="hidden" name="slug" value={slug} />
												<input type="hidden" name="itemId" value={item.id} />
												<SubmitButton
													loadingText="Deleting..."
													successText="Deleted"
													className="inline-flex min-h-9 min-w-24 items-center justify-center gap-2 rounded-lg px-3 text-red-600 hover:bg-red-50"
													aria-label={`Delete ${item.name}`}
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
									No menu items yet.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
			<div className="mt-3 flex items-center justify-between gap-3 text-sm font-bold text-slate-500">
				<span>
					Page {itemPage} of {pageCount}
				</span>
				<div className="flex gap-2">
					<button
						type="button"
						disabled={itemPage === 1}
						onClick={() => setItemPage((page) => Math.max(1, page - 1))}
						className="min-h-9 rounded-lg border border-slate-200 px-3 disabled:opacity-40"
					>
						Prev
					</button>
					<button
						type="button"
						disabled={itemPage === pageCount}
						onClick={() => setItemPage((page) => Math.min(pageCount, page + 1))}
						className="min-h-9 rounded-lg border border-slate-200 px-3 disabled:opacity-40"
					>
						Next
					</button>
				</div>
			</div>
			{editingItem ? (
				<div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
					<div className="w-full max-w-xl rounded-3xl bg-white p-5">
						<div className="flex items-start justify-between gap-4">
							<div>
								<h3 className="text-xl font-black text-slate-950">Edit item</h3>
								<p className="mt-1 text-sm font-medium text-slate-500">
									Update this menu item.
								</p>
							</div>
							<button
								type="button"
								onClick={() => setEditingItem(null)}
								className="grid size-10 place-items-center rounded-full bg-slate-50 text-slate-600"
								aria-label="Close edit item modal"
							>
								<X className="size-5" aria-hidden="true" />
							</button>
						</div>
						<form action={updateMenuItemAction} className="mt-5 grid gap-3">
							<input type="hidden" name="restaurantId" value={restaurantId} />
							<input type="hidden" name="slug" value={slug} />
							<input type="hidden" name="itemId" value={editingItem.id} />
							<input
								type="hidden"
								name="sortOrder"
								value={editingItem.sortOrder}
							/>
							<input
								type="hidden"
								name="isAvailable"
								value={editingItem.isAvailable ? "on" : ""}
							/>
							<input
								type="hidden"
								name="isTodaySpecial"
								value={editingItem.isTodaySpecial ? "on" : ""}
							/>
							<select
								name="categoryId"
								defaultValue={editingItem.categoryId}
								className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-700"
							>
								{categories.map((category) => (
									<option key={category.id} value={category.id}>
										{category.name}
									</option>
								))}
							</select>
							<input
								name="name"
								required
								defaultValue={editingItem.name}
								className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-700"
							/>
							<input
								name="description"
								defaultValue={editingItem.description ?? ""}
								className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-700"
							/>
							<input
								name="price"
								type="number"
								min="0"
								step="0.01"
								required
								defaultValue={editingItem.price}
								className="min-h-11 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-700"
							/>
							<ImageUploadField
								restaurantId={restaurantId}
								inputId={`modal-item-image-${editingItem.id}`}
								defaultValue={editingItem.imageUrl}
							/>
							<SubmitButton
								loadingText="Updating..."
								successText="Updated"
								className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-black text-white"
							>
								Save changes
							</SubmitButton>
						</form>
					</div>
				</div>
			) : null}
		</section>
	);
}
