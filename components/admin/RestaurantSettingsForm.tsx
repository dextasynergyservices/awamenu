"use client";

import { Check, Copy, ExternalLink, Settings } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { updateRestaurantSettingsAction } from "@/actions/restaurant.actions";
import { SettingsCard } from "@/components/admin/SettingsCard";
import { StaffPasswordReveal } from "@/components/admin/StaffPasswordReveal";
import { SubmitButton } from "@/components/ui/action-button";
import { PaymentPolicy } from "@/lib/payment-policy";

type RestaurantSettingsProps = {
	slug: string;
	dineInPaymentPolicy: PaymentPolicy;
	hasStaffDashboardPassword: boolean;
	staffDashboardAutoLockHours?: number | null;
	/** Absolute URL staff open to sign in. Built server-side so it's correct
	 * during SSR (window.location isn't available then). */
	staffLoginUrl: string;
	customerUpdateChannel: "WHATSAPP" | "SMS" | "NONE";
	/** Drives whether WhatsApp can be selected — it's a paid-plan feature. */
	whatsappIntegration: boolean;
};

export function RestaurantSettingsForm({
	slug,
	dineInPaymentPolicy,
	hasStaffDashboardPassword,
	staffDashboardAutoLockHours,
	staffLoginUrl,
	customerUpdateChannel,
	whatsappIntegration,
}: RestaurantSettingsProps) {
	const [copied, setCopied] = useState(false);

	function handleCopyStaffUrl() {
		navigator.clipboard.writeText(staffLoginUrl);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}

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
						Customer Order Updates
					</legend>
					<p className="mb-3 text-xs md:text-[13px] text-slate-500">
						Message customers automatically when their order is confirmed,
						ready, delivered or completed. Sent from AwaMenu with your
						restaurant&apos;s name in the message — your own WhatsApp number is
						unaffected and staff keep replying from it as usual.
					</p>

					<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50 has-checked:border-emerald-600 has-checked:bg-emerald-50">
						<input
							type="radio"
							name="customerUpdateChannel"
							value="WHATSAPP"
							defaultChecked={customerUpdateChannel === "WHATSAPP"}
							disabled={!whatsappIntegration}
							className="mt-1"
						/>
						<div className="min-w-0">
							<p className="flex flex-wrap items-center gap-2 text-xs md:text-[13px] font-bold text-slate-950">
								WhatsApp
								{whatsappIntegration ? null : (
									<span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-black text-amber-700">
										Paid plans
									</span>
								)}
							</p>
							<p className="mt-0.5 text-xs text-slate-500">
								{whatsappIntegration
									? "Highest open rates. Uses the phone number the customer gave at checkout."
									: "Upgrade your plan to message customers on WhatsApp."}
							</p>
						</div>
					</label>

					<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50 has-checked:border-emerald-600 has-checked:bg-emerald-50">
						<input
							type="radio"
							name="customerUpdateChannel"
							value="SMS"
							defaultChecked={customerUpdateChannel === "SMS"}
							className="mt-1"
						/>
						<div>
							<p className="text-xs md:text-[13px] font-bold text-slate-950">
								Text message (SMS)
							</p>
							<p className="mt-0.5 text-xs text-slate-500">
								Works on every phone, including customers who don&apos;t use
								WhatsApp.
							</p>
						</div>
					</label>

					<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50 has-checked:border-emerald-600 has-checked:bg-emerald-50">
						<input
							type="radio"
							name="customerUpdateChannel"
							value="NONE"
							defaultChecked={customerUpdateChannel === "NONE"}
							className="mt-1"
						/>
						<div>
							<p className="text-xs md:text-[13px] font-bold text-slate-950">
								Don&apos;t send updates
							</p>
							<p className="mt-0.5 text-xs text-slate-500">
								Customers can still track their order from the link on their
								receipt.
							</p>
						</div>
					</label>
				</fieldset>

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

					<div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 sm:p-4">
						<p className="text-xs md:text-[11px] font-bold uppercase tracking-wide text-emerald-800">
							Staff sign-in link
						</p>
						<p className="mt-1 text-xs md:text-[13px] font-medium text-slate-600">
							Share this link with your staff. They open it on their own device
							and sign in with the master password below.
						</p>

						<div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
							<code className="min-w-0 flex-1 truncate rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-xs md:text-[13px] font-bold text-slate-800">
								{staffLoginUrl}
							</code>
							<div className="flex shrink-0 gap-2">
								<button
									type="button"
									onClick={handleCopyStaffUrl}
									className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3 text-xs font-black text-white transition-colors hover:bg-emerald-800 sm:flex-none"
								>
									{copied ? (
										<>
											<Check className="size-3.5" aria-hidden="true" />
											Copied
										</>
									) : (
										<>
											<Copy className="size-3.5" aria-hidden="true" />
											Copy
										</>
									)}
								</button>
								<Link
									href={`/${slug}/staff`}
									target="_blank"
									rel="noopener noreferrer"
									className="inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 text-xs font-black text-emerald-800 transition-colors hover:bg-emerald-50 sm:flex-none"
								>
									<ExternalLink className="size-3.5" aria-hidden="true" />
									Open
								</Link>
							</div>
						</div>

						{!hasStaffDashboardPassword ? (
							<p className="mt-2.5 text-xs font-bold text-amber-700">
								Set a master password below before sharing this link — staff
								can&apos;t sign in until one exists.
							</p>
						) : null}
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div>
							<label
								htmlFor="staffDashboardPassword"
								className="mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500"
							>
								Master Password
							</label>
							<input
								type="password"
								id="staffDashboardPassword"
								name="staffDashboardPassword"
								autoComplete="new-password"
								placeholder={
									hasStaffDashboardPassword
										? "Leave blank to keep current password"
										: "e.g. AwaStaff2026"
								}
								className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base md:text-[13px] font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
							/>
							<p className="mt-1 text-xs text-slate-400">
								{hasStaffDashboardPassword
									? "Leave blank to keep the current password. Enter a new one only if you want to change it."
									: "Not set yet — staff can't log in until you set one."}
							</p>

							<StaffPasswordReveal
								slug={slug}
								hasPassword={hasStaffDashboardPassword}
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
