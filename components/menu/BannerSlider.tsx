"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
	type BannerItem,
	getBannerObjectFit,
	getBannerObjectPosition,
} from "@/lib/banners";
import { cn } from "@/lib/utils";

type BannerSliderProps = {
	name: string;
	bannerItems: BannerItem[];
};

export function BannerSlider({ name, bannerItems }: BannerSliderProps) {
	const [activeIndex, setActiveIndex] = useState(0);
	const safeActiveIndex =
		activeIndex <= bannerItems.length - 1 ? activeIndex : 0;

	useEffect(() => {
		if (bannerItems.length <= 1) return;

		const timer = window.setInterval(() => {
			setActiveIndex((index) => (index + 1) % bannerItems.length);
		}, 3500);

		return () => window.clearInterval(timer);
	}, [bannerItems.length]);

	if (bannerItems.length === 0) return null;

	return (
		<section className="bg-white px-4 py-3">
			<div className="mx-auto max-w-5xl">
				<div className="relative h-36 overflow-hidden rounded-3xl bg-emerald-950 shadow-[0_18px_45px_rgba(6,78,59,0.14)] md:h-64">
					<div
						className="flex h-full transition-transform duration-500 ease-out"
						style={{ transform: `translateX(-${safeActiveIndex * 100}%)` }}
					>
						{bannerItems.map((banner, index) => (
							<div
								key={banner.id ?? banner.url}
								className="relative h-full min-w-full"
							>
								<Image
									src={banner.url}
									alt={`${name} banner ${index + 1}`}
									fill
									className="bg-emerald-950"
									style={{
										objectFit: getBannerObjectFit(banner.size),
										objectPosition: getBannerObjectPosition(
											banner.mobilePosition,
										),
									}}
									sizes="(min-width: 768px) 1024px, 100vw"
									priority={index === 0}
									unoptimized
								/>
								{banner.title || banner.subtitle ? (
									<div className="absolute inset-0 flex items-center bg-gradient-to-r from-emerald-950/80 via-emerald-950/25 to-transparent px-5 text-white">
										<div className="max-w-[14rem]">
											{banner.title ? (
												<h2 className="text-2xl font-black leading-tight">
													{banner.title}
												</h2>
											) : null}
											{banner.subtitle ? (
												<p className="mt-2 text-sm font-medium text-white/90">
													{banner.subtitle}
												</p>
											) : null}
										</div>
									</div>
								) : null}
							</div>
						))}
					</div>

					{bannerItems.length > 1 ? (
						<div className="-translate-x-1/2 absolute bottom-3 left-1/2 flex gap-2">
							{bannerItems.map((banner, index) => (
								<button
									key={banner.id ?? banner.url}
									type="button"
									onClick={() => setActiveIndex(index)}
									className={cn(
										"size-2.5 rounded-full bg-white/55 transition-colors",
										safeActiveIndex === index && "bg-yellow-300",
									)}
									aria-label={`Show banner ${index + 1}`}
								/>
							))}
						</div>
					) : null}
				</div>
			</div>
		</section>
	);
}
