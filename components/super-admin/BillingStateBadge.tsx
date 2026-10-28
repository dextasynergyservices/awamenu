import {
	AlertTriangle,
	BadgeCheck,
	CalendarClock,
	CircleSlash,
	Lock,
	type LucideIcon,
	Wallet,
} from "lucide-react";
import { BILLING_STATE_LABEL, type BillingState } from "@/lib/billing-state";
import { cn } from "@/lib/utils";

const STYLE: Record<BillingState, { className: string; icon: LucideIcon }> = {
	ACTIVE: { className: "bg-emerald-100 text-emerald-800", icon: BadgeCheck },
	EXPIRING_SOON: {
		className: "bg-amber-100 text-amber-800",
		icon: CalendarClock,
	},
	GRACE: { className: "bg-orange-100 text-orange-800", icon: AlertTriangle },
	LAPSED: { className: "bg-red-100 text-red-800", icon: Lock },
	FREE: { className: "bg-slate-100 text-slate-700", icon: Wallet },
	NONE: { className: "bg-slate-100 text-slate-500", icon: CircleSlash },
};

/** Billing state with icon + label (never colour alone). */
export function BillingStateBadge({
	state,
	className,
}: {
	state: BillingState;
	className?: string;
}) {
	const { className: tone, icon: Icon } = STYLE[state];
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-black",
				tone,
				className,
			)}
		>
			<Icon className="size-3" aria-hidden="true" />
			{BILLING_STATE_LABEL[state]}
		</span>
	);
}

export function AdminSuspendedBadge() {
	return (
		<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-black text-white">
			<CircleSlash className="size-3" aria-hidden="true" />
			Suspended by admin
		</span>
	);
}
