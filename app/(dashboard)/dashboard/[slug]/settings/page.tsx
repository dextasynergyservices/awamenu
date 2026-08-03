import { Settings } from "lucide-react";
import { redirect } from "next/navigation";
import { AdminAccountSettings } from "@/components/admin/AdminAccountSettings";
import { BankAccountsManager } from "@/components/admin/BankAccountsManager";
import { QRDownload } from "@/components/admin/QRDownload";
import { RestaurantBrandingForm } from "@/components/admin/RestaurantBrandingForm";
import { RestaurantInfoForm } from "@/components/admin/RestaurantInfoForm";
import { RestaurantSettingsForm } from "@/components/admin/RestaurantSettingsForm";
import { SubscriptionDetailsCard } from "@/components/admin/SubscriptionDetailsCard";
import { env } from "@/env";
import { requireUser } from "@/lib/auth-guards";
import { parseBillingInterval } from "@/lib/billing";
import { db } from "@/lib/db";
import { verifySubscriptionPaymentReference } from "@/lib/payments";

export default async function SettingsPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{
		reference?: string;
		trxref?: string;
		planId?: string;
		billing?: string;
	}>;
}) {
	const user = await requireUser();
	const { slug } = await params;
	const { reference, trxref, planId: newPlanId, billing } = await searchParams;
	const billingInterval = parseBillingInterval(billing);
	const paymentReference = reference ?? trxref;

	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		select: {
			id: true,
			name: true,
			description: true,
			phone: true,
			address: true,
			currency: true,
			timezone: true,
			slug: true,
			logoUrl: true,
			coverUrl: true,
			primaryColor: true,
			fontFamily: true,
			activeTemplate: true,
			dineInPaymentPolicy: true,
			staffDashboardPassword: true,
			staffDashboardAutoLockHours: true,
			bankAccounts: {
				orderBy: { createdAt: "asc" },
			},
			subscription: {
				include: { plan: true },
			},
		},
	});

	if (!restaurant) {
		redirect("/dashboard");
	}

	if (paymentReference && newPlanId) {
		await verifySubscriptionPaymentReference({
			reference: paymentReference,
			userId: user.id,
			planId: newPlanId,
			billingInterval,
			restaurantId: restaurant.id,
		});

		// Remove reference from URL so we don't re-verify on refresh
		redirect(`/dashboard/${restaurant.slug}/settings`);
	}

	const qrUrl = `${env.NEXT_PUBLIC_APP_URL}/${restaurant.slug}`;

	return (
		<div className="mx-auto w-full max-w-6xl pb-12">
			<div className="mb-4 flex flex-col items-start justify-between gap-3 sm:mb-8 sm:flex-row sm:items-center">
				<div className="flex items-center gap-2 sm:gap-4">
					<div className="grid size-8 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700 sm:size-12 sm:rounded-2xl">
						<Settings className="size-4 sm:size-6" />
					</div>
					<div>
						<h1 className="text-sm font-bold tracking-tight text-slate-950 sm:text-3xl sm:font-black">
							Settings
						</h1>
						<p className="text-xs font-medium text-slate-500 sm:mt-1 sm:text-sm">
							Manage your restaurant preferences and account settings.
						</p>
					</div>
				</div>
				<div className="w-full shrink-0 sm:w-auto">
					<QRDownload restaurantName={restaurant.name} qrUrl={qrUrl} />
				</div>
			</div>

			<div className="grid gap-3 md:grid-cols-2 md:items-start md:gap-8">
				{/* Column 1 */}
				<div className="grid gap-3 md:gap-8">
					<RestaurantInfoForm
						restaurantId={restaurant.id}
						slug={restaurant.slug}
						name={restaurant.name}
						description={restaurant.description}
						phone={restaurant.phone}
						address={restaurant.address}
						currency={restaurant.currency}
						timezone={restaurant.timezone}
					/>

					<RestaurantBrandingForm
						restaurantId={restaurant.id}
						slug={restaurant.slug}
						logoUrl={restaurant.logoUrl}
						primaryColor={restaurant.primaryColor}
						activeTemplate={restaurant.activeTemplate}
					/>

					<BankAccountsManager
						slug={restaurant.slug}
						bankAccounts={restaurant.bankAccounts}
					/>
				</div>

				{/* Column 2 */}
				<div className="grid gap-3 md:gap-8">
					<SubscriptionDetailsCard
						planName={restaurant.subscription?.plan?.name}
						status={restaurant.subscription?.status}
						currentPeriodEnd={restaurant.subscription?.currentPeriodEnd ?? null}
						hasCard={!!restaurant.subscription?.paystackCustomerCode}
						slug={restaurant.slug}
					/>

					<RestaurantSettingsForm
						slug={restaurant.slug}
						dineInPaymentPolicy={restaurant.dineInPaymentPolicy}
						hasStaffDashboardPassword={!!restaurant.staffDashboardPassword}
						staffDashboardAutoLockHours={restaurant.staffDashboardAutoLockHours}
					/>

					<AdminAccountSettings />
				</div>
			</div>
		</div>
	);
}
