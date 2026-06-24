"use client";

import {
	FileImage,
	Folder,
	ListChecks,
	type LucideIcon,
	MoreHorizontal,
	Pencil,
	Plus,
	Search,
	SlidersHorizontal,
	Trash2,
	Utensils,
	X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	createCategoryAction,
	deleteCategoryAction,
	deleteMenuItemAction,
	updateCategoryAction,
	updateMenuItemAction,
} from "@/actions/menu.actions";
import { BannerManager } from "@/components/admin/BannerManager";
import { FormSubmitButton, SubmitButton } from "@/components/ui/action-button";
import type { BannerItem } from "@/lib/banners";

const MOBILE_ITEMS_BATCH = 8;

type MobileCategory = {
	id: string;
	name: string;
	emoji: string | null;
	sortOrder: number;
	isActive: boolean;
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
};

type MobileMenuBuilderProps = {
	restaurantId: string;
	slug: string;
	currency: string;
	canCreateCategory: boolean;
	categories: MobileCategory[];
	bannerItems: BannerItem[];
	maxCategories: number;
	maxMenuItems: number;
};

type MobileTab = "items" | "categories" | "banners";

type MobileItem = MobileCategory["items"][number] & {
	categoryId: string;
	categoryName: string;
};

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

function formatLimit(max: number) {
	return max < 0 ? "Unlimited" : String(max);
}

