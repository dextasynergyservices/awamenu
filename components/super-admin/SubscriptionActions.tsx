"use client";

import {
	ArrowRightLeft,
	BellRing,
	CalendarPlus,
	ExternalLink,
	Receipt,
	RefreshCwOff,
	Store,
} from "lucide-react";
import { useState } from "react";
import {
	cancelAutoRenewAction,
	changeSubscriptionPlanAction,
	extendSubscriptionAction,
	recordOfflinePaymentAction,
	sendBillingReminderAction,
} from "@/actions/subscription-admin.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";
import {
	RowActionButton,
	RowActionForm,
	RowActionLink,
	RowActionSeparator,
	RowActions,
} from "@/components/ui/RowActions";

export type PlanOption = {
	id: string;
	name: string;
	monthly: number;
	quarterly: number;
	yearly: number;
};

export type SubscriptionActionTarget = {
	id: string;
	label: string;
	restaurantId: string | null;
	restaurantSlug: string | null;
	planId: string;
	interval: "MONTHLY" | "QUARTERLY" | "YEARLY";
	autoRenew: boolean;
	isFree: boolean;
	periodEnd: string;
};

const input =
	"h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 sm:text-sm";
const fieldLabel = "mb-1 block text-xs font-bold text-slate-600";
const primary =
	"inline-flex h-10 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800";

const INTERVALS = [
	{ value: "MONTHLY", label: "Monthly" },
	{ value: "QUARTERLY", label: "Quarterly" },
	{ value: "YEARLY", label: "Yearly" },
] as const;

/** Mirrors lib/billing getPlanIntervalPrice: a missing price derives from monthly. */
function priceFor(plan: PlanOption | undefined, interval: string) {
	if (!plan) return 0;
	if (interval === "QUARTERLY")
		return plan.quarterly > 0 ? plan.quarterly : plan.monthly * 3;
	if (interval === "YEARLY")
		return plan.yearly > 0 ? plan.yearly : plan.monthly * 12;
	return plan.monthly;
}

function Reason({ placeholder }: { placeholder: string }) {
	return (
		<label className="grid gap-1">
			<span className={fieldLabel}>Reason (kept in the audit log)</span>
			<input
				name="reason"
				required
				minLength={3}
				maxLength={300}
				placeholder={placeholder}
				className={input}
			/>
		</label>
	);
}

type DialogKind = "extend" | "payment" | "plan" | "cancel" | null;

