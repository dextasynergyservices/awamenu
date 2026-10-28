"use client";

import { useState } from "react";
import { setRestaurantCommissionAction } from "@/actions/commission.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";

export type CommissionState = {
	kind: "platform" | "custom" | "exempt";
	percent: number;
	note: string | null;
};

const input =
	"h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:text-sm";

/**
 * Follow the platform rate, set a custom rate, or exempt a restaurant from
 * AwaMenu Pay commission. Shows what the restaurant would keep on an example
 * order so the effect is obvious before saving.
 */
export function CommissionDialog({
	open,
	onOpenChange,
	restaurantId,
	restaurantName,
	current,
	platformPercent,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	restaurantId: string;
	restaurantName: string;
	current: CommissionState;
	platformPercent: number;
}) {
	const [mode, setMode] = useState(current.kind);
	const [percent, setPercent] = useState(
		current.kind === "custom" ? String(current.percent) : "",
	);
	const rate =
		mode === "platform"
			? platformPercent
			: mode === "exempt"
				? 0
				: Number(percent) || 0;
	const example = 10_000;
	const options = [
		{
			key: "platform",
			label: "Platform rate",
			hint: `${platformPercent}%, follows changes`,
		},
		{
			key: "custom",
			label: "Custom rate",
			hint: "A different % for this restaurant",
		},
		{ key: "exempt", label: "Exempt", hint: "No commission" },
	] as const;

	return (
		<Dialog open={open} onOpenChange={onOpenChange} size="md" variant="sheet">
			<DialogHeader
				title="AwaMenu Pay commission"
				description={`${restaurantName}. Applies from the next payment; past payments keep the rate they were charged at.`}
				bordered
				className="p-4"
			/>
			<DialogBody className="p-4">
				<ActionForm
					action={setRestaurantCommissionAction}
					onSuccess={() => onOpenChange(false)}
					className="grid gap-3"
				>
					<input type="hidden" name="restaurantId" value={restaurantId} />
					<fieldset className="grid gap-2 sm:grid-cols-3">
						<legend className="sr-only">Commission</legend>
						{options.map((o) => (
							<label
								key={o.key}
								className={cn(
									"cursor-pointer rounded-xl border p-3 has-focus-visible:ring-2 has-focus-visible:ring-emerald-500",
									mode === o.key
										? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600"
										: "border-slate-200 hover:bg-slate-50",
								)}
							>
								<input
									type="radio"
									name="mode"
									value={o.key}
									checked={mode === o.key}
									onChange={() => setMode(o.key)}
									className="sr-only"
								/>
								<span className="block text-sm font-black text-slate-900">
									{o.label}
								</span>
								<span className="block text-xs font-medium text-slate-500">
									{o.hint}
								</span>
							</label>
						))}
					</fieldset>
					{mode === "custom" ? (
						<label className="grid gap-1">
							<span className="text-xs font-bold text-slate-600">Rate (%)</span>
							<input
								name="percent"
								type="number"
								min={0.01}
								max={50}
								step={0.01}
								required
								value={percent}
								onChange={(e) => setPercent(e.target.value)}
								className={input}
							/>
						</label>
					) : null}
					{mode !== "platform" ? (
						<label className="grid gap-1">
							<span className="text-xs font-bold text-slate-600">
								Why (kept in the audit log, shown to super admins)
							</span>
							<input
								name="note"
								required
								minLength={3}
								maxLength={300}
								defaultValue={current.note ?? ""}
								placeholder="e.g. Launch partner: 0% for the first 6 months"
								className={input}
							/>
						</label>
					) : null}
					<p className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
						On a ₦{example.toLocaleString()} order, AwaMenu keeps{" "}
						<span className="font-black text-slate-900">
							₦{Math.round((example * rate) / 100).toLocaleString()}
						</span>{" "}
						({rate}%) on top of the payment provider&apos;s fee.
					</p>
					<SubmitButton
						loadingText="Saving…"
						className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
					>
						Save commission
					</SubmitButton>
				</ActionForm>
			</DialogBody>
		</Dialog>
	);
}
