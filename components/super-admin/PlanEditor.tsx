import {
	createPlanAction,
	updatePlanAction,
} from "@/actions/super-admin.actions";
import { SubmitButton } from "@/components/ui/action-button";
import type { db } from "@/lib/db";
import { BASE_MENU_TEMPLATE, MENU_TEMPLATES } from "@/lib/menu-templates";

type PlanEditorProps = {
	plan?: NonNullable<Awaited<ReturnType<typeof db.plan.findUnique>>>;
	onSaved?: () => void;
};

const featureFields = [
	{ name: "advancedAnalytics", label: "Advanced Analytics" },
	{ name: "removeAwamenuBranding", label: "Remove AwaMenu Branding" },
	{ name: "whatsappIntegration", label: "WhatsApp Integration" },
	{ name: "prioritySupport", label: "Priority Support" },
	{ name: "basicSupport", label: "Basic Support" },
] as const;

const inputClassName =
	"h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";
const labelClassName =
	"mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500";

export function PlanEditor({ plan, onSaved }: PlanEditorProps) {
	const isEdit = Boolean(plan);
	const action = isEdit ? updatePlanAction : createPlanAction;

	return (
		<form
			action={action}
			className="grid gap-6 rounded-2xl border border-slate-100 bg-white p-6"
		>
			{plan ? <input type="hidden" name="planId" value={plan.id} /> : null}

			<div className="grid gap-4 sm:grid-cols-2">
				<div>
					<label htmlFor="name" className={labelClassName}>
						Plan Name
					</label>
					<input
						id="name"
						type="text"
						name="name"
						defaultValue={plan?.name}
						required
						className={inputClassName}
					/>
				</div>
				<div>
					<label htmlFor="tier" className={labelClassName}>
						Tier
					</label>
					<select
						id="tier"
						name="tier"
						defaultValue={plan?.tier ?? "FREE"}
						disabled={isEdit}
						className={`${inputClassName} disabled:bg-slate-50 disabled:text-slate-400`}
					>
						<option value="FREE">Free</option>
						<option value="STARTER">Starter</option>
						<option value="PRO">Pro</option>
					</select>
					{isEdit ? (
						<input type="hidden" name="tier" value={plan?.tier} />
					) : null}
				</div>
				<div className="sm:col-span-2">
					<label htmlFor="description" className={labelClassName}>
						Description
					</label>
					<textarea
						id="description"
						name="description"
						defaultValue={plan?.description ?? ""}
						rows={2}
						className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-base font-medium text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
					/>
				</div>
				<div>
					<label htmlFor="monthlyPrice" className={labelClassName}>
						Monthly Price (₦)
					</label>
					<input
						id="monthlyPrice"
						type="number"
						name="monthlyPrice"
						min={0}
						step="0.01"
						defaultValue={plan ? Number(plan.monthlyPrice) : 0}
						required
						className={inputClassName}
					/>
				</div>
				<div>
					<label htmlFor="quarterlyPrice" className={labelClassName}>
						Quarterly Price (₦)
					</label>
					<input
						id="quarterlyPrice"
						type="number"
						name="quarterlyPrice"
						min={0}
						step="0.01"
						defaultValue={plan ? Number(plan.quarterlyPrice) : 0}
						required
						className={inputClassName}
					/>
				</div>
				<div>
					<label htmlFor="yearlyPrice" className={labelClassName}>
						Yearly Price (₦)
					</label>
					<input
						id="yearlyPrice"
						type="number"
						name="yearlyPrice"
						min={0}
						step="0.01"
						defaultValue={plan ? Number(plan.yearlyPrice) : 0}
						required
						className={inputClassName}
					/>
				</div>
				<div>
					<label htmlFor="paystackMonthlyPlanCode" className={labelClassName}>
						Paystack Monthly Plan Code
					</label>
					<input
						id="paystackMonthlyPlanCode"
						type="text"
						name="paystackMonthlyPlanCode"
						defaultValue={
							plan?.paystackMonthlyPlanCode ?? plan?.paystackPlanCode ?? ""
						}
						className={inputClassName}
						placeholder="PLN_monthly"
					/>
				</div>
				<div>
					<label htmlFor="paystackQuarterlyPlanCode" className={labelClassName}>
						Paystack Quarterly Plan Code
					</label>
					<input
						id="paystackQuarterlyPlanCode"
						type="text"
						name="paystackQuarterlyPlanCode"
						defaultValue={plan?.paystackQuarterlyPlanCode ?? ""}
						className={inputClassName}
						placeholder="PLN_quarterly"
					/>
				</div>
				<div>
					<label htmlFor="paystackYearlyPlanCode" className={labelClassName}>
						Paystack Yearly Plan Code
					</label>
					<input
						id="paystackYearlyPlanCode"
						type="text"
						name="paystackYearlyPlanCode"
						defaultValue={plan?.paystackYearlyPlanCode ?? ""}
						className={inputClassName}
						placeholder="PLN_yearly"
					/>
				</div>
				<div>
					<label htmlFor="maxCategories" className={labelClassName}>
						Max Categories (-1 = unlimited)
					</label>
					<input
						id="maxCategories"
						type="number"
						name="maxCategories"
						defaultValue={plan?.maxCategories ?? 2}
						required
						className={inputClassName}
					/>
				</div>
				<div>
					<label htmlFor="maxMenuItems" className={labelClassName}>
						Max Menu Items (-1 = unlimited)
					</label>
					<input
						id="maxMenuItems"
						type="number"
						name="maxMenuItems"
						defaultValue={plan?.maxMenuItems ?? 8}
						required
						className={inputClassName}
					/>
				</div>
				<div>
					<label htmlFor="maxTables" className={labelClassName}>
						Max Tables (-1 = unlimited)
					</label>
					<input
						id="maxTables"
						type="number"
						name="maxTables"
						defaultValue={plan?.maxTables ?? 1}
						required
						className={inputClassName}
					/>
				</div>
			</div>

			<div>
				<p className={labelClassName}>Menu Layouts Included</p>
				<p className="mb-3 text-xs font-medium text-slate-500">
					Which layouts restaurants on this plan can choose from. Classic is
					included on every plan. Tick more than one to let them switch.
				</p>
				<div className="grid gap-3 sm:grid-cols-2">
					{MENU_TEMPLATES.map((template) => {
						const isBase = template.id === BASE_MENU_TEMPLATE;
						return (
							<label
								key={template.id}
								className="flex items-start gap-2 text-sm font-bold text-slate-700"
							>
								<input
									type="checkbox"
									name="availableTemplates"
									value={template.id}
									// The base layout is always granted server-side, so it's
									// shown locked on rather than as a real choice.
									defaultChecked={
										isBase ||
										(plan?.availableTemplates ?? []).includes(template.id)
									}
									disabled={isBase}
									className="mt-0.5 size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-60"
								/>
								<span>
									{template.name}
									{isBase ? (
										<span className="ml-1 font-medium text-slate-400">
											(always included)
										</span>
									) : null}
									<span className="block text-xs font-medium text-slate-500">
										{template.description}
									</span>
								</span>
							</label>
						);
					})}
				</div>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				{featureFields.map((field) => (
					<label
						key={field.name}
						className="flex items-center gap-2 text-sm font-bold text-slate-700"
					>
						<input
							type="checkbox"
							name={field.name}
							defaultChecked={
								plan ? plan[field.name] : field.name === "whatsappIntegration"
							}
							className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
						/>
						{field.label}
					</label>
				))}
				<label className="flex items-center gap-2 text-sm font-bold text-slate-700">
					<input
						type="checkbox"
						name="isActive"
						defaultChecked={plan ? plan.isActive : true}
						className="size-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
					/>
					Active (visible to new signups)
				</label>
			</div>

			<SubmitButton
				loadingText={isEdit ? "Saving..." : "Creating..."}
				successText="Saved"
				onSuccess={onSaved}
				className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 sm:w-auto sm:justify-self-end"
			>
				{isEdit ? "Save Changes" : "Create Plan"}
			</SubmitButton>
		</form>
	);
}
