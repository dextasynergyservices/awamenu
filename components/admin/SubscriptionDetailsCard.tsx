"use client";

import {
	BarChart3,
	Crown,
	FileText,
	HeadphonesIcon,
	PenTool,
} from "lucide-react";
import { useState } from "react";
import { SettingsCard } from "@/components/admin/SettingsCard";
import { ManageBillingModal } from "./ManageBillingModal";

type SubscriptionDetailsProps = {
	planName?: string;
	status?: string;
	currentPeriodEnd: Date | null;
	hasCard?: boolean;
	slug: string;
};

export function SubscriptionDetailsCard({
	planName = "Free Tier",
	status = "ACTIVE",
	currentPeriodEnd,
	hasCard = false,
	slug,
}: SubscriptionDetailsProps) {
	const isEffectivelyActive =
		status === "ACTIVE" ||
		status === "TRIALING" ||
		(status === "CANCELLED" &&
			currentPeriodEnd &&
			new Date(currentPeriodEnd) > new Date());
	const displayStatus =
		status === "CANCELLED"
			? currentPeriodEnd && new Date(currentPeriodEnd) > new Date()
				? "ACTIVE"
				: "EXPIRED"
			: status;

	const [isModalOpen, setIsModalOpen] = useState(false);

	return (
		<>
			<SettingsCard
				title="Subscription & Billing"
				description="Manage your plan and billing details."
				icon={Crown}
				headerAction={
					<button
						type="button"
						onClick={() => setIsModalOpen(true)}
						className="inline-flex h-9 items-center justify-center rounded-full bg-white px-4 text-xs font-bold text-slate-700 border border-slate-200 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
					>
						Manage Billing
					</button>
				}
			>
				<div className="flex flex-col rounded-2xl border border-emerald-50 bg-emerald-50/50 p-5 sm:p-6">
					<div>
						<p className="text-xs md:text-[11px] font-bold text-slate-500 mb-1 uppercase tracking-wider">
							Current Plan
						</p>
						<div className="flex items-center gap-3">
							<span className="text-sm md:text-xl font-black text-slate-950">
								{planName}
							</span>
							{isEffectivelyActive ? (
								<span className="inline-flex items-center gap-1 rounded-full bg-emerald-200/50 px-2 py-0.5 text-xs font-bold text-emerald-800 uppercase tracking-wide">
									{displayStatus}
								</span>
							) : (
								<span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800 uppercase tracking-wide">
									{displayStatus}
								</span>
							)}
						</div>
						{currentPeriodEnd && (
							<p className="mt-2 text-xs md:text-[13px] font-medium text-slate-600">
								Renews on{" "}
								{new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(
									currentPeriodEnd,
								)}
							</p>
						)}
					</div>
					<div className="mt-6 flex flex-wrap items-center gap-4 sm:gap-6 border-t border-emerald-100/60 pt-6">
						<div className="flex items-center gap-2">
							<div className="grid size-8 place-items-center rounded-lg border border-emerald-200 bg-white text-emerald-600">
								<FileText className="size-4" />
							</div>
							<span className="text-xs md:text-[11px] font-bold text-emerald-900 leading-tight">
								Unlimited
								<br />
								Orders
							</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="grid size-8 place-items-center rounded-lg border border-emerald-200 bg-white text-emerald-600">
								<BarChart3 className="size-4" />
							</div>
							<span className="text-xs md:text-[11px] font-bold text-emerald-900 leading-tight">
								Advanced
								<br />
								Analytics
							</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="grid size-8 place-items-center rounded-lg border border-emerald-200 bg-white text-emerald-600">
								<HeadphonesIcon className="size-4" />
							</div>
							<span className="text-xs md:text-[11px] font-bold text-emerald-900 leading-tight">
								Priority
								<br />
								Support
							</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="grid size-8 place-items-center rounded-lg border border-emerald-200 bg-white text-emerald-600">
								<PenTool className="size-4" />
							</div>
							<span className="text-xs md:text-[11px] font-bold text-emerald-900 leading-tight">
								Custom
								<br />
								Branding
							</span>
						</div>
					</div>
				</div>
			</SettingsCard>

			{isModalOpen && (
				<ManageBillingModal
					planName={planName}
					status={status}
					currentPeriodEnd={currentPeriodEnd}
					hasCard={hasCard}
					slug={slug}
					onClose={() => setIsModalOpen(false)}
				/>
			)}
		</>
	);
}
