"use client";

import {
	AlertTriangle,
	Ban,
	CheckCircle2,
	ChevronRight,
	KeyRound,
	MailWarning,
	Store,
	Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
	deleteUserAction,
	sendOwnerPasswordResetAction,
	toggleUserActiveAction,
} from "@/actions/super-admin.actions";
import {
	AdminSuspendedBadge,
	BillingStateBadge,
} from "@/components/super-admin/BillingStateBadge";
import { SuspendUserDialog } from "@/components/super-admin/SuspendUserButton";
import { MobileModal } from "@/components/ui/MobileModal";
import {
	RowActionButton,
	RowActionForm,
	RowActionLink,
	RowActionSeparator,
	RowActions,
} from "@/components/ui/RowActions";
import type { AccountRow } from "@/lib/super-admin-accounts";

const ONBOARDING_LABEL: Record<string, string> = {
	PENDING_PLAN: "Choosing a plan",
	PENDING_PAYMENT: "Paying for plan",
	PENDING_SETUP: "Setting up restaurant",
	COMPLETE: "Set up",
};

function day(iso: string | null) {
	if (!iso) return "—";
	return new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(new Date(iso));
}

function ago(iso: string | null) {
	if (!iso) return "Never";
	const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
	if (days < 1) return "Today";
	if (days === 1) return "Yesterday";
	if (days < 30) return `${days} days ago`;
	return day(iso);
}

function AccountStatus({ row }: { row: AccountRow }) {
	return row.accountActive ? (
		<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-black text-emerald-700">
			Can sign in
		</span>
	) : (
		<span
			title={row.accountSuspensionReason ?? undefined}
			className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-700"
		>
			Account suspended
		</span>
	);
}

function RestaurantLines({ row }: { row: AccountRow }) {
	if (row.restaurants.length === 0) {
		return (
			<span className="text-xs font-semibold text-slate-400">
				No restaurant
			</span>
		);
	}
	return (
		<div className="grid gap-2">
			{row.restaurants.map((r) => (
				<div key={r.id} className="min-w-0">
					<Link
						href={`/super-admin/restaurants/${r.id}`}
						className="block truncate text-sm font-black text-slate-900 hover:text-emerald-700"
					>
						{r.name}
					</Link>
					<div className="mt-1 flex flex-wrap items-center gap-1">
						{r.adminSuspended ? <AdminSuspendedBadge /> : null}
						<BillingStateBadge state={r.billing.state} />
						{r.billing.planName ? (
							<span className="text-[11px] font-semibold text-slate-500">
								{r.billing.planName}
								{r.billing.periodEnd
									? ` · ${r.billing.state === "LAPSED" || r.billing.state === "GRACE" ? "ended" : "renews"} ${day(r.billing.periodEnd)}`
									: ""}
							</span>
						) : null}
					</div>
				</div>
			))}
		</div>
	);
}

function Issues({ row }: { row: AccountRow }) {
	if (row.issues.length === 0) return null;
	return (
		<ul className="mt-2 grid gap-1">
			{row.issues.map((issue) => (
				<li
					key={issue}
					className="flex items-start gap-1.5 text-[11px] font-bold text-amber-800"
				>
					<AlertTriangle className="mt-px size-3 shrink-0" aria-hidden="true" />
					{issue}
				</li>
			))}
		</ul>
	);
}