async function uploadItemPhoto(
	restaurantId: string,
	file: File,
	input: HTMLInputElement,
) {
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

export function MobileMenuBuilder({
	restaurantId,
	slug,
	currency,
	canCreateCategory,
	categories,
	bannerItems,
	maxCategories,
	maxMenuItems,
}: MobileMenuBuilderProps) {
	const [activeTab, setActiveTab] = useState<MobileTab>("items");
	const items = useMemo(
		() =>
			categories.flatMap((category) =>
				category.items.map((item) => ({
					...item,
					categoryId: category.id,
					categoryName: category.name,
				})),
			),
		[categories],
	);
	const [searchTerm, setSearchTerm] = useState("");
	const [visibleCount, setVisibleCount] = useState(MOBILE_ITEMS_BATCH);
	const [editingItem, setEditingItem] = useState<MobileItem | null>(null);
	const [itemImageOverrides, setItemImageOverrides] = useState<
		Record<string, string>
	>({});
	const loadMoreRef = useRef<HTMLDivElement | null>(null);
	const filteredItems = useMemo(() => {
		const query = searchTerm.trim().toLowerCase();
		if (!query) return items;

		return items.filter(
			(item) =>
				item.name.toLowerCase().includes(query) ||
				(item.description?.toLowerCase().includes(query) ?? false) ||
				item.categoryName.toLowerCase().includes(query),
		);
	}, [items, searchTerm]);
	const visibleItems = filteredItems
		.slice(0, visibleCount)
		.map((item) =>
			itemImageOverrides[item.id]
				? { ...item, imageUrl: itemImageOverrides[item.id] }
				: item,
		);
	const hasMoreItems = visibleCount < filteredItems.length;

	useEffect(() => {
		const target = loadMoreRef.current;
		if (!target || !hasMoreItems || activeTab !== "items") return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					setVisibleCount((count) =>
						Math.min(count + MOBILE_ITEMS_BATCH, filteredItems.length),
					);
				}
			},
			{ rootMargin: "240px" },
		);

		observer.observe(target);
		return () => observer.disconnect();
	}, [activeTab, filteredItems.length, hasMoreItems]);

	return (
		<div className="grid gap-2.5 md:hidden">
			<section className="rounded-2xl border border-slate-200 bg-white px-1.5 py-2">
				<div className="grid grid-cols-3 divide-x divide-slate-200 text-center">
					<MobileStat
						icon={Folder}
						value={categories.length}
						label="Categories"
						limit={formatLimit(maxCategories)}
						tone="emerald"
					/>
					<MobileStat
						icon={ListChecks}
						value={items.length}
						label="Menu items"
						limit={formatLimit(maxMenuItems)}
						tone="yellow"
					/>
					<MobileStat
						icon={FileImage}
						value={bannerItems.length}
						label="Banners"
						limit="Unlimited"
						tone="blue"
					/>
				</div>
			</section>

			<section className="grid grid-cols-3 rounded-[1.15rem] border border-slate-200 bg-white p-1">
				<MobileTabButton
					active={activeTab === "items"}
					icon={Utensils}
					label="Items"
					onClick={() => setActiveTab("items")}
				/>
				<MobileTabButton
					active={activeTab === "categories"}
					icon={Folder}
					label="Categories"
					onClick={() => setActiveTab("categories")}
				/>
				<MobileTabButton
					active={activeTab === "banners"}
					icon={FileImage}
					label="Banners"
					onClick={() => setActiveTab("banners")}
				/>
			</section>

			{activeTab === "items" ? (
				<section className="grid gap-2.5">
					<div className="grid grid-cols-[minmax(0,1fr)_3.25rem] gap-2.5">
						<label className="flex min-h-12 items-center gap-2.5 rounded-[1rem] border border-slate-200 bg-white px-3 text-sm font-bold text-slate-500">
							<Search className="size-5 shrink-0" aria-hidden="true" />
							<input
								type="search"
								placeholder="Search menu items..."
								value={searchTerm}
								onChange={(event) => {
									setSearchTerm(event.currentTarget.value);
									setVisibleCount(MOBILE_ITEMS_BATCH);
								}}
								className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-slate-500"
							/>
						</label>
						<button
							type="button"
							className="grid min-h-12 place-items-center rounded-[1rem] border border-slate-200 bg-white text-slate-600"
							aria-label="Filter menu items"
						>
							<SlidersHorizontal className="size-5" aria-hidden="true" />
						</button>
					</div>

					<div className="grid gap-2.5">
						{visibleItems.length > 0 ? (
							visibleItems.map((item) => (
								<MobileItemCard
									key={item.id}
									item={item}
									currency={currency}
									onEdit={() => setEditingItem(item)}
								/>
							))
						) : (
							<div className="rounded-[1.35rem] border border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-500">
								No menu items yet.
							</div>
						)}
						{hasMoreItems ? (
							<div
								ref={loadMoreRef}
								className="py-4 text-center text-sm font-bold text-slate-500"
							>
								Loading more items...
							</div>
						) : null}
					</div>

					<FormSubmitButton
						form="new-menu-item-form"
						loadingText="Creating..."
						successText="Created"
						className="fixed right-5 bottom-28 z-30 grid gap-1 text-center text-xs font-medium text-slate-700"
					>
						<span className="grid size-16 place-items-center rounded-full bg-emerald-700 text-white shadow-[0_18px_36px_rgba(4,120,87,0.25)]">
							<Plus className="size-8" aria-hidden="true" />
						</span>
						Add item
					</FormSubmitButton>
				</section>
			) : null}

			{activeTab === "categories" ? (
				<MobileCategorySection
					restaurantId={restaurantId}
					slug={slug}
					canCreateCategory={canCreateCategory}
					categories={categories}
				/>
			) : null}

			{activeTab === "banners" ? (
				<BannerManager
					restaurantId={restaurantId}
					slug={slug}
					bannerItems={bannerItems}
				/>
			) : null}

			{editingItem ? (
				<MobileItemEditModal
					restaurantId={restaurantId}
					slug={slug}
					currency={currency}
					categories={categories}
					item={editingItem}
					onClose={() => setEditingItem(null)}
					onImageSaved={(imageUrl) => {
						if (!imageUrl) return;
						setItemImageOverrides((overrides) => ({
							...overrides,
							[editingItem.id]: imageUrl,
						}));
					}}
				/>
			) : null}
		</div>
	);
}

function MobileCategorySection({
	restaurantId,
	slug,
	canCreateCategory,
	categories,
}: {
	restaurantId: string;
	slug: string;
	canCreateCategory: boolean;
	categories: MobileCategory[];
}) {
	return (
		<section className="grid min-w-0 gap-3">
			<form
				action={createCategoryAction}
				className="grid min-w-0 gap-2 rounded-[1.35rem] border border-slate-200 bg-white p-3"
			>
				<input type="hidden" name="restaurantId" value={restaurantId} />
				<input type="hidden" name="slug" value={slug} />
				<input type="hidden" name="emoji" value="" />
				<input type="hidden" name="sortOrder" value={categories.length + 1} />
				<label className="grid gap-1 text-base font-medium text-slate-600">
					New category
					<input
						name="name"
						required
						placeholder="Category name"
						className="min-h-12 rounded-2xl border border-slate-200 px-4 text-base font-bold text-slate-950 outline-none focus:border-emerald-700"
					/>
				</label>
				<SubmitButton
					disabled={!canCreateCategory}
					loadingText="Creating..."
					successText="Created"
					className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-base font-medium text-white disabled:opacity-50"
				>
					<Plus className="size-5" aria-hidden="true" />
					Add category
				</SubmitButton>
			</form>

			<div className="grid min-w-0 gap-3">
				{categories.length > 0 ? (
					categories.map((category) => (
						<MobileCategoryCard
							key={category.id}
							restaurantId={restaurantId}
							slug={slug}
							category={category}
						/>
					))
				) : (
					<div className="rounded-[1.35rem] border border-slate-200 bg-white p-6 text-center text-sm font-bold text-slate-500">
						No categories yet.
					</div>
				)}
			</div>
		</section>
	);
}

