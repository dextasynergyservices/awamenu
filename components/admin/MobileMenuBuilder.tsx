"use client";

import {
	ChevronLeft,
	ChevronRight,
	FileImage,
	Folder,
	FolderPlus,
	LayoutGrid,
	ListChecks,
	type LucideIcon,
	MoreHorizontal,
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
	createBannerAction,
	createCategoryAction,
	createMenuItemAction,
	deleteCategoryAction,
	deleteMenuItemAction,
	removeBannerAction,
	updateBannerAction,
	updateCategoryAction,
	updateMenuItemAction,
} from "@/actions/menu.actions";
import { MenuLayoutModal } from "@/components/admin/MenuLayoutModal";
import { SubmitButton } from "@/components/ui/action-button";
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
	activeTemplate: string;
	availableTemplates: string[];
};

const templateLabels: Record<string, string> = {
	classic: "Classic",
	grid: "Grid",
	compact: "Compact",
	magazine: "Magazine",
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
	activeTemplate,
	availableTemplates,
}: MobileMenuBuilderProps) {
	const [activeTab, setActiveTab] = useState<MobileTab>("items");
	const [layoutModalOpen, setLayoutModalOpen] = useState(false);
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
	const [isCreatingItem, setIsCreatingItem] = useState(false);
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
					<button
						type="button"
						onClick={() => setLayoutModalOpen(true)}
						className="flex min-h-10 items-center justify-between gap-2 rounded-[1rem] border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700"
					>
						<span className="flex items-center gap-2">
							<LayoutGrid
								className="size-4 text-emerald-700"
								aria-hidden="true"
							/>
							Menu Layout
						</span>
						<span className="flex items-center gap-1 text-emerald-700">
							{templateLabels[activeTemplate] ?? "Classic"}
							<ChevronRight className="size-3.5" aria-hidden="true" />
						</span>
					</button>

					<div className="grid grid-cols-[minmax(0,1fr)_3.25rem] gap-2.5">
						<label className="flex min-h-10 items-center gap-2 rounded-[1rem] border border-slate-200 bg-white px-3 text-sm font-bold text-slate-500">
							<Search className="size-4 shrink-0" aria-hidden="true" />
							<input
								type="search"
								placeholder="Search menu items..."
								value={searchTerm}
								onChange={(event) => {
									setSearchTerm(event.currentTarget.value);
									setVisibleCount(MOBILE_ITEMS_BATCH);
								}}
								className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
							/>
						</label>
						<button
							type="button"
							className="grid min-h-10 place-items-center rounded-[1rem] border border-slate-200 bg-white text-slate-600"
							aria-label="Filter menu items"
						>
							<SlidersHorizontal className="size-4" aria-hidden="true" />
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
						) : categories.length === 0 ? (
							<div className="rounded-[1.35rem] border border-emerald-100 border-dashed bg-emerald-50/60 p-5 text-center">
								<div className="mx-auto grid size-11 place-items-center rounded-xl bg-white text-emerald-700 shadow-sm">
									<FolderPlus className="size-5" aria-hidden="true" />
								</div>
								<h3 className="mt-3 text-sm font-black text-slate-950">
									Create a category first
								</h3>
								<p className="mt-1 text-xs font-medium leading-5 text-slate-600">
									Menu items live inside categories like{" "}
									<span className="font-bold text-slate-800">Starters</span> or{" "}
									<span className="font-bold text-slate-800">Drinks</span>. Add
									one to start building your menu.
								</p>
								<button
									type="button"
									onClick={() => setActiveTab("categories")}
									className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white"
								>
									<FolderPlus className="size-4" aria-hidden="true" />
									Add your first category
								</button>
							</div>
						) : (
							<div className="rounded-[1.35rem] border border-slate-200 bg-white p-6 text-center text-xs font-bold text-slate-500">
								No menu items yet.
							</div>
						)}
						{hasMoreItems ? (
							<div
								ref={loadMoreRef}
								className="py-4 text-center text-xs font-bold text-slate-500"
							>
								Loading more items...
							</div>
						) : null}
					</div>

					{/* With no categories the item sheet would render an empty
					    category dropdown and fail validation on submit, so the
					    button routes to the categories tab instead. */}
					<button
						type="button"
						onClick={() =>
							categories.length === 0
								? setActiveTab("categories")
								: setIsCreatingItem(true)
						}
						className="fixed right-5 bottom-28 z-30 grid gap-1 text-center text-xs font-medium text-slate-700"
					>
						<span className="grid size-12 place-items-center rounded-full bg-emerald-700 text-white shadow-lg">
							<Plus className="size-5" aria-hidden="true" />
						</span>
						{categories.length === 0 ? "Add category" : "Add item"}
					</button>
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
				<MobileBannerSection
					restaurantId={restaurantId}
					slug={slug}
					bannerItems={bannerItems}
				/>
			) : null}

			{isCreatingItem ? (
				<MobileItemCreateModal
					restaurantId={restaurantId}
					slug={slug}
					categories={categories}
					sortOrder={items.length + 1}
					onClose={() => setIsCreatingItem(false)}
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

			{layoutModalOpen ? (
				<MenuLayoutModal
					slug={slug}
					activeTemplate={activeTemplate}
					availableTemplates={availableTemplates}
					onClose={() => setLayoutModalOpen(false)}
				/>
			) : null}
		</div>
	);
}

