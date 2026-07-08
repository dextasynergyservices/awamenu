import { PaymentPolicy } from "@prisma/client";
import { Settings } from "lucide-react";
import { redirect } from "next/navigation";
import { updateRestaurantSettingsAction } from "@/actions/restaurant.actions";
import { AdminAccountSettings } from "@/components/admin/AdminAccountSettings";
import { BankAccountsManager } from "@/components/admin/BankAccountsManager";
import { SubmitButton } from "@/components/ui/action-button";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";

export default async function SettingsPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const user = await requireUser();
	const { slug } = await params;

	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		select: {
			id: true,
			name: true,
			slug: true,
			dineInPaymentPolicy: true,
			staffDashboardPassword: true,
			staffDashboardAutoLockHours: true,
			bankAccounts: {
				orderBy: { createdAt: "asc" },
			},
		},
	});

	if (!restaurant) {
		redirect("/dashboard");
	}

	return (
		<div className="grid max-w-2xl gap-5 md:gap-8">
			<div className="min-w-0 overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
				<div className="flex items-center gap-3 border-b border-slate-100 p-5 md:p-6">
					<div className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
						<Settings className="size-5" />
					</div>
					<div>
						<h2 className="text-xl font-black text-slate-950">
							Restaurant Settings
						</h2>
						<p className="text-sm font-medium text-slate-500">
							Configure your dining policies and preferences.
						</p>
					</div>
				</div>

				<div className="p-5 md:p-6">
					<form action={updateRestaurantSettingsAction} className="grid gap-6">
						<input type="hidden" name="slug" value={restaurant.slug} />

						<fieldset className="grid gap-3">
							<legend className="text-sm font-black text-slate-950">
								Dine-In Payment Policy
							</legend>
							<p className="text-sm text-slate-500 mb-2">
								Choose when customers are required to pay for their dine-in
								orders.
							</p>

							<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 transition-colors hover:bg-slate-50 has-checked:border-emerald-600 has-checked:bg-emerald-50">
								<input
									type="radio"
									name="dineInPaymentPolicy"
									value={PaymentPolicy.PAY_BEFORE_SERVICE}
									defaultChecked={
										restaurant.dineInPaymentPolicy ===
										PaymentPolicy.PAY_BEFORE_SERVICE
									}
									className="mt-1"
								/>
								<div>
									<p className="font-bold text-slate-950">Pay Before Service</p>
									<p className="mt-1 text-sm text-slate-500">
										Payment must be completed before the order is processed.
									</p>
								</div>
							</label>

							<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 transition-colors hover:bg-slate-50 has-checked:border-emerald-600 has-checked:bg-emerald-50">
								<input
									type="radio"
									name="dineInPaymentPolicy"
									value={PaymentPolicy.PAY_AFTER_SERVICE}
									defaultChecked={
										restaurant.dineInPaymentPolicy ===
										PaymentPolicy.PAY_AFTER_SERVICE
									}
									className="mt-1"
								/>
								<div>
									<p className="font-bold text-slate-950">Pay After Service</p>
									<p className="mt-1 text-sm text-slate-500">
										Customers pay after eating. Kitchen starts immediately.
									</p>
								</div>
							</label>

							<label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 transition-colors hover:bg-slate-50 has-checked:border-emerald-600 has-checked:bg-emerald-50">
								<input
									type="radio"
									name="dineInPaymentPolicy"
									value={PaymentPolicy.FLEXIBLE}
									defaultChecked={
										restaurant.dineInPaymentPolicy === PaymentPolicy.FLEXIBLE
									}
									className="mt-1"
								/>
								<div>
									<p className="font-bold text-slate-950">
										Flexible (Pay Now or Later)
									</p>
									<p className="mt-1 text-sm text-slate-500">
										Customers can choose to pay immediately or pay after eating.
									</p>
								</div>
							</label>
						</fieldset>

						<fieldset className="grid gap-3 pt-6 border-t border-slate-100">
							<legend className="text-sm font-black text-slate-950">
								Staff Dashboard Access
							</legend>
							<p className="text-sm text-slate-500 mb-2">
								Set a single password that staff members will use to access the
								shared staff dashboard on their devices.
							</p>

							<div className="grid gap-4 sm:grid-cols-2 max-w-lg mt-4">
								<div>
									<label
										htmlFor="staffDashboardPassword"
										className="block text-xs font-bold text-slate-700 mb-1.5"
									>
										Master Password
									</label>
									<input
										type="text"
										id="staffDashboardPassword"
										name="staffDashboardPassword"
										defaultValue={restaurant.staffDashboardPassword ?? ""}
										placeholder="e.g. AwaStaff2026"
										className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
									/>
								</div>

								<div>
									<label
										htmlFor="staffDashboardAutoLockHours"
										className="block text-xs font-bold text-slate-700 mb-1.5"
									>
										Auto-Lock Timer (Hours)
									</label>
									<input
										type="number"
										id="staffDashboardAutoLockHours"
										name="staffDashboardAutoLockHours"
										min="1"
										max="720"
										defaultValue={restaurant.staffDashboardAutoLockHours ?? 24}
										className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 focus:outline-none"
									/>
								</div>
							</div>
						</fieldset>

						<SubmitButton
							loadingText="Saving..."
							successText="Settings Saved"
							className="mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-black text-white sm:w-auto sm:justify-self-end"
						>
							Save Settings
						</SubmitButton>
					</form>
				</div>
			</div>

			<BankAccountsManager
				slug={restaurant.slug}
				bankAccounts={restaurant.bankAccounts}
			/>

			<AdminAccountSettings />
		</div>
	);
}