function MobileCategoryCard({
	restaurantId,
	slug,
	category,
}: {
	restaurantId: string;
	slug: string;
	category: MobileCategory;
}) {
	return (
		<article className="min-w-0 rounded-[1.35rem] border border-slate-200 bg-white p-3">
			<form
				id={`mobile-category-${category.id}`}
				action={updateCategoryAction}
				className="grid min-w-0 gap-3"
			>
				<input type="hidden" name="restaurantId" value={restaurantId} />
				<input type="hidden" name="slug" value={slug} />
				<input type="hidden" name="categoryId" value={category.id} />
				{category.isActive ? (
					<input type="hidden" name="isActive" value="on" />
				) : null}
				<div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-3">
					<input
						name="emoji"
						defaultValue={category.emoji ?? ""}
						placeholder="🍽"
						className="size-12 rounded-2xl border border-slate-200 bg-white text-center text-base outline-none focus:border-emerald-700"
					/>
					<div className="min-w-0">
						<input
							name="name"
							defaultValue={category.name}
							required
							className="min-h-8 w-full min-w-0 rounded-lg border border-transparent bg-transparent text-lg font-semibold text-slate-950 outline-none focus:border-emerald-700 focus:px-2"
						/>
						<p className="mt-1 truncate text-sm font-medium text-slate-500">
							{category.items.length} items
						</p>
					</div>
				</div>
				<div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
					<label className="min-w-0 text-sm font-medium text-slate-500">
						Order
						<input
							name="sortOrder"
							type="number"
							min="0"
							defaultValue={category.sortOrder}
							className="mt-1 min-h-10 w-full rounded-xl border border-slate-200 px-3 text-base font-bold text-slate-900 outline-none focus:border-emerald-700"
						/>
					</label>
					<span className="inline-flex min-h-10 items-center rounded-full bg-emerald-50 px-3 text-sm font-bold text-emerald-700">
						{category.isActive ? "Published" : "Draft"}
					</span>
					<SubmitButton
						loadingText="Saving..."
						successText="Saved"
						className="grid size-10 place-items-center rounded-xl bg-slate-50 text-slate-700"
						aria-label={`Save ${category.name}`}
					>
						<Pencil className="size-4" aria-hidden="true" />
					</SubmitButton>
				</div>
			</form>
			<form action={deleteCategoryAction} className="mt-2">
				<input type="hidden" name="restaurantId" value={restaurantId} />
				<input type="hidden" name="slug" value={slug} />
				<input type="hidden" name="categoryId" value={category.id} />
				<SubmitButton
					loadingText="Deleting..."
					successText="Deleted"
					className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-3 text-sm font-black text-red-600"
				>
					<Trash2 className="size-4" aria-hidden="true" />
					Delete category
				</SubmitButton>
			</form>
		</article>
	);
}

function MobileStat({
	icon: Icon,
	value,
	label,
	limit,
	tone,
}: {
	icon: LucideIcon;
	value: number;
	label: string;
	limit: string;
	tone: "emerald" | "yellow" | "blue";
}) {
	const toneClass =
		tone === "emerald"
			? "bg-emerald-50 text-emerald-700"
			: tone === "yellow"
				? "bg-yellow-50 text-yellow-600"
				: "bg-blue-50 text-blue-600";
	const valueClass =
		tone === "emerald"
			? "text-emerald-700"
			: tone === "yellow"
				? "text-yellow-600"
				: "text-blue-600";

	return (
		<div className="grid justify-items-center gap-1 px-1">
			<span
				className={`grid size-9 place-items-center rounded-full ${toneClass}`}
			>
				<Icon className="size-[1.1rem]" aria-hidden="true" />
			</span>
			<p
				className={`text-2xl font-black leading-none font-semibold ${valueClass}`}
			>
				{value}
			</p>
			<p className="text-sm font-bold leading-tight text-slate-500">{label}</p>
			<p className="text-xs font-medium leading-tight text-slate-500">
				{limit}
			</p>
		</div>
	);
}