function categoryKey(category: MobileCategory) {
	return category.id;
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
	const CATEGORIES_PER_PAGE = 3;
	const [localCategories, setLocalCategories] = useState(categories);
	const [editingCategory, setEditingCategory] = useState<
		MobileCategory | "new" | null
	>(null);
	const [currentPage, setCurrentPage] = useState(0);
	const totalPages = Math.max(
		1,
		Math.ceil(localCategories.length / CATEGORIES_PER_PAGE),
	);
	const page = Math.min(currentPage, totalPages - 1);
	const paginatedCategories = localCategories.slice(
		page * CATEGORIES_PER_PAGE,
		page * CATEGORIES_PER_PAGE + CATEGORIES_PER_PAGE,
	);

	return (
		<section className="grid min-w-0 gap-2.5">
			<button
				type="button"
				onClick={() => setEditingCategory("new")}
				disabled={!canCreateCategory}
				className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-200 border-dashed bg-emerald-50/30 text-emerald-700 disabled:opacity-50"
			>
				<Plus className="size-4" aria-hidden="true" />
				<span className="text-xs font-black">Add category</span>
			</button>

			<div className="grid min-w-0 gap-2.5">
				{paginatedCategories.length > 0 ? (
					paginatedCategories.map((category) => (
						<MobileCategoryCard
							key={categoryKey(category)}
							category={category}
							onSelect={() => setEditingCategory(category)}
						/>
					))
				) : (
					<div className="rounded-[1.35rem] border border-slate-200 bg-white p-6 text-center text-xs font-bold text-slate-500">
						No categories yet.
					</div>
				)}
			</div>

			{localCategories.length > CATEGORIES_PER_PAGE ? (
				<div className="flex items-center justify-between gap-3">
					<button
						type="button"
						onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
						disabled={page === 0}
						className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-40"
					>
						<ChevronLeft className="size-3.5" aria-hidden="true" />
						Previous
					</button>
					<p className="text-xs font-semibold text-slate-500">
						Page {page + 1} of {totalPages}
					</p>
					<button
						type="button"
						onClick={() =>
							setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
						}
						disabled={page >= totalPages - 1}
						className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 disabled:opacity-40"
					>
						Next
						<ChevronRight className="size-3.5" aria-hidden="true" />
					</button>
				</div>
			) : null}

			{editingCategory ? (
				<MobileCategoryFormModal
					restaurantId={restaurantId}
					slug={slug}
					category={editingCategory === "new" ? null : editingCategory}
					sortOrder={
						editingCategory === "new"
							? localCategories.length + 1
							: editingCategory.sortOrder
					}
					onClose={() => setEditingCategory(null)}
					onSaved={(saved) => {
						if (editingCategory === "new") {
							setLocalCategories((current) => [...current, saved]);
							return;
						}
						setLocalCategories((current) =>
							current.map((category) =>
								categoryKey(category) === categoryKey(editingCategory)
									? saved
									: category,
							),
						);
					}}
					onDeleted={() => {
						if (editingCategory === "new") return;
						setLocalCategories((current) =>
							current.filter(
								(category) =>
									categoryKey(category) !== categoryKey(editingCategory),
							),
						);
					}}
				/>
			) : null}
		</section>
	);
}