/** The account's actions as menu items (used in the "⋯" menu and the sheet). */
function AccountActionItems({
	row,
	onSuspend,
}: {
	row: AccountRow;
	onSuspend: () => void;
}) {
	const firstRestaurant = row.restaurants[0];
	return (
		<>
			{firstRestaurant ? (
				<RowActionLink
					href={`/super-admin/restaurants/${firstRestaurant.id}`}
					icon={Store}
				>
					Open restaurant
				</RowActionLink>
			) : null}
			<RowActionForm
				action={sendOwnerPasswordResetAction}
				fields={{ userId: row.id }}
				confirm={`Email ${row.email} a password reset code? They will choose the new password themselves.`}
				icon={KeyRound}
			>
				Send password reset
			</RowActionForm>
			<RowActionSeparator />
			{row.accountActive ? (
				<RowActionButton tone="danger" icon={Ban} onSelect={onSuspend}>
					Suspend account
				</RowActionButton>
			) : (
				<RowActionForm
					action={toggleUserActiveAction}
					fields={{ userId: row.id, isActive: "true" }}
					tone="success"
					icon={CheckCircle2}
				>
					Restore sign-in
				</RowActionForm>
			)}
			<RowActionForm
				action={deleteUserAction}
				fields={{ userId: row.id }}
				confirm={`Delete ${row.email}? This cannot be undone.`}
				tone="danger"
				icon={Trash2}
				disabled={row.restaurants.length > 0}
				title={
					row.restaurants.length > 0
						? "Can't delete an owner who has restaurants"
						: undefined
				}
			>
				Delete account
			</RowActionForm>
		</>
	);
}

/** Desktop row: "⋯" menu. */
function AccountActions({ row }: { row: AccountRow }) {
	const [suspendOpen, setSuspendOpen] = useState(false);
	return (
		<>
			<RowActions label={`Actions for ${row.email}`}>
				<AccountActionItems row={row} onSuspend={() => setSuspendOpen(true)} />
			</RowActions>
			<SuspendUserDialog
				userId={row.id}
				userEmail={row.email}
				open={suspendOpen}
				onOpenChange={setSuspendOpen}
			/>
		</>
	);
}

/** Mobile sheet: the same actions as a compact list. */
function AccountActionList({ row }: { row: AccountRow }) {
	const [suspendOpen, setSuspendOpen] = useState(false);
	return (
		<>
			<div className="grid gap-0.5 rounded-xl border border-slate-100 p-1">
				<AccountActionItems row={row} onSuspend={() => setSuspendOpen(true)} />
			</div>
			<SuspendUserDialog
				userId={row.id}
				userEmail={row.email}
				open={suspendOpen}
				onOpenChange={setSuspendOpen}
			/>
		</>
	);
}

function Owner({ row }: { row: AccountRow }) {
	return (
		<div className="min-w-0">
			<p className="truncate text-sm font-black text-slate-900">
				{row.name ?? "Unnamed"}
			</p>
			<p className="flex items-center gap-1 truncate text-xs font-medium text-slate-500">
				{row.email}
				{!row.emailVerified ? (
					<MailWarning
						className="size-3.5 shrink-0 text-amber-600"
						aria-label="Email not verified"
					/>
				) : null}
			</p>
		</div>
	);
}

