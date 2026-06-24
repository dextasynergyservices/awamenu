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

type BannerManagerProps = {
	restaurantId: string;
	slug: string;
	bannerItems: BannerItem[];
};

async function uploadBannerImage(restaurantId: string, file: File) {
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

export function BannerManager({
	restaurantId,
	slug,
	bannerItems,
}: BannerManagerProps) {
	const [currentBannerItems, setCurrentBannerItems] = useState(bannerItems);
	const [isUploading, setIsUploading] = useState(false);
	const scrollerRef = useRef<HTMLDivElement>(null);

	function scrollBanners(direction: "left" | "right") {
		scrollerRef.current?.scrollBy({
			left: direction === "left" ? -360 : 360,
			behavior: "smooth",
		});
	}

	return (
		<section className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-slate-100 bg-white p-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h2 className="text-xl font-black text-slate-950">Banner Images</h2>
					<p className="mt-1 text-sm font-medium text-slate-500 md:text-sm">
						Add banner images and the text shown on each public menu banner.
					</p>
				</div>
				<span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700 md:text-xs md:font-black">
					{currentBannerItems.length} saved
				</span>
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
								className="group w-[78vw] shrink-0 snap-start overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm md:w-[17rem] lg:w-[18rem] xl:w-[19rem]"
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
										<div className="absolute inset-0 flex items-center bg-gradient-to-r from-emerald-950/80 via-emerald-950/20 to-transparent p-4 text-white">
											<div>
												{banner.title ? (
													<p className="line-clamp-2 text-lg font-semibold leading-tight md:font-black">
														{banner.title}
													</p>
												) : null}
												{banner.subtitle ? (
													<p className="mt-1 line-clamp-2 text-sm font-medium text-white/85 md:text-xs">
														{banner.subtitle}
													</p>
												) : null}
											</div>
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
									<label className="grid gap-1 text-sm font-medium text-slate-500 md:text-xs md:font-black">
										Title
										<textarea
											name="title"
											value={banner.title ?? ""}
											rows={2}
											onChange={(event) =>
												setCurrentBannerItems((items) =>
													updateBannerText(items, index, {
														title: event.currentTarget.value,
													}),
												)
											}
											placeholder="Fresh meals, made with love"
											className="min-h-16 resize-none rounded-lg border border-slate-200 px-2 py-2 text-base font-bold text-slate-900 outline-none focus:border-emerald-700 md:text-sm"
										/>
									</label>
									<label className="grid gap-1 text-sm font-medium text-slate-500 md:text-xs md:font-black">
										Subtitle
										<textarea
											name="subtitle"
											value={banner.subtitle ?? ""}
											rows={2}
											onChange={(event) =>
												setCurrentBannerItems((items) =>
													updateBannerText(items, index, {
														subtitle: event.currentTarget.value,
													}),
												)
											}
											placeholder="Delicious. Local. Always fresh."
											className="min-h-16 resize-none rounded-lg border border-slate-200 px-2 py-2 text-base font-bold text-slate-900 outline-none focus:border-emerald-700 md:text-sm"
										/>
									</label>
									<div className="grid grid-cols-[1fr_auto] gap-2">
										<input
											name="sortOrder"
											type="number"
											min="0"
											defaultValue={index + 1}
											className="min-h-9 rounded-lg border border-slate-200 px-2 text-base font-bold text-slate-900 outline-none focus:border-emerald-700 md:text-sm"
										/>
										<SubmitButton
											loadingText={banner.id ? "Saving..." : "Creating..."}
											successText={banner.id ? "Saved" : "Created"}
											className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-emerald-700 px-3 text-base font-medium text-white md:text-sm md:font-black"
										>
											<Check className="size-4" aria-hidden="true" />
											Save
										</SubmitButton>
									</div>
								</form>
							</div>
						))}
						<label className="grid h-36 w-[78vw] shrink-0 snap-start cursor-pointer place-items-center rounded-xl border border-emerald-200 border-dashed bg-emerald-50/30 text-center text-emerald-700 md:w-[17rem] lg:w-[18rem] xl:w-[19rem]">
							<span>
								<span className="mx-auto grid size-10 place-items-center rounded-full border border-emerald-300 bg-white">
									<Plus className="size-5" aria-hidden="true" />
								</span>
								<span className="mt-3 block text-base font-medium md:text-sm md:font-black">
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
									try {
										const uploadedUrls = await Promise.all(
											files.map((file) =>
												uploadBannerImage(restaurantId, file),
											),
										);
										setCurrentBannerItems((items) =>
											addUploadedBanners(items, uploadedUrls),
										);
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
