import { updatePlatformSettingsAction } from "@/actions/super-admin.actions";
import { SubmitButton } from "@/components/ui/action-button";

type PlatformSettingsFormProps = {
	platformName: string;
	logoUrl: string | null;
	paystackPublicKey: string | null;
	hasSecretKey: boolean;
	maintenanceMode: boolean;
};

const inputClassName =
	"h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
const labelClassName =
	"mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500";
const sectionClassName =
	"grid gap-4 rounded-2xl border border-slate-100 bg-white p-6";

export function PlatformSettingsForm({
	platformName,
	logoUrl,
	paystackPublicKey,
	hasSecretKey,
	maintenanceMode,
}: PlatformSettingsFormProps) {
	return (
		<form action={updatePlatformSettingsAction} className="grid gap-6">
			<div className={sectionClassName}>
				<h2 className="text-lg font-black text-slate-950">General</h2>
				<div className="grid gap-4 sm:grid-cols-2">
					<div>
						<label htmlFor="platformName" className={labelClassName}>
							Platform Name
						</label>
						<input
							id="platformName"
							type="text"
							name="platformName"
							defaultValue={platformName}
							required
							className={inputClassName}
						/>
					</div>
					<div>
						<label htmlFor="logoUrl" className={labelClassName}>
							Logo URL
						</label>
						<input
							id="logoUrl"
							type="url"
							name="logoUrl"
							defaultValue={logoUrl ?? ""}
							placeholder="https://..."
							className={inputClassName}
						/>
					</div>
				</div>
			</div>

			<div className={sectionClassName}>
				<h2 className="text-lg font-black text-slate-950">Payments</h2>
				<div className="grid gap-4 sm:grid-cols-2">
					<div>
						<label htmlFor="paystackPublicKey" className={labelClassName}>
							Paystack Public Key
						</label>
						<input
							id="paystackPublicKey"
							type="text"
							name="paystackPublicKey"
							defaultValue={paystackPublicKey ?? ""}
							placeholder="pk_..."
							className={inputClassName}
						/>
					</div>
					<div>
						<label htmlFor="paystackSecretKey" className={labelClassName}>
							Paystack Secret Key
						</label>
						<input
							id="paystackSecretKey"
							type="password"
							name="paystackSecretKey"
							placeholder={
								hasSecretKey
									? "•••••••• (saved — leave blank to keep)"
									: "sk_..."
							}
							autoComplete="off"
							className={inputClassName}
						/>
					</div>
				</div>
			</div>

			<div className={sectionClassName}>
				<h2 className="text-lg font-black text-slate-950">Maintenance</h2>
				<label className="flex items-center gap-2 text-sm font-bold text-slate-700">
					<input
						type="checkbox"
						name="maintenanceMode"
						defaultChecked={maintenanceMode}
						className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
					/>
					Maintenance Mode
				</label>
			</div>

			<SubmitButton
				loadingText="Saving..."
				successText="Saved"
				className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 sm:w-auto sm:justify-self-end"
			>
				Save Settings
			</SubmitButton>
		</form>
	);
}
