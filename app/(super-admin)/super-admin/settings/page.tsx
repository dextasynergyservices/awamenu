import { PlatformSettingsForm } from "@/components/super-admin/PlatformSettingsForm";
import { db } from "@/lib/db";

export default async function SuperAdminSettingsPage() {
	const [settings, commissionOverrides] = await Promise.all([
		db.platformSetting.findFirst(),
		db.restaurant.count({
			where: { commissionPercentOverride: { not: null } },
		}),
	]);

	return (
		<div className="grid max-w-2xl gap-6">
			<div>
				<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
					Platform Settings
				</h1>
				<p className="mt-1 text-sm font-medium text-slate-600">
					Configure platform branding, payments, and maintenance mode.
				</p>
			</div>

			<PlatformSettingsForm
				platformName={settings?.platformName ?? "AwaMenu"}
				logoUrl={settings?.logoUrl ?? null}
				commissionOverrides={commissionOverrides}
				paystackPublicKey={settings?.paystackPublicKey ?? null}
				hasSecretKey={Boolean(settings?.paystackSecretKey)}
				maintenanceMode={settings?.maintenanceMode ?? false}
				awamenuPayCommissionPercent={Number(
					settings?.awamenuPayCommissionPercent ?? 0,
				)}
				enabledPaymentChannels={
					settings?.enabledPaymentChannels ?? [
						"AWAMENU_PAY",
						"OWN_GATEWAY",
						"BANK_TRANSFER",
						"CASH",
					]
				}
				awamenuPayProviders={
					settings?.awamenuPayProviders ?? ["PAYSTACK", "MONNIFY"]
				}
				ownGatewayProviders={
					settings?.ownGatewayProviders ?? [
						"PAYSTACK",
						"FLUTTERWAVE",
						"MONNIFY",
					]
				}
			/>
		</div>
	);
}
