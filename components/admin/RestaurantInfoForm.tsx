"use client";

import { MapPin, Pencil, Phone, Store } from "lucide-react";
import { updateRestaurantInfoAction } from "@/actions/restaurant.actions";
import { SettingsCard } from "@/components/admin/SettingsCard";
import { SubmitButton } from "@/components/ui/action-button";

type RestaurantInfoProps = {
	slug: string;
	name: string;
	description?: string | null;
	phone?: string | null;
	address?: string | null;
	currency: string;
	timezone: string;
};

export function RestaurantInfoForm({
	slug,
	name,
	description,
	phone,
	address,
	currency,
	timezone,
}: RestaurantInfoProps) {
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
				<input type="hidden" name="slug" value={slug} />

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
							defaultValue={name}
							required
							className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base md:text-[13px] font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
						/>
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
							defaultValue={description ?? ""}
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
								defaultValue={phone ?? ""}
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
								defaultValue={address ?? ""}
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
							defaultValue={currency}
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
							defaultValue={timezone}
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