function MobileTabButton({
	active,
	icon: Icon,
	label,
	onClick,
}: {
	active: boolean;
	icon: LucideIcon;
	label: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={
				active
					? "flex min-h-12 items-center justify-center gap-2 rounded-[0.9rem] bg-emerald-700 text-sm font-semibold text-white"
					: "flex min-h-12 items-center justify-center gap-2 rounded-[0.9rem] text-sm font-bold text-slate-600"
			}
		>
			<Icon className="size-5" aria-hidden="true" />
			{label}
		</button>
	);
}

function MobileItemCard({
	item,
	currency,
	onEdit,
}: {
	item: MobileItem;
	currency: string;
	onEdit: () => void;
}) {
	return (
		<article className="grid grid-cols-[5.75rem_minmax(0,1fr)_auto] items-start gap-3 rounded-[1.15rem] border border-slate-200 bg-white p-2.5">
			<div className="relative h-[5.75rem] overflow-hidden rounded-[1rem] bg-emerald-50">
				{item.imageUrl ? (
					<Image
						src={item.imageUrl}
						alt={item.name}
						fill
						className="object-cover"
						sizes="112px"
						unoptimized
					/>
				) : (
					<div className="grid h-full place-items-center text-emerald-700">
						<Utensils className="size-8" aria-hidden="true" />
					</div>
				)}
			</div>
			<div className="flex min-h-[5.75rem] min-w-0 flex-col justify-between">
				<div className="min-w-0">
					<h3 className="line-clamp-1 text-md font-semibold leading-tight text-slate-950">
						{item.name}
					</h3>
					<p className="mt-0.5 line-clamp-2 text-sm font-medium leading-5 text-slate-500">
						{item.description ?? "No description"}
					</p>
					<span className="mt-1 inline-flex min-h-6 items-center rounded-full bg-emerald-50 px-2.5 text-xs font-bold text-emerald-700">
						{item.categoryName}
					</span>
				</div>
				<p className="text-md font-bold leading-none text-emerald-800">
					{formatMoney(item.price, currency)}
				</p>
			</div>
			<div className="grid min-h-[5.75rem] content-between justify-items-end">
				<span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 text-xs font-bold text-emerald-700">
					<span className="size-2 rounded-full bg-emerald-700" />
					{item.isAvailable ? "Published" : "Draft"}
				</span>
				<button
					type="button"
					onClick={onEdit}
					className="grid size-11 place-items-center rounded-2xl bg-slate-50 text-slate-950"
					aria-label={`Edit ${item.name}`}
				>
					<MoreHorizontal className="size-5" aria-hidden="true" />
				</button>
			</div>
		</article>
	);
}

