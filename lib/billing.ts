export const BILLING_INTERVALS = ["MONTHLY", "QUARTERLY", "YEARLY"] as const;

export type BillingIntervalValue = (typeof BILLING_INTERVALS)[number];

export const BILLING_INTERVAL_DETAILS: Record<
	BillingIntervalValue,
	{
		label: string;
		shortLabel: string;
		priceSuffix: string;
		months: number;
		paystackInterval: "monthly" | "quarterly" | "annually";
	}
> = {
	MONTHLY: {
		label: "Monthly",
		shortLabel: "Monthly",
		priceSuffix: "/mo",
		months: 1,
		paystackInterval: "monthly",
	},
	QUARTERLY: {
		label: "Quarterly",
		shortLabel: "3 months",
		priceSuffix: "/quarter",
		months: 3,
		paystackInterval: "quarterly",
	},
	YEARLY: {
		label: "Yearly",
		shortLabel: "12 months",
		priceSuffix: "/year",
		months: 12,
		paystackInterval: "annually",
	},
};

type PlanWithBilling = {
	monthlyPrice: unknown;
	quarterlyPrice?: unknown;
	yearlyPrice?: unknown;
	paystackPlanCode?: string | null;
	paystackMonthlyPlanCode?: string | null;
	paystackQuarterlyPlanCode?: string | null;
	paystackYearlyPlanCode?: string | null;
};

function money(value: unknown) {
	const numeric = Number(value ?? 0);
	return Number.isFinite(numeric) ? numeric : 0;
}

export function parseBillingInterval(
	value: FormDataEntryValue | string | null | undefined,
): BillingIntervalValue {
	const normalized = String(value ?? "MONTHLY").toUpperCase();
	return BILLING_INTERVALS.includes(normalized as BillingIntervalValue)
		? (normalized as BillingIntervalValue)
		: "MONTHLY";
}

export function getPlanIntervalPrice(
	plan: PlanWithBilling,
	interval: BillingIntervalValue,
) {
	const monthlyPrice = money(plan.monthlyPrice);
	if (interval === "MONTHLY") return monthlyPrice;

	if (interval === "QUARTERLY") {
		const quarterlyPrice = money(plan.quarterlyPrice);
		return quarterlyPrice > 0 ? quarterlyPrice : monthlyPrice * 3;
	}

	const yearlyPrice = money(plan.yearlyPrice);
	return yearlyPrice > 0 ? yearlyPrice : monthlyPrice * 12;
}

export function getPlanMonthlyEquivalent(
	plan: PlanWithBilling,
	interval: BillingIntervalValue,
) {
	const detail = BILLING_INTERVAL_DETAILS[interval];
	return getPlanIntervalPrice(plan, interval) / detail.months;
}

export function getPlanSavingsPercent(
	plan: PlanWithBilling,
	interval: BillingIntervalValue,
) {
	if (interval === "MONTHLY") return 0;

	const monthlyPrice = money(plan.monthlyPrice);
	const detail = BILLING_INTERVAL_DETAILS[interval];
	const fullPrice = monthlyPrice * detail.months;
	if (fullPrice <= 0) return 0;

	return Math.max(
		0,
		Math.round(
			((fullPrice - getPlanIntervalPrice(plan, interval)) / fullPrice) * 100,
		),
	);
}

export function getPlanPaystackCode(
	plan: PlanWithBilling,
	interval: BillingIntervalValue,
) {
	if (interval === "MONTHLY") {
		return plan.paystackMonthlyPlanCode || plan.paystackPlanCode || undefined;
	}
	if (interval === "QUARTERLY")
		return plan.paystackQuarterlyPlanCode || undefined;
	return plan.paystackYearlyPlanCode || undefined;
}

export function addBillingPeriod(from: Date, interval: BillingIntervalValue) {
	const end = new Date(from);
	end.setMonth(end.getMonth() + BILLING_INTERVAL_DETAILS[interval].months);
	return end;
}

export function formatCurrency(amount: number) {
	return `₦${amount.toLocaleString()}`;
}
