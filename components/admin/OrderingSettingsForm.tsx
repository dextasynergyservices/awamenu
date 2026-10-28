"use client";

import { ShoppingBag } from "lucide-react";
import { useState } from "react";
import { updateOrderingSettingsAction } from "@/actions/restaurant.actions";
import { SettingsCard } from "@/components/admin/SettingsCard";
import { SubmitButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";

type OrderingSettingsFormProps = {
	slug: string;
	currency: string;
	dineInEnabled: boolean;
	pickupEnabled: boolean;
	deliveryEnabled: boolean;
	deliveryFee: number;
	freeDeliveryMinimum: number | null;
};

const inputClassName =
	"h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base md:text-[13px] font-medium text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500";

/**
 * Which ways customers can order, and what delivery costs. Table reservations
 * have their own switch on the reservations page.
 */
export function OrderingSettingsForm(props: OrderingSettingsFormProps) {
	const [deliveryOn, setDeliveryOn] = useState(props.deliveryEnabled);

	const options = [
		{
			name: "dineInEnabled",
			label: "Dine-in",
			help: "Customers at a table order from the menu.",
			checked: props.dineInEnabled,
		},
		{
			name: "pickupEnabled",
			label: "Pickup",
			help: "Customers order ahead and collect.",
			checked: props.pickupEnabled,
		},
		{
			name: "deliveryEnabled",
			label: "Delivery",
			help: "You deliver to the customer's address.",
			checked: props.deliveryEnabled,
		},
	];

	return (
		<SettingsCard
			title="Ordering"
			anchorId="ordering"
			description="Choose how customers can order, and set your delivery fee."
			icon={ShoppingBag}
		>
			<ActionForm action={updateOrderingSettingsAction} className="grid gap-5">
				<input type="hidden" name="slug" value={props.slug} />

				<fieldset className="grid gap-2">
					<legend className="mb-2 text-xs md:text-[13px] font-black text-slate-950">
						Ways to order
					</legend>
					{options.map((option) => (
						<label
							key={option.name}
							className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition-colors hover:bg-slate-50 has-checked:border-emerald-600 has-checked:bg-emerald-50"
						>
							<input
								type="checkbox"
								name={option.name}
								defaultChecked={option.checked}
								onChange={
									option.name === "deliveryEnabled"
										? (event) => setDeliveryOn(event.target.checked)
										: undefined
								}
								className="mt-1 size-4 accent-emerald-700"
							/>
							<span className="min-w-0">
								<span className="block text-xs md:text-[13px] font-bold text-slate-950">
									{option.label}
								</span>
								<span className="block text-xs text-slate-500">
									{option.help}
								</span>
							</span>
						</label>
					))}
				</fieldset>

				{deliveryOn ? (
					<fieldset className="grid gap-3 sm:grid-cols-2">
						<legend className="mb-2 text-xs md:text-[13px] font-black text-slate-950">
							Delivery fee
						</legend>
						<label className="grid gap-1">
							<span className="text-xs font-bold text-slate-600">
								Fee ({props.currency})
							</span>
							<input
								type="number"
								name="deliveryFee"
								min="0"
								step="50"
								defaultValue={props.deliveryFee}
								className={inputClassName}
							/>
							<span className="text-xs text-slate-400">
								Added to every delivery order. 0 means free delivery.
							</span>
						</label>
						<label className="grid gap-1">
							<span className="text-xs font-bold text-slate-600">
								Free delivery over ({props.currency})
							</span>
							<input
								type="number"
								name="freeDeliveryMinimum"
								min="0"
								step="100"
								placeholder="Optional"
								defaultValue={props.freeDeliveryMinimum ?? ""}
								className={inputClassName}
							/>
							<span className="text-xs text-slate-400">
								Orders at or above this amount deliver free. Leave blank to
								always charge.
							</span>
						</label>
					</fieldset>
				) : (
					// Keep the saved fee when delivery is switched off.
					<>
						<input type="hidden" name="deliveryFee" value={props.deliveryFee} />
						<input
							type="hidden"
							name="freeDeliveryMinimum"
							value={props.freeDeliveryMinimum ?? ""}
						/>
					</>
				)}

				<SubmitButton
					loadingText="Saving..."
					successText="Saved"
					className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-black text-white hover:bg-emerald-800"
				>
					Save ordering settings
				</SubmitButton>
			</ActionForm>
		</SettingsCard>
	);
}