function MobileItemEditModal({
	restaurantId,
	slug,
	categories,
	item,
	onClose,
	onImageSaved,
}: {
	restaurantId: string;
	slug: string;
	currency: string;
	categories: MobileCategory[];
	item: MobileItem;
	onClose: () => void;
	onImageSaved: (imageUrl: string) => void;
}) {
	const inputId = `mobile-item-image-${item.id}`;
	const hiddenImageInputRef = useRef<HTMLInputElement>(null);
	const latestImageUrlRef = useRef(item.imageUrl ?? "");
	const [previewUrl, setPreviewUrl] = useState(item.imageUrl ?? "");
	const [isUploading, setIsUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);

	return (
		<div className="fixed inset-0 z-50 grid items-end bg-slate-950/45 p-3">
			<button
				type="button"
				className="absolute inset-0"
				onClick={onClose}
				aria-label="Close edit item modal"
			/>
			<div className="relative max-h-[88vh] overflow-y-auto rounded-[1.25rem] bg-white p-3.5">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h3 className="text-lg font-black text-slate-950">Edit item</h3>
						<p className="mt-1 text-sm font-medium text-slate-500">
							Update this menu item.
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="grid size-11 place-items-center rounded-full bg-slate-50 text-slate-600"
						aria-label="Close edit item modal"
					>
						<X className="size-5" aria-hidden="true" />
					</button>
				</div>

				<form action={updateMenuItemAction} className="mt-4 grid gap-3">
					<input type="hidden" name="restaurantId" value={restaurantId} />
					<input type="hidden" name="slug" value={slug} />
					<input type="hidden" name="itemId" value={item.id} />
					<input
						type="hidden"
						id={inputId}
						ref={hiddenImageInputRef}
						name="imageUrl"
						value={previewUrl}
						readOnly
					/>

					<label className="grid gap-1 text-sm font-black text-slate-700">
						Category
						<select
							name="categoryId"
							defaultValue={item.categoryId}
							className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-bold text-slate-950 outline-none focus:border-emerald-700"
						>
							{categories.map((category) => (
								<option key={category.id} value={category.id}>
									{category.name}
								</option>
							))}
						</select>
					</label>
					<label className="grid gap-1 text-sm font-black text-slate-700">
						Item name
						<input
							name="name"
							required
							defaultValue={item.name}
							className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-bold text-slate-950 outline-none focus:border-emerald-700"
						/>
					</label>
					<label className="grid gap-1 text-sm font-black text-slate-700">
						Description
						<textarea
							name="description"
							defaultValue={item.description ?? ""}
							rows={3}
							className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-medium text-slate-950 outline-none focus:border-emerald-700"
						/>
					</label>
					<label className="grid gap-1 text-sm font-black text-slate-700">
						Price
						<input
							name="price"
							type="number"
							min="0"
							step="0.01"
							required
							defaultValue={item.price}
							className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-bold text-slate-950 outline-none focus:border-emerald-700"
						/>
					</label>
					<div className="grid grid-cols-2 gap-2">
						<label className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700">
							Published
							<input
								name="isAvailable"
								type="checkbox"
								defaultChecked={item.isAvailable}
								className="size-5 accent-emerald-700"
							/>
						</label>
						<label className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700">
							Special
							<input
								name="isTodaySpecial"
								type="checkbox"
								defaultChecked={item.isTodaySpecial}
								className="size-5 accent-emerald-700"
							/>
						</label>
					</div>
					<label className="grid gap-1 text-sm font-black text-slate-700">
						Display order
						<input
							name="sortOrder"
							type="number"
							min="0"
							defaultValue={item.sortOrder}
							className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-bold text-slate-950 outline-none focus:border-emerald-700"
						/>
					</label>
					<label className="grid gap-2">
						<span className="text-sm font-black text-slate-700">
							Photo upload
						</span>
						<input
							type="file"
							accept="image/webp,image/jpeg,image/png"
							className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
							onChange={async (event) => {
								const fileInput = event.currentTarget;
								const file = fileInput.files?.[0];
								const hiddenInput = hiddenImageInputRef.current;
								if (!file || !hiddenInput) return;
								setUploadError(null);
								try {
									setIsUploading(true);
									await uploadItemPhoto(restaurantId, file, hiddenInput);
									setPreviewUrl(hiddenInput.value);
									latestImageUrlRef.current = hiddenInput.value;
								} catch (error) {
									setUploadError(
										error instanceof Error
											? error.message
											: "Unable to upload item photo.",
									);
								} finally {
									setIsUploading(false);
									fileInput.value = "";
								}
							}}
						/>
					</label>
					{isUploading ? (
						<p className="text-sm font-black text-emerald-700">Uploading...</p>
					) : null}
					{uploadError ? (
						<p className="text-sm font-black text-red-600">{uploadError}</p>
					) : null}
					{previewUrl ? (
						<div className="relative h-36 overflow-hidden rounded-xl bg-emerald-50">
							<Image
								src={previewUrl}
								alt={item.name}
								fill
								className="object-cover"
								sizes="360px"
								unoptimized
							/>
						</div>
					) : null}
					<SubmitButton
						loadingText="Updating..."
						successText="Updated"
						onSuccess={() => {
							const savedImageUrl =
								hiddenImageInputRef.current?.value || latestImageUrlRef.current;
							onImageSaved(savedImageUrl);
							onClose();
						}}
						className="min-h-11 rounded-xl bg-emerald-700 px-4 text-base font-black text-white"
					>
						Save changes
					</SubmitButton>
				</form>

				<form action={deleteMenuItemAction} className="mt-3">
					<input type="hidden" name="restaurantId" value={restaurantId} />
					<input type="hidden" name="slug" value={slug} />
					<input type="hidden" name="itemId" value={item.id} />
					<SubmitButton
						loadingText="Deleting..."
						successText="Deleted"
						onSuccess={onClose}
						className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 text-sm font-black text-red-600"
					>
						<Trash2 className="size-4" aria-hidden="true" />
						Delete item
					</SubmitButton>
				</form>
			</div>
		</div>
	);
}