function MobileCategoryCard({
	category,
	onSelect,
}: {
	category: MobileCategory;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className="flex min-w-0 items-center gap-3 rounded-[1.15rem] border border-slate-200 bg-white p-3 text-left"
		>
			<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-base">
				{category.emoji || "🍽"}
			</span>
			<span className="min-w-0 flex-1">
				<span className="block truncate text-sm font-semibold text-slate-950">
					{category.name}
				</span>
				<span className="block text-xs font-medium text-slate-500">
					{category.items.length} item{category.items.length === 1 ? "" : "s"}
				</span>
			</span>
			{!category.isActive ? (
				<span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
					Draft
				</span>
			) : null}
		</button>
	);
}

function MobileCategoryFormModal({
	restaurantId,
	slug,
	category,
	sortOrder,
	onClose,
	onSaved,
	onDeleted,
}: {
	restaurantId: string;
	slug: string;
	category: MobileCategory | null;
	sortOrder: number;
	onClose: () => void;
	onSaved: (category: MobileCategory) => void;
	onDeleted: () => void;
}) {
	const isEditing = Boolean(category);
	const [emoji, setEmoji] = useState(category?.emoji ?? "");
	const [name, setName] = useState(category?.name ?? "");
	const [isActive, setIsActive] = useState(category?.isActive ?? true);

	return (
		<div className="fixed inset-0 z-50 grid items-end bg-slate-950/45 p-3">
			<button
				type="button"
				className="absolute inset-0"
				onClick={onClose}
				aria-label="Close category form"
			/>
			<div className="relative max-h-[88vh] overflow-y-auto rounded-[1.25rem] bg-white p-3.5">
				<div className="flex items-start justify-between gap-4">
					<h3 className="text-sm font-black text-slate-950">
						{isEditing ? "Edit category" : "Add category"}
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="grid size-11 place-items-center rounded-full bg-slate-50 text-slate-600"
						aria-label="Close category form"
					>
						<X className="size-5" aria-hidden="true" />
					</button>
				</div>

				<form
					action={isEditing ? updateCategoryAction : createCategoryAction}
					className="mt-4 grid gap-3"
				>
					<input type="hidden" name="restaurantId" value={restaurantId} />
					<input type="hidden" name="slug" value={slug} />
					{isEditing && category ? (
						<input type="hidden" name="categoryId" value={category.id} />
					) : null}
					<input type="hidden" name="sortOrder" value={sortOrder} />
					{isEditing && isActive ? (
						<input type="hidden" name="isActive" value="on" />
					) : null}

					<div className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3">
						<label className="grid gap-1 text-xs font-black text-slate-700">
							Icon
							<input
								name="emoji"
								value={emoji}
								onChange={(event) => setEmoji(event.currentTarget.value)}
								placeholder="🍽"
								className="min-h-11 w-full rounded-xl border border-slate-200 bg-white text-center text-base outline-none focus:border-emerald-700"
							/>
						</label>
						<label className="grid gap-1 text-xs font-black text-slate-700">
							Category name
							<input
								name="name"
								value={name}
								onChange={(event) => setName(event.currentTarget.value)}
								required
								placeholder="e.g. Local Foods"
								className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-bold text-slate-950 outline-none focus:border-emerald-700"
							/>
						</label>
					</div>

					{isEditing ? (
						<label className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700">
							Published
							<input
								type="checkbox"
								checked={isActive}
								onChange={(event) => setIsActive(event.currentTarget.checked)}
								className="size-5 accent-emerald-700"
							/>
						</label>
					) : null}

					<SubmitButton
						loadingText={isEditing ? "Saving..." : "Creating..."}
						successText={isEditing ? "Saved" : "Created"}
						onSuccess={() => {
							onSaved({
								id: category?.id ?? crypto.randomUUID(),
								name,
								emoji: emoji || null,
								sortOrder,
								isActive: isEditing ? isActive : true,
								items: category?.items ?? [],
							});
							onClose();
						}}
						className="min-h-11 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white disabled:opacity-50"
					>
						{isEditing ? "Save changes" : "Add category"}
					</SubmitButton>
				</form>

				{isEditing && category ? (
					<form action={deleteCategoryAction} className="mt-3">
						<input type="hidden" name="restaurantId" value={restaurantId} />
						<input type="hidden" name="slug" value={slug} />
						<input type="hidden" name="categoryId" value={category.id} />
						<SubmitButton
							loadingText="Deleting..."
							successText="Deleted"
							onSuccess={() => {
								onDeleted();
								onClose();
							}}
							className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 text-xs font-black text-red-600"
						>
							<Trash2 className="size-3.5" aria-hidden="true" />
							Delete category
						</SubmitButton>
					</form>
				) : null}
			</div>
		</div>
	);
}

