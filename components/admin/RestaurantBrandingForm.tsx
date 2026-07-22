"use client";

import { BadgeCheck, ImageIcon, Pencil, Upload } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { updateRestaurantBrandingAction } from "@/actions/restaurant.actions";
import { uploadRestaurantPhoto } from "@/components/admin/restaurant-photo-upload";
import { SettingsCard } from "@/components/admin/SettingsCard";
import { SubmitButton } from "@/components/ui/action-button";

type RestaurantBrandingProps = {
	restaurantId: string;
	slug: string;
	logoUrl?: string | null;
	primaryColor?: string | null;
	activeTemplate: string;
};

export function RestaurantBrandingForm({
	restaurantId,
	slug,
	logoUrl: initialLogo,
	primaryColor,
	activeTemplate,
}: RestaurantBrandingProps) {
	const [logoUrl, setLogoUrl] = useState(initialLogo ?? "");
	const [prevInitialLogo, setPrevInitialLogo] = useState(initialLogo);

	if (initialLogo !== prevInitialLogo) {
		setPrevInitialLogo(initialLogo);
		setLogoUrl(initialLogo ?? "");
	}

	const [color, setColor] = useState(primaryColor ?? "#10b981");
	const [prevPrimaryColor, setPrevPrimaryColor] = useState(primaryColor);
	if (primaryColor !== prevPrimaryColor) {
		setPrevPrimaryColor(primaryColor);
		setColor(primaryColor ?? "#10b981");
	}
	const [isUploadingLogo, setIsUploadingLogo] = useState(false);
	const logoInputId = useId();

	async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;

		try {
			setIsUploadingLogo(true);
			const url = await uploadRestaurantPhoto(restaurantId, "logo", file);
			setLogoUrl(url);
		} catch (error) {
			alert(error instanceof Error ? error.message : "Upload failed");
		} finally {
			setIsUploadingLogo(false);
		}
	}

	return (
		<SettingsCard
			title="Branding"
			description="Customize how your brand appears to your customers."
			icon={BadgeCheck}
			headerAction={
				<button
					type="button"
					className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs md:text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100"
				>
					<Pencil className="size-3.5" />
					Edit
				</button>
			}
		>
			<form
				action={updateRestaurantBrandingAction}
				className="grid gap-8 sm:grid-cols-2"
			>
				<input type="hidden" name="slug" value={slug} />
				<input type="hidden" name="logoUrl" value={logoUrl} />
				<input type="hidden" name="activeTemplate" value={activeTemplate} />

				<div className="sm:col-span-2">
					{/* Logo Upload */}
					<div>
						<label
							htmlFor={logoInputId}
							className="mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500"
						>
							Restaurant Logo
						</label>
						<div className="relative flex aspect-square w-24 items-center justify-center overflow-hidden rounded-full border-2 border-slate-200 bg-slate-50 transition-colors hover:bg-slate-100">
							{logoUrl ? (
								<Image
									src={logoUrl}
									alt="Logo"
									fill
									className="object-contain p-1.5"
									sizes="96px"
									unoptimized
								/>
							) : (
								<ImageIcon className="size-6 text-slate-300" />
							)}
							<input
								id={logoInputId}
								type="file"
								accept="image/png, image/jpeg, image/webp"
								className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
								onChange={handleUpload}
								disabled={isUploadingLogo}
							/>
							{isUploadingLogo && (
								<div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
									<Upload className="size-4 animate-bounce text-emerald-600" />
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Theme Colors */}
				<div>
					<label
						htmlFor="primaryColor"
						className="mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500"
					>
						Primary Color
					</label>
					<div className="flex gap-2">
						<input
							type="color"
							id="colorPicker"
							value={color}
							onChange={(e) => setColor(e.target.value)}
							className="h-10 w-10 cursor-pointer rounded-lg border border-slate-200 p-0.5"
						/>
						<input
							type="text"
							id="primaryColor"
							name="primaryColor"
							value={color}
							onChange={(e) => setColor(e.target.value)}
							placeholder="#10b981"
							pattern="^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$"
							className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base md:text-[13px] font-medium uppercase text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						/>
					</div>
				</div>

				<p className="text-xs md:text-[13px] font-medium text-slate-500 sm:col-span-2">
					Looking to change how menu items are laid out? Head to{" "}
					<Link
						href={`/dashboard/${slug}/menu`}
						className="font-bold text-emerald-700 hover:underline"
					>
						Menu Builder
					</Link>
					.
				</p>

				<div className="sm:col-span-2">
					<SubmitButton
						loadingText="Saving..."
						successText="Branding Saved"
						className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg bg-emerald-700 px-4 text-xs md:text-[13px] font-bold text-white hover:bg-emerald-800 sm:w-auto sm:justify-self-end"
					>
						Save Branding
					</SubmitButton>
				</div>
			</form>
		</SettingsCard>
	);
}
