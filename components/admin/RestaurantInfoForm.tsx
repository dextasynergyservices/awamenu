"use client";

import { MapPin, Pencil, Phone, Store } from "lucide-react";
import { useState } from "react";
import { updateRestaurantInfoAction } from "@/actions/restaurant.actions";
import { SettingsCard } from "@/components/admin/SettingsCard";
import { SubmitButton } from "@/components/ui/action-button";
import { env } from "@/env";

type RestaurantInfoFormValues = {
	name: string;
	slug: string;
	description: string;
	phone: string;
	address: string;
	currency: string;
	timezone: string;
};

type RestaurantInfoProps = {
	restaurantId: string;
	slug: string;
	name: string;
	description?: string | null;
	phone?: string | null;
	address?: string | null;
	currency: string;
	timezone: string;
};

export function RestaurantInfoForm({
	restaurantId,
	slug,
	name,
	description,
	phone,
	address,
	currency,
	timezone,
}: RestaurantInfoProps) {
	const previewHost = (
		env.NEXT_PUBLIC_APP_URL ?? "https://awamenu.com"
	).replace(/^https?:\/\//, "");

	const [formValues, setFormValues] = useState<RestaurantInfoFormValues>({
		name,
		slug,
		description: description ?? "",
		phone: phone ?? "",
		address: address ?? "",
		currency,
		timezone,
	});

	const [prevProps, setPrevProps] = useState<RestaurantInfoFormValues>({
		name,
		slug,
		description: description ?? "",
		phone: phone ?? "",
		address: address ?? "",
		currency,
		timezone,
	});

	if (
		name !== prevProps.name ||
		slug !== prevProps.slug ||
		description !== prevProps.description ||
		phone !== prevProps.phone ||
		address !== prevProps.address ||
		currency !== prevProps.currency ||
		timezone !== prevProps.timezone
	) {
		setPrevProps({
			name,
			slug,
			description: description ?? "",
			phone: phone ?? "",
			address: address ?? "",
			currency,
			timezone,
		});
		setFormValues({
			name,
			slug,
			description: description ?? "",
			phone: phone ?? "",
			address: address ?? "",
			currency,
			timezone,
		});
	}

	return (
		<SettingsCard
			title="Restaurant Profile"
			description="Update your public information and location details."
			icon={Store}
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
			<form action={updateRestaurantInfoAction} className="grid gap-6">
				<input type="hidden" name="restaurantId" value={restaurantId} />

				<div className="grid gap-6 sm:grid-cols-2">
					<div className="sm:col-span-2">
						<label
							htmlFor="name"
							className="mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500"
						>
							Restaurant Name
						</label>
						<input
							type="text"
							id="name"
							name="name"
							value={formValues.name}
							onChange={(e) =>
								setFormValues((prev) => ({ ...prev, name: e.target.value }))
							}
							required
							className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base md:text-[13px] font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						/>
					</div>

					<div className="sm:col-span-2">
						<label
							htmlFor="slug"
							className="mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500"
						>
							Web Address
						</label>
						<input
							type="text"
							id="slug"
							name="slug"
							value={formValues.slug}
							onChange={(e) =>
								setFormValues((prev) => ({ ...prev, slug: e.target.value }))
							}
							required
							pattern="[a-z0-9]+(-[a-z0-9]+)*"
							className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base md:text-[13px] font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						/>
						<p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
							Customers use this to view your menu, e.g.{" "}
							<span className="font-bold text-emerald-700">
								{previewHost}/{formValues.slug}
							</span>
							. Changing it breaks any QR codes or links you&apos;ve already
							shared.
						</p>
					</div>

					<div className="sm:col-span-2">
						<label
							htmlFor="description"
							className="mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500"
						>
							Description
						</label>
						<textarea
							id="description"
							name="description"
							value={formValues.description}
							onChange={(e) =>
								setFormValues((prev) => ({
									...prev,
									description: e.target.value,
								}))
							}
							rows={3}
							className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base md:text-[13px] font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						/>
					</div>

					<div>
						<label
							htmlFor="phone"
							className="mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500"
						>
							Phone Number
						</label>
						<div className="relative">
							<input
								type="tel"
								id="phone"
								name="phone"
								value={formValues.phone}
								onChange={(e) =>
									setFormValues((prev) => ({
										...prev,
										phone: e.target.value,
									}))
								}
								className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-10 text-base md:text-[13px] font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							/>
							<div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
								<Phone className="size-3.5 text-slate-400" />
							</div>
						</div>
					</div>

					<div className="sm:col-span-2">
						<label
							htmlFor="address"
							className="mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500"
						>
							Address
						</label>
						<div className="relative">
							<input
								type="text"
								id="address"
								name="address"
								value={formValues.address}
								onChange={(e) =>
									setFormValues((prev) => ({
										...prev,
										address: e.target.value,
									}))
								}
								className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-10 text-base md:text-[13px] font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							/>
							<div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
								<MapPin className="size-3.5 text-slate-400" />
							</div>
						</div>
					</div>

					<div>
						<label
							htmlFor="currency"
							className="mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500"
						>
							Currency
						</label>
						<select
							id="currency"
							name="currency"
							value={formValues.currency}
							onChange={(e) =>
								setFormValues((prev) => ({
									...prev,
									currency: e.target.value,
								}))
							}
							className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base md:text-[13px] font-medium text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						>
							<option value="NGN">NGN (₦)</option>
							<option value="USD">USD ($)</option>
							<option value="GBP">GBP (£)</option>
						</select>
					</div>

					<div>
						<label
							htmlFor="timezone"
							className="mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500"
						>
							Timezone
						</label>
						<select
							id="timezone"
							name="timezone"
							value={formValues.timezone}
							onChange={(e) =>
								setFormValues((prev) => ({
									...prev,
									timezone: e.target.value,
								}))
							}
							className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base md:text-[13px] font-medium text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						>
							<option value="Africa/Lagos">Africa/Lagos</option>
							<option value="UTC">UTC</option>
						</select>
					</div>
				</div>

				<SubmitButton
					loadingText="Saving..."
					successText="Profile Saved"
					className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg bg-emerald-700 px-4 text-xs md:text-[13px] font-bold text-white hover:bg-emerald-800 sm:w-auto sm:justify-self-end"
				>
					Save Profile
				</SubmitButton>
			</form>
		</SettingsCard>
	);
}