async function uploadBannerPhoto(restaurantId: string, file: File) {
	if (!["image/webp", "image/jpeg", "image/png"].includes(file.type)) {
		throw new Error("Banner images must be WebP, JPG, or PNG images.");
	}

	const res = await fetch("/api/upload", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			restaurantId,
			kind: "cover",
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
		throw new Error("Unable to upload banner image.");
	}

	const uploadPayload = (await uploadRes.json()) as { secure_url?: string };
	if (!uploadPayload.secure_url) {
		throw new Error("Cloudinary did not return an image URL.");
	}

	return uploadPayload.secure_url.replace("/upload/", "/upload/f_webp,q_auto/");
}

function bannerKey(banner: BannerItem) {
	return banner.id ?? banner.url;
}

function MobileBannerSection({
	restaurantId,
	slug,
	bannerItems,
}: {
	restaurantId: string;
	slug: string;
	bannerItems: BannerItem[];
}) {
	const [banners, setBanners] = useState(bannerItems);
	const [editingBanner, setEditingBanner] = useState<BannerItem | "new" | null>(
		null,
	);
	const [activeIndex, setActiveIndex] = useState(0);
	const currentIndex = Math.min(activeIndex, Math.max(banners.length - 1, 0));

	return (
		<section className="grid gap-2.5">
			<button
				type="button"
				onClick={() => setEditingBanner("new")}
				className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-200 border-dashed bg-emerald-50/30 text-emerald-700"
			>
				<Plus className="size-4" aria-hidden="true" />
				<span className="text-xs font-black">Add banner</span>
			</button>

			{banners.length > 0 ? (
				<div className="grid gap-2">
					<div className="relative">
						<MobileBannerCard
							key={bannerKey(banners[currentIndex])}
							banner={banners[currentIndex]}
							onSelect={() => setEditingBanner(banners[currentIndex])}
						/>
						{banners.length > 1 ? (
							<>
								<button
									type="button"
									onClick={() =>
										setActiveIndex(
											(index) => (index - 1 + banners.length) % banners.length,
										)
									}
									className="-translate-y-1/2 absolute top-1/2 left-2 grid size-8 place-items-center rounded-full bg-white/90 text-slate-700 shadow-sm"
									aria-label="Previous banner"
								>
									<ChevronLeft className="size-4" aria-hidden="true" />
								</button>
								<button
									type="button"
									onClick={() =>
										setActiveIndex((index) => (index + 1) % banners.length)
									}
									className="-translate-y-1/2 absolute top-1/2 right-2 grid size-8 place-items-center rounded-full bg-white/90 text-slate-700 shadow-sm"
									aria-label="Next banner"
								>
									<ChevronRight className="size-4" aria-hidden="true" />
								</button>
							</>
						) : null}
					</div>
					{banners.length > 1 ? (
						<div className="flex items-center justify-center gap-1.5">
							{banners.map((banner, index) => (
								<button
									key={bannerKey(banner)}
									type="button"
									onClick={() => setActiveIndex(index)}
									aria-label={`Go to banner ${index + 1}`}
									className={`h-1.5 rounded-full transition-all ${
										index === currentIndex
											? "w-5 bg-emerald-700"
											: "w-1.5 bg-slate-200"
									}`}
								/>
							))}
						</div>
					) : null}
				</div>
			) : (
				<div className="rounded-[1.35rem] border border-slate-200 bg-white p-6 text-center text-xs font-bold text-slate-500">
					No banners yet.
				</div>
			)}

			{editingBanner ? (
				<MobileBannerFormModal
					restaurantId={restaurantId}
					slug={slug}
					banner={editingBanner === "new" ? null : editingBanner}
					sortOrder={
						editingBanner === "new"
							? banners.length + 1
							: (banners.findIndex(
									(banner) => bannerKey(banner) === bannerKey(editingBanner),
								) ?? 0) + 1
					}
					onClose={() => setEditingBanner(null)}
					onSaved={(saved) => {
						if (editingBanner === "new") {
							setBanners((current) => [...current, saved]);
							setActiveIndex(banners.length);
							return;
						}
						setBanners((current) =>
							current.map((banner) =>
								bannerKey(banner) === bannerKey(editingBanner) ? saved : banner,
							),
						);
					}}
					onDeleted={() => {
						if (editingBanner === "new") return;
						setBanners((current) =>
							current.filter(
								(banner) => bannerKey(banner) !== bannerKey(editingBanner),
							),
						);
					}}
				/>
			) : null}
		</section>
	);
}