export function SubscriptionActions({
	target,
	plans,
}: {
	target: SubscriptionActionTarget;
	plans: PlanOption[];
}) {
	const [open, setOpen] = useState<DialogKind>(null);
	const close = () => setOpen(null);
	const paidPlans = plans.filter(
		(p) => p.monthly > 0 || p.quarterly > 0 || p.yearly > 0,
	);

	return (
		<>
			<RowActions label={`Actions for ${target.label}`}>
				<RowActionButton
					icon={CalendarPlus}
					onSelect={() => setOpen("extend")}
					disabled={target.isFree}
					title={target.isFree ? "Free plans don't expire" : undefined}
				>
					Extend…
				</RowActionButton>
				<RowActionButton icon={Receipt} onSelect={() => setOpen("payment")}>
					Record payment…
				</RowActionButton>
				<RowActionButton icon={ArrowRightLeft} onSelect={() => setOpen("plan")}>
					Change plan…
				</RowActionButton>
				<RowActionForm
					icon={BellRing}
					action={sendBillingReminderAction}
					fields={{ subscriptionId: target.id }}
					confirm={`Email ${target.label}'s owner the billing reminder that fits their status now?`}
					disabled={target.isFree || !target.restaurantId}
				>
					Send reminder
				</RowActionForm>
				{target.autoRenew ? (
					<RowActionButton
						icon={RefreshCwOff}
						tone="danger"
						onSelect={() => setOpen("cancel")}
					>
						Cancel auto-renew…
					</RowActionButton>
				) : null}
				{target.restaurantId ? (
					<>
						<RowActionSeparator />
						<RowActionLink
							icon={Store}
							href={`/super-admin/restaurants/${target.restaurantId}`}
						>
							Open restaurant
						</RowActionLink>
						<RowActionLink
							icon={ExternalLink}
							href={`/${target.restaurantSlug}`}
							external
						>
							View storefront
						</RowActionLink>
					</>
				) : null}
			</RowActions>

			<Dialog
				open={open === "extend"}
				onOpenChange={(o) => !o && close()}
				size="md"
				variant="sheet"
			>
				<DialogHeader
					title="Extend subscription"
					description={`${target.label} · currently ends ${target.periodEnd}. Days are added to the end date, or to today if it has already ended.`}
					bordered
					className="p-4"
				/>
				<DialogBody className="p-4">
					<ActionForm
						action={extendSubscriptionAction}
						onSuccess={close}
						className="grid gap-3"
					>
						<input type="hidden" name="subscriptionId" value={target.id} />
						<label className="grid gap-1">
							<span className={fieldLabel}>Days to add</span>
							<input
								name="days"
								type="number"
								min={1}
								max={366}
								defaultValue={7}
								required
								className={input}
							/>
						</label>
						<Reason placeholder="e.g. Goodwill after the payment outage" />
						<SubmitButton loadingText="Extending…" className={primary}>
							Extend
						</SubmitButton>
					</ActionForm>
				</DialogBody>
			</Dialog>

			<PaymentDialog
				open={open === "payment"}
				onClose={close}
				target={target}
				plans={paidPlans}
			/>

			<Dialog
				open={open === "plan"}
				onOpenChange={(o) => !o && close()}
				size="md"
				variant="sheet"
			>
				<DialogHeader
					title="Change plan"
					description="Keeps the current end date and takes no payment. Use Record payment when money is due."
					bordered
					className="p-4"
				/>
				<DialogBody className="p-4">
					{target.autoRenew ? (
						<p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
							This subscription auto-renews on Paystack at its current price.
							Cancel auto-renew first.
						</p>
					) : null}
					<ActionForm
						action={changeSubscriptionPlanAction}
						onSuccess={close}
						className="grid gap-3"
					>
						<input type="hidden" name="subscriptionId" value={target.id} />
						<div className="grid gap-3 sm:grid-cols-2">
							<label className="grid gap-1">
								<span className={fieldLabel}>Plan</span>
								<select
									name="planId"
									defaultValue={target.planId}
									className={input}
								>
									{plans.map((p) => (
										<option key={p.id} value={p.id}>
											{p.name}
										</option>
									))}
								</select>
							</label>
							<label className="grid gap-1">
								<span className={fieldLabel}>Billing</span>
								<select
									name="interval"
									defaultValue={target.interval}
									className={input}
								>
									{INTERVALS.map((i) => (
										<option key={i.value} value={i.value}>
											{i.label}
										</option>
									))}
								</select>
							</label>
						</div>
						<Reason placeholder="e.g. Agreed upgrade for the launch partnership" />
						<SubmitButton loadingText="Saving…" className={primary}>
							Change plan
						</SubmitButton>
					</ActionForm>
				</DialogBody>
			</Dialog>

			<Dialog
				open={open === "cancel"}
				onOpenChange={(o) => !o && close()}
				size="md"
				variant="sheet"
			>
				<DialogHeader
					title="Cancel auto-renew"
					description={`The card won't be charged again. The plan keeps working until ${target.periodEnd}, then the usual expiry emails and grace period apply.`}
					bordered
					className="p-4"
				/>
				<DialogBody className="p-4">
					<ActionForm
						action={cancelAutoRenewAction}
						onSuccess={close}
						className="grid gap-3"
					>
						<input type="hidden" name="subscriptionId" value={target.id} />
						<Reason placeholder="e.g. Owner asked by email to stop renewals" />
						<SubmitButton
							loadingText="Cancelling…"
							className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-red-600 px-4 text-sm font-black text-white hover:bg-red-700"
						>
							Cancel auto-renew
						</SubmitButton>
					</ActionForm>
				</DialogBody>
			</Dialog>
		</>
	);
}