export function UsersTable({ rows }: { rows: AccountRow[] }) {
	const [selected, setSelected] = useState<AccountRow | null>(null);

	if (rows.length === 0) {
		return (
			<div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm font-medium text-slate-500">
				No accounts match.
			</div>
		);
	}

	return (
		<>
			{/* Mobile: cards, details in a sheet. */}
			<div className="grid gap-2 md:hidden">
				{rows.map((row) => (
					<button
						key={row.id}
						type="button"
						onClick={() => setSelected(row)}
						className="grid gap-2 rounded-2xl border border-slate-100 bg-white p-3 text-left active:bg-slate-50"
					>
						<div className="flex items-start justify-between gap-2">
							<Owner row={row} />
							<ChevronRight
								className="mt-1 size-4 shrink-0 text-slate-400"
								aria-hidden="true"
							/>
						</div>
						<div className="flex flex-wrap gap-1">
							{!row.accountActive ? <AccountStatus row={row} /> : null}
							{row.restaurants.map((r) => (
								<span key={r.id} className="inline-flex flex-wrap gap-1">
									{r.adminSuspended ? <AdminSuspendedBadge /> : null}
									<BillingStateBadge state={r.billing.state} />
								</span>
							))}
							{row.restaurants.length === 0 ? (
								<span className="text-[11px] font-bold text-slate-500">
									{ONBOARDING_LABEL[row.onboardingStatus] ??
										row.onboardingStatus}
								</span>
							) : null}
						</div>
						{row.issues.length > 0 ? (
							<p className="flex items-center gap-1 text-[11px] font-bold text-amber-800">
								<AlertTriangle className="size-3" aria-hidden="true" />
								{row.issues.length} issue{row.issues.length === 1 ? "" : "s"}
							</p>
						) : null}
					</button>
				))}
			</div>

			{/* Desktop: table. */}
			<div className="hidden overflow-x-auto rounded-2xl border border-slate-100 bg-white md:block">
				<table className="w-full min-w-[980px] text-left text-sm">
					<thead>
						<tr className="border-slate-100 border-b text-xs font-black uppercase tracking-wide text-slate-500">
							<th className="p-4">Owner</th>
							<th className="p-4">Restaurant &amp; billing</th>
							<th className="p-4">Onboarding</th>
							<th className="p-4">Account</th>
							<th className="p-4">Last active</th>
							<th className="p-4">Joined</th>
							<th className="w-12 p-4">
								<span className="sr-only">Actions</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => (
							<tr
								key={row.id}
								className="border-slate-50 border-b align-top last:border-0"
							>
								<td className="p-4">
									<Owner row={row} />
									<Issues row={row} />
								</td>
								<td className="p-4">
									<RestaurantLines row={row} />
								</td>
								<td className="p-4 text-xs font-bold text-slate-600">
									{ONBOARDING_LABEL[row.onboardingStatus] ??
										row.onboardingStatus}
								</td>
								<td className="p-4">
									<AccountStatus row={row} />
								</td>
								<td className="p-4 text-xs font-semibold text-slate-600">
									{ago(row.lastActiveAt)}
								</td>
								<td className="p-4 text-xs font-semibold text-slate-600">
									{day(row.createdAt)}
								</td>
								<td className="p-4">
									<AccountActions row={row} />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<MobileModal
				open={selected !== null}
				onClose={() => setSelected(null)}
				title={selected?.name ?? "Unnamed"}
				description={selected?.email}
			>
				{selected ? (
					<div className="grid gap-4 pb-2">
						<div>
							<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								Restaurants &amp; billing
							</p>
							<div className="mt-1">
								<RestaurantLines row={selected} />
							</div>
						</div>
						<div className="grid grid-cols-2 gap-3 text-xs">
							<div>
								<p className="font-bold uppercase tracking-wide text-slate-500">
									Onboarding
								</p>
								<p className="mt-0.5 font-bold text-slate-800">
									{ONBOARDING_LABEL[selected.onboardingStatus] ??
										selected.onboardingStatus}
								</p>
							</div>
							<div>
								<p className="font-bold uppercase tracking-wide text-slate-500">
									Account
								</p>
								<div className="mt-0.5">
									<AccountStatus row={selected} />
								</div>
							</div>
							<div>
								<p className="font-bold uppercase tracking-wide text-slate-500">
									Last active
								</p>
								<p className="mt-0.5 font-bold text-slate-800">
									{ago(selected.lastActiveAt)}
								</p>
							</div>
							<div>
								<p className="font-bold uppercase tracking-wide text-slate-500">
									Joined
								</p>
								<p className="mt-0.5 font-bold text-slate-800">
									{day(selected.createdAt)}
								</p>
							</div>
						</div>
						{!selected.accountActive && selected.accountSuspensionReason ? (
							<p className="rounded-xl bg-red-50 p-3 text-xs font-medium text-red-800">
								<span className="font-black">Suspension reason:</span>{" "}
								{selected.accountSuspensionReason}
							</p>
						) : null}
						<Issues row={selected} />
						<AccountActionList row={selected} />
					</div>
				) : null}
			</MobileModal>
		</>
	);
}
