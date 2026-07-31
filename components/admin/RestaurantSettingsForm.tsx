"use client";

import { Settings } from "lucide-react";
import { updateRestaurantSettingsAction } from "@/actions/restaurant.actions";
import { SettingsCard } from "@/components/admin/SettingsCard";
import { SubmitButton } from "@/components/ui/action-button";
import { PaymentPolicy } from "@/lib/payment-policy";

type RestaurantSettingsProps = {
	slug: string;
	dineInPaymentPolicy: PaymentPolicy;
	staffDashboardPassword?: string | null;
	staffDashboardAutoLockHours?: number | null;
};

export function RestaurantSettingsForm({
	slug,
	dineInPaymentPolicy,
	staffDashboardPassword,
	staffDashboardAutoLockHours,
}: RestaurantSettingsProps) {
	return (
		<SettingsCard
			title="Restaurant Settings"
			description="Configure your dining policies and preferences."
			icon={Settings}
		>
			<form action={updateRestaurantSettingsAction} className="grid gap-6">
				<input type="hidden" name="slug" value={slug} />

				<fieldset className="grid gap-3">
					<legend className="mb-2 text-xs md:text-[13px] font-black text-slate-950">
						Dine-In Payment Policy
					</legend>
					<p className="mb-3 text-xs md:text-[13px] text-slate-500">
						Choose when customers are required to pay for their dine-in orders.
					</p>

					<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50 has-checked:border-emerald-600 has-checked:bg-emerald-50">
						<input
							type="radio"
							name="dineInPaymentPolicy"
							value={PaymentPolicy.PAY_BEFORE_SERVICE}
							defaultChecked={
								dineInPaymentPolicy === PaymentPolicy.PAY_BEFORE_SERVICE
							}
							className="mt-1"
						/>
						<div>
							<p className="text-xs md:text-[13px] font-bold text-slate-950">
								Pay Before Service
							</p>
							<p className="mt-0.5 text-xs text-slate-500">
								Payment must be completed before the order is processed.
							</p>
						</div>
					</label>

					<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50 has-checked:border-emerald-600 has-checked:bg-emerald-50">
						<input
							type="radio"
							name="dineInPaymentPolicy"
							value={PaymentPolicy.PAY_AFTER_SERVICE}
							defaultChecked={
								dineInPaymentPolicy === PaymentPolicy.PAY_AFTER_SERVICE
							}
							className="mt-1"
						/>
						<div>
							<p className="text-xs md:text-[13px] font-bold text-slate-950">
								Pay After Service
							</p>
							<p className="mt-0.5 text-xs text-slate-500">
								Customers pay after eating. Kitchen starts immediately.
							</p>
						</div>
					</label>

					<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50 has-checked:border-emerald-600 has-checked:bg-emerald-50">
						<input
							type="radio"
							name="dineInPaymentPolicy"
							value={PaymentPolicy.FLEXIBLE}
							defaultChecked={dineInPaymentPolicy === PaymentPolicy.FLEXIBLE}
							className="mt-1"
						/>
						<div>
							<p className="text-xs md:text-[13px] font-bold text-slate-950">
								Flexible (Pay Now or Later)
							</p>
							<p className="mt-0.5 text-xs text-slate-500">
								Customers can choose to pay immediately or pay after eating.
							</p>
						</div>
					</label>
				</fieldset>

				<fieldset className="grid gap-3 border-t border-slate-100 pt-6">
					<legend className="mb-2 text-xs md:text-[13px] font-black text-slate-950">
						Staff Dashboard Access
					</legend>
					<p className="mb-3 text-xs md:text-[13px] text-slate-500">
						Set a single password that staff members will use to access the
						shared staff dashboard on their devices.
					</p>

					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<label
								htmlFor="staffDashboardPassword"
								className="mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500"
							>
								Master Password
							</label>
							<input
								type="text"
								id="staffDashboardPassword"
								name="staffDashboardPassword"
								defaultValue={staffDashboardPassword ?? ""}
								placeholder="e.g. AwaStaff2026"
								className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base md:text-[13px] font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							/>
						</div>

						<div>
							<label
								htmlFor="staffDashboardAutoLockHours"
								className="mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500"
							>
								Auto-Lock Timer (Hours)
							</label>
							<input
								type="number"
								id="staffDashboardAutoLockHours"
								name="staffDashboardAutoLockHours"
								min="1"
								max="720"
								defaultValue={staffDashboardAutoLockHours ?? 24}
								className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base md:text-[13px] font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							/>
						</div>
					</div>
				</fieldset>

				<SubmitButton
					loadingText="Saving..."
					successText="Settings Saved"
					className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg bg-emerald-700 px-4 text-xs md:text-[13px] font-bold text-white hover:bg-emerald-800 sm:w-auto sm:justify-self-end"
				>
					Save Settings
				</SubmitButton>
			</form>
		</SettingsCard>
	);
}