function PaymentDialog({
	open,
	onClose,
	target,
	plans,
}: {
	open: boolean;
	onClose: () => void;
	target: SubscriptionActionTarget;
	plans: PlanOption[];
}) {
	const startPlan = plans.find((p) => p.id === target.planId) ?? plans[0];
	const [planId, setPlanId] = useState(startPlan?.id ?? "");
	const [interval, setPeriod] = useState<string>(target.interval);
	const [method, setMethod] = useState("BANK_TRANSFER");
	const listPrice = priceFor(
		plans.find((p) => p.id === planId),
		interval,
	);
	const [amount, setAmount] = useState<string>("");

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => !o && onClose()}
			size="lg"
			variant="sheet"
		>
			<DialogHeader
				title="Record a payment"
				description="For money received outside checkout. Starts the paid period like an online renewal, emails the owner a receipt, and appears on their invoices."
				bordered
				className="p-4"
			/>
			<DialogBody className="p-4">
				<ActionForm
					action={recordOfflinePaymentAction}
					onSuccess={onClose}
					className="grid gap-3"
				>
					<input type="hidden" name="subscriptionId" value={target.id} />
					<div className="grid gap-3 sm:grid-cols-2">
						<label className="grid gap-1">
							<span className={fieldLabel}>Plan</span>
							<select
								name="planId"
								value={planId}
								onChange={(e) => setPlanId(e.target.value)}
								className={input}
							>
								{plans.map((p) => (
									<option key={p.id} value={p.id}>
										{p.name}
									</option>
								))}
							</select>
						</label>
						<label className="grid gap-1">
							<span className={fieldLabel}>Period</span>
							<select
								name="interval"
								value={interval}
								onChange={(e) => setPeriod(e.target.value)}
								className={input}
							>
								{INTERVALS.map((i) => (
									<option key={i.value} value={i.value}>
										{i.label}
									</option>
								))}
							</select>
						</label>
						<label className="grid gap-1">
							<span className={fieldLabel}>How it was paid</span>
							<select
								name="method"
								value={method}
								onChange={(e) => setMethod(e.target.value)}
								className={input}
							>
								<option value="BANK_TRANSFER">Bank transfer</option>
								<option value="CASH">Cash</option>
								<option value="COMPLIMENTARY">Complimentary (no charge)</option>
							</select>
						</label>
						<label className="grid gap-1">
							<span className={fieldLabel}>Amount received (₦)</span>
							<input
								name="amount"
								type="number"
								min={0}
								step="0.01"
								value={method === "COMPLIMENTARY" ? "0" : amount}
								placeholder={String(listPrice)}
								onChange={(e) => setAmount(e.target.value)}
								disabled={method === "COMPLIMENTARY"}
								required={method !== "COMPLIMENTARY"}
								className={input}
							/>
							<span className="text-[11px] font-medium text-slate-500">
								List price ₦{listPrice.toLocaleString()}
								{amount &&
								Number(amount) !== listPrice &&
								method !== "COMPLIMENTARY"
									? ` · ${Number(amount) < listPrice ? "below" : "above"} list price`
									: ""}
							</span>
						</label>
						{method === "COMPLIMENTARY" ? (
							<input type="hidden" name="amount" value="0" />
						) : null}
					</div>
					<label className="grid gap-1">
						<span className={fieldLabel}>Reference (optional)</span>
						<input
							name="reference"
							maxLength={120}
							placeholder="Bank transfer reference or receipt number"
							className={input}
						/>
					</label>
					<label className="grid gap-1">
						<span className={fieldLabel}>Note (optional)</span>
						<input
							name="note"
							maxLength={300}
							placeholder="Shown on the payment record"
							className={input}
						/>
					</label>
					<SubmitButton loadingText="Recording…" className={primary}>
						Record payment and start period
					</SubmitButton>
				</ActionForm>
			</DialogBody>
		</Dialog>
	);
}
