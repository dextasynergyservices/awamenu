"use client";

import { Check, ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import {
	createBannerAction,
	removeBannerAction,
	updateBannerAction,
} from "@/actions/menu.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { type BannerItem, createBannerItem } from "@/lib/banners";
import { uploadImage, webpUrl } from "@/lib/image-upload";

type BannerManagerProps = {
	restaurantId: string;
	slug: string;
	bannerItems: BannerItem[];
};

async function uploadBannerImage(restaurantId: string, file: File) {
	return webpUrl(await uploadImage({ restaurantId, kind: "cover" }, file));
}

export function BannerManager({
	restaurantId,
	slug,
	bannerItems,
}: BannerManagerProps) {
	const [currentBannerItems, setCurrentBannerItems] = useState(bannerItems);
	const [isUploading, setIsUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);
	const scrollerRef = useRef<HTMLDivElement>(null);

	function scrollBanners(direction: "left" | "right") {
		scrollerRef.current?.scrollBy({
			left: direction === "left" ? -360 : 360,
			behavior: "smooth",
		});
	}

	return (
		<section className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-slate-100 bg-white p-4">
			<div>
				<h2 className="text-sm md:text-xl font-black text-slate-950">
					Banner Images
				</h2>
				<p className="mt-1 text-xs md:text-sm font-medium text-slate-500">
					Add banner images and the text shown on each public menu banner.
				</p>
				{uploadError ? (
					<p role="alert" className="mt-2 text-xs font-bold text-red-600">
						{uploadError}
					</p>
				) : null}
			</div>

			<div className="mt-4 grid min-w-0 max-w-full gap-4 overflow-hidden">
				<div className="relative min-w-0 max-w-full overflow-hidden">
					{currentBannerItems.length > 3 ? (
						<div className="-top-12 right-0 absolute hidden gap-2 md:flex">
							<button
								type="button"
								onClick={() => scrollBanners("left")}
								className="grid size-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
								aria-label="Scroll banners left"
							>
								<ChevronLeft className="size-4" aria-hidden="true" />
							</button>
							<button
								type="button"
								onClick={() => scrollBanners("right")}
								className="grid size-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm"
								aria-label="Scroll banners right"
							>
								<ChevronRight className="size-4" aria-hidden="true" />
							</button>
						</div>
					) : null}
					<div
						ref={scrollerRef}
						className="flex w-full max-w-full snap-x gap-3 overflow-x-auto overscroll-x-contain pb-2"
					>
						{currentBannerItems.map((banner, index) => (
							<div
								key={banner.id ?? banner.url}
								className="group w-68 shrink-0 snap-start overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm lg:w-[18rem] xl:w-76"
							>
								<div className="relative h-32 bg-emerald-50">
									<Image
										src={banner.url}
										alt={`Banner ${index + 1}`}
										fill
										className="object-cover"
										sizes="(min-width: 768px) 384px, 100vw"
										unoptimized
									/>
									{banner.title || banner.subtitle ? (
										<div className="absolute inset-x-0 bottom-0 bg-emerald-950/70 p-3 text-white">
											{banner.title ? (
												<p className="line-clamp-2 text-sm font-semibold leading-tight md:font-black">
													{banner.title}
												</p>
											) : null}
											{banner.subtitle ? (
												<p className="mt-1 line-clamp-2 text-xs font-medium text-white/85">
													{banner.subtitle}
												</p>
											) : null}
										</div>
									) : null}
									{banner.id ? (
										<form
											action={async (formData) => {
												setCurrentBannerItems((items) =>
													items.filter(
														(_item, entryIndex) => entryIndex !== index,
													),
												);
												await removeBannerAction(formData);
											}}
										>
											<input
												type="hidden"
												name="restaurantId"
												value={restaurantId}
											/>
											<input type="hidden" name="slug" value={slug} />
											<input type="hidden" name="bannerId" value={banner.id} />
											<SubmitButton
												loadingText="Deleting..."
												successText="Deleted"
												className="absolute top-2 right-2 inline-flex min-h-8 min-w-8 items-center justify-center gap-1 rounded-full bg-white/95 px-2 text-xs font-black text-red-600"
												aria-label={`Remove banner ${index + 1}`}
											>
												<X className="size-4" aria-hidden="true" />
												<span className="sr-only">Delete</span>
											</SubmitButton>
										</form>
									) : (
										<button
											type="button"
											onClick={() => {
												setCurrentBannerItems((items) =>
													items.filter(
														(_item, entryIndex) => entryIndex !== index,
													),
												);
											}}
											className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-white/95 text-red-600"
											aria-label={`Remove unsaved banner ${index + 1}`}
										>
											<X className="size-4" aria-hidden="true" />
										</button>
									)}
								</div>
								<form
									action={banner.id ? updateBannerAction : createBannerAction}
									className="grid gap-2 p-2"
								>
									<input
										type="hidden"
										name="restaurantId"
										value={restaurantId}
									/>
									<input type="hidden" name="slug" value={slug} />
									{banner.id ? (
										<input type="hidden" name="bannerId" value={banner.id} />
									) : null}
									<input type="hidden" name="imageUrl" value={banner.url} />
									<input type="hidden" name="isActive" value="on" />
									<label className="grid gap-1 text-xs font-medium text-slate-500 md:font-black">
										Title
										<textarea
											name="title"
											value={banner.title ?? ""}
											rows={2}
											onChange={(event) => {
												// Read now: the updater may run later, when React
												// has already cleared currentTarget.
												const title = event.currentTarget.value;
												setCurrentBannerItems((items) =>
													updateBannerText(items, index, { title }),
												);
											}}
											placeholder="Fresh meals, made with love"
											className="min-h-16 resize-none rounded-lg border border-slate-200 px-2 py-2 text-base font-bold text-slate-900 outline-none focus:border-emerald-700 md:text-sm"
										/>
									</label>
									<label className="grid gap-1 text-xs font-medium text-slate-500 md:font-black">
										Subtitle
										<textarea
											name="subtitle"
											value={banner.subtitle ?? ""}
											rows={2}
											onChange={(event) => {
												const subtitle = event.currentTarget.value;
												setCurrentBannerItems((items) =>
													updateBannerText(items, index, { subtitle }),
												);
											}}
											placeholder="Delicious. Local. Always fresh."
											className="min-h-16 resize-none rounded-lg border border-slate-200 px-2 py-2 text-base font-bold text-slate-900 outline-none focus:border-emerald-700 md:text-sm"
										/>
									</label>
									<div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
										<label className="grid min-w-0 gap-1 text-xs font-medium text-slate-500 md:font-black">
											Position
											<input
												name="sortOrder"
												type="number"
												min="0"
												defaultValue={index + 1}
												className="min-h-9 w-full min-w-0 rounded-lg border border-slate-200 px-2 text-base font-bold text-slate-900 outline-none focus:border-emerald-700 md:text-sm"
											/>
										</label>
										<SubmitButton
											loadingText={banner.id ? "Saving..." : "Creating..."}
											successText={banner.id ? "Saved" : "Created"}
											className="inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white"
										>
											<Check className="size-4" aria-hidden="true" />
											Save
										</SubmitButton>
									</div>
								</form>
							</div>
						))}
						<label className="grid h-36 w-68 shrink-0 cursor-pointer place-items-center rounded-xl border border-emerald-200 border-dashed bg-emerald-50/30 text-center text-emerald-700 lg:w-72 xl:w-76">
							<span>
								<span className="mx-auto grid size-10 place-items-center rounded-full border border-emerald-300 bg-white">
									<Plus className="size-5" aria-hidden="true" />
								</span>
								<span className="mt-3 block text-sm font-black">
									{isUploading ? "Uploading..." : "Add banner"}
								</span>
							</span>
							<input
								type="file"
								multiple
								accept="image/webp,image/jpeg,image/png"
								className="sr-only"
								onChange={async (event) => {
									const input = event.currentTarget;
									const files = Array.from(input.files ?? []);
									if (files.length === 0) return;

									setIsUploading(true);
									setUploadError(null);
									try {
										// One bad file shouldn't throw away the others.
										const results = await Promise.allSettled(
											files.map((file) =>
												uploadBannerImage(restaurantId, file),
											),
										);
										const uploadedUrls = results.flatMap((result) =>
											result.status === "fulfilled" ? [result.value] : [],
										);
										if (uploadedUrls.length > 0) {
											setCurrentBannerItems((items) =>
												addUploadedBanners(items, uploadedUrls),
											);
										}
										const failed = results.find(
											(result) => result.status === "rejected",
										);
										if (failed?.status === "rejected") {
											const reason =
												failed.reason instanceof Error
													? failed.reason.message
													: "The upload failed. Try again.";
											const failedCount = results.length - uploadedUrls.length;
											setUploadError(
												results.length > 1
													? `${failedCount} of ${results.length} images didn't upload. ${reason}`
													: reason,
											);
										}
									} finally {
										setIsUploading(false);
										input.value = "";
									}
								}}
							/>
						</label>
					</div>
				</div>
			</div>
		</section>
	);
}

function updateBannerText(
	items: BannerItem[],
	index: number,
	patch: Pick<Partial<BannerItem>, "title" | "subtitle">,
) {
	return items.map((item, entryIndex) =>
		entryIndex === index ? { ...item, ...patch } : item,
	);
}

function addUploadedBanners(items: BannerItem[], urls: string[]) {
	const existingUrls = new Set(items.map((item) => item.url));
	const nextItems = [...items];

	for (const url of urls) {
		if (existingUrls.has(url)) continue;
		nextItems.push(createBannerItem(url));
		existingUrls.add(url);
	}

	return nextItems;
}