function MobileBannerCard({
	banner,
	onSelect,
}: {
	banner: BannerItem;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onSelect}
			className="block w-full overflow-hidden rounded-[1.15rem] border border-slate-200 bg-white text-left"
		>
			<div className="relative h-24 bg-emerald-50">
				<Image
					src={banner.url}
					alt={banner.title ?? "Banner"}
					fill
					className="object-cover"
					sizes="360px"
					unoptimized
				/>
				{banner.title || banner.subtitle ? (
					<div className="absolute inset-x-0 bottom-0 bg-emerald-950/70 p-2.5 text-white">
						{banner.title ? (
							<p className="line-clamp-1 text-xs font-semibold leading-tight">
								{banner.title}
							</p>
						) : null}
						{banner.subtitle ? (
							<p className="mt-0.5 line-clamp-1 text-xs font-medium text-white/85">
								{banner.subtitle}
							</p>
						) : null}
					</div>
				) : null}
			</div>
		</button>
	);
}

function MobileBannerFormModal({
	restaurantId,
	slug,
	banner,
	sortOrder,
	onClose,
	onSaved,
	onDeleted,
}: {
	restaurantId: string;
	slug: string;
	banner: BannerItem | null;
	sortOrder: number;
	onClose: () => void;
	onSaved: (banner: BannerItem) => void;
	onDeleted: () => void;
}) {
	const isEditing = Boolean(banner?.id);
	const [imageUrl, setImageUrl] = useState(banner?.url ?? "");
	const [title, setTitle] = useState(banner?.title ?? "");
	const [subtitle, setSubtitle] = useState(banner?.subtitle ?? "");
	const [isUploading, setIsUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);

	return (
		<div className="fixed inset-0 z-50 grid items-end bg-slate-950/45 p-3">
			<button
				type="button"
				className="absolute inset-0"
				onClick={onClose}
				aria-label="Close banner form"
			/>
			<div className="relative max-h-[88vh] overflow-y-auto rounded-[1.25rem] bg-white p-3.5">
				<div className="flex items-start justify-between gap-4">
					<h3 className="text-sm font-black text-slate-950">
						{isEditing ? "Edit banner" : "Add banner"}
					</h3>
					<button
						type="button"
						onClick={onClose}
						className="grid size-11 place-items-center rounded-full bg-slate-50 text-slate-600"
						aria-label="Close banner form"
					>
						<X className="size-5" aria-hidden="true" />
					</button>
				</div>

				<form
					action={isEditing ? updateBannerAction : createBannerAction}
					className="mt-4 grid gap-3"
				>
					<input type="hidden" name="restaurantId" value={restaurantId} />
					<input type="hidden" name="slug" value={slug} />
					{isEditing && banner?.id ? (
						<input type="hidden" name="bannerId" value={banner.id} />
					) : null}
					<input type="hidden" name="imageUrl" value={imageUrl} />
					<input type="hidden" name="isActive" value="on" />
					<input type="hidden" name="sortOrder" value={sortOrder} />

					{imageUrl ? (
						<div className="relative h-32 overflow-hidden rounded-xl bg-emerald-50">
							<Image
								src={imageUrl}
								alt="Banner preview"
								fill
								className="object-cover"
								sizes="360px"
								unoptimized
							/>
						</div>
					) : null}

					<label className="grid gap-1 text-xs font-black text-slate-700">
						{imageUrl ? "Replace photo" : "Banner photo"}
						<input
							type="file"
							accept="image/webp,image/jpeg,image/png"
							className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs"
							onChange={async (event) => {
								const fileInput = event.currentTarget;
								const file = fileInput.files?.[0];
								if (!file) return;
								setUploadError(null);
								try {
									setIsUploading(true);
									const url = await uploadBannerPhoto(restaurantId, file);
									setImageUrl(url);
								} catch (error) {
									setUploadError(
										error instanceof Error
											? error.message
											: "Unable to upload banner image.",
									);
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
					{uploadError ? (
						<p className="text-xs font-black text-red-600">{uploadError}</p>
					) : null}

					<label className="grid gap-1 text-xs font-black text-slate-700">
						Title
						<textarea
							name="title"
							value={title}
							onChange={(event) => setTitle(event.currentTarget.value)}
							rows={2}
							placeholder="Fresh meals, made with love"
							className="min-h-16 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-medium text-slate-950 outline-none focus:border-emerald-700"
						/>
					</label>
					<label className="grid gap-1 text-xs font-black text-slate-700">
						Subtitle
						<textarea
							name="subtitle"
							value={subtitle}
							onChange={(event) => setSubtitle(event.currentTarget.value)}
							rows={2}
							placeholder="Delicious. Local. Always fresh."
							className="min-h-16 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-medium text-slate-950 outline-none focus:border-emerald-700"
						/>
					</label>

					<SubmitButton
						disabled={!imageUrl}
						loadingText={isEditing ? "Saving..." : "Creating..."}
						successText={isEditing ? "Saved" : "Created"}
						onSuccess={() => {
							onSaved({
								id: banner?.id,
								url: imageUrl,
								title: title || null,
								subtitle: subtitle || null,
								mobilePosition: banner?.mobilePosition ?? "left",
								desktopPosition: banner?.desktopPosition ?? "center",
								size: banner?.size ?? "fill",
							});
							onClose();
						}}
						className="min-h-11 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white disabled:opacity-50"
					>
						{isEditing ? "Save changes" : "Add banner"}
					</SubmitButton>
				</form>

				{isEditing && banner?.id ? (
					<form action={removeBannerAction} className="mt-3">
						<input type="hidden" name="restaurantId" value={restaurantId} />
						<input type="hidden" name="slug" value={slug} />
						<input type="hidden" name="bannerId" value={banner.id} />
						<SubmitButton
							loadingText="Deleting..."
							successText="Deleted"
							onSuccess={() => {
								onDeleted();
								onClose();
							}}
							className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 text-xs font-black text-red-600"
						>
							<Trash2 className="size-3.5" aria-hidden="true" />
							Delete banner
						</SubmitButton>
					</form>
				) : null}
			</div>
		</div>
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
		<div className="grid min-w-0 gap-1 px-1">
			<div className="flex items-center gap-2">
				<span
					className={`grid size-9 shrink-0 place-items-center rounded-full ${toneClass}`}
				>
					<Icon className="size-[1.1rem]" aria-hidden="true" />
				</span>
				<p className={`text-lg font-black leading-none ${valueClass}`}>
					{value}
				</p>
			</div>
			<p className="truncate text-xs font-bold leading-tight text-slate-500">
				{label}
			</p>
			<p className="truncate text-xs font-medium leading-tight text-slate-500">
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
					? "flex min-h-12 items-center justify-center gap-2 rounded-[0.9rem] bg-emerald-700 text-xs font-semibold text-white"
					: "flex min-h-12 items-center justify-center gap-2 rounded-[0.9rem] text-xs font-bold text-slate-600"
			}
		>
			<Icon className="size-3.5" aria-hidden="true" />
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
					<h3 className="line-clamp-1 text-sm font-semibold leading-tight text-slate-950">
						{item.name}
					</h3>
					<p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-slate-500">
						{item.description ?? "No description"}
					</p>
				</div>
				<p className="text-sm font-bold leading-none text-emerald-800">
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
						<h3 className="text-sm font-black text-slate-950">Edit item</h3>
						<p className="mt-1 text-xs font-medium text-slate-500">
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

					<label className="grid gap-1 text-xs font-black text-slate-700">
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
					<label className="grid gap-1 text-xs font-black text-slate-700">
						Item name
						<input
							name="name"
							required
							defaultValue={item.name}
							className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-bold text-slate-950 outline-none focus:border-emerald-700"
						/>
					</label>
					<label className="grid gap-1 text-xs font-black text-slate-700">
						Description
						<textarea
							name="description"
							defaultValue={item.description ?? ""}
							rows={3}
							className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-medium text-slate-950 outline-none focus:border-emerald-700"
						/>
					</label>
					<label className="grid gap-1 text-xs font-black text-slate-700">
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
						<label className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700">
							Published
							<input
								name="isAvailable"
								type="checkbox"
								defaultChecked={item.isAvailable}
								className="size-5 accent-emerald-700"
							/>
						</label>
						<label className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700">
							Special
							<input
								name="isTodaySpecial"
								type="checkbox"
								defaultChecked={item.isTodaySpecial}
								className="size-5 accent-emerald-700"
							/>
						</label>
					</div>
					<label className="grid gap-1 text-xs font-black text-slate-700">
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
						<span className="text-xs font-black text-slate-700">
							Photo upload
						</span>
						<input
							type="file"
							accept="image/webp,image/jpeg,image/png"
							className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs"
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
						<p className="text-xs font-black text-emerald-700">Uploading...</p>
					) : null}
					{uploadError ? (
						<p className="text-xs font-black text-red-600">{uploadError}</p>
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
						className="min-h-11 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white"
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
						className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 text-xs font-black text-red-600"
					>
						<Trash2 className="size-3.5" aria-hidden="true" />
						Delete item
					</SubmitButton>
				</form>
			</div>
		</div>
	);
}

function MobileItemCreateModal({
	restaurantId,
	slug,
	categories,
	sortOrder,
	onClose,
}: {
	restaurantId: string;
	slug: string;
	categories: MobileCategory[];
	sortOrder: number;
	onClose: () => void;
}) {
	const inputId = "mobile-new-item-image";
	const hiddenImageInputRef = useRef<HTMLInputElement>(null);
	const [previewUrl, setPreviewUrl] = useState("");
	const [isUploading, setIsUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);

	return (
		<div className="fixed inset-0 z-50 grid items-end bg-slate-950/45 p-3">
			<button
				type="button"
				className="absolute inset-0"
				onClick={onClose}
				aria-label="Close create item modal"
			/>
			<div className="relative max-h-[88vh] overflow-y-auto rounded-[1.25rem] bg-white p-3.5">
				<div className="flex items-start justify-between gap-4">
					<div>
						<h3 className="text-sm font-black text-slate-950">Add new item</h3>
						<p className="mt-1 text-xs font-medium text-slate-500">
							Create a new menu item.
						</p>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="grid size-11 place-items-center rounded-full bg-slate-50 text-slate-600"
						aria-label="Close create item modal"
					>
						<X className="size-5" aria-hidden="true" />
					</button>
				</div>

				<form action={createMenuItemAction} className="mt-4 grid gap-3">
					<input type="hidden" name="restaurantId" value={restaurantId} />
					<input type="hidden" name="slug" value={slug} />
					<input type="hidden" name="sortOrder" value={sortOrder} />
					<input
						type="hidden"
						id={inputId}
						ref={hiddenImageInputRef}
						name="imageUrl"
						value={previewUrl}
						readOnly
					/>

					<label className="grid gap-1 text-xs font-black text-slate-700">
						Category
						<select
							name="categoryId"
							required
							defaultValue={categories[0]?.id}
							className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-bold text-slate-950 outline-none focus:border-emerald-700"
						>
							{categories.map((category) => (
								<option key={category.id} value={category.id}>
									{category.name}
								</option>
							))}
						</select>
					</label>
					<label className="grid gap-1 text-xs font-black text-slate-700">
						Item name
						<input
							name="name"
							required
							placeholder="e.g. Jollof Rice Special"
							className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-bold text-slate-950 outline-none focus:border-emerald-700"
						/>
					</label>
					<label className="grid gap-1 text-xs font-black text-slate-700">
						Description
						<textarea
							name="description"
							rows={3}
							placeholder="Short description of the item"
							className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-medium text-slate-950 outline-none focus:border-emerald-700"
						/>
					</label>
					<label className="grid gap-1 text-xs font-black text-slate-700">
						Price
						<input
							name="price"
							type="number"
							min="0"
							step="0.01"
							required
							placeholder="0.00"
							className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-bold text-slate-950 outline-none focus:border-emerald-700"
						/>
					</label>
					<div className="grid grid-cols-2 gap-2">
						<label className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700">
							Published
							<input
								name="isAvailable"
								type="checkbox"
								defaultChecked
								className="size-5 accent-emerald-700"
							/>
						</label>
						<label className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700">
							Today&apos;s Special
							<input
								name="isTodaySpecial"
								type="checkbox"
								className="size-5 accent-emerald-700"
							/>
						</label>
					</div>
					<label className="grid gap-2">
						<span className="text-xs font-black text-slate-700">
							Photo upload
						</span>
						<input
							type="file"
							accept="image/webp,image/jpeg,image/png"
							className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs"
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
						<p className="text-xs font-black text-emerald-700">Uploading...</p>
					) : null}
					{uploadError ? (
						<p className="text-xs font-black text-red-600">{uploadError}</p>
					) : null}
					{previewUrl ? (
						<div className="relative h-36 overflow-hidden rounded-xl bg-emerald-50">
							<Image
								src={previewUrl}
								alt="Item preview"
								fill
								className="object-cover"
								sizes="360px"
								unoptimized
							/>
						</div>
					) : null}
					<SubmitButton
						loadingText="Creating..."
						successText="Created"
						onSuccess={onClose}
						className="min-h-11 rounded-xl bg-emerald-700 px-4 text-xs font-black text-white"
					>
						Create item
					</SubmitButton>
				</form>
			</div>
		</div>
	);
}
