"use client";

import { useState } from "react";
import {
	deleteUserAction,
	toggleUserActiveAction,
} from "@/actions/super-admin.actions";
import { SuspendUserButton } from "@/components/super-admin/SuspendUserButton";
import { SubmitButton } from "@/components/ui/action-button";
import { ConfirmForm } from "@/components/ui/confirm-form";
import { MobileModal } from "@/components/ui/MobileModal";

type UserRow = {
	id: string;
	name: string | null;
	email: string;
	isActive: boolean;
	suspensionReason: string | null;
	restaurantNames: string[];
};

function UserActions({ user }: { user: UserRow }) {
	return (
		<div className="flex flex-wrap gap-2">
			{user.isActive ? (
				<SuspendUserButton userId={user.id} userEmail={user.email} />
			) : (
				<form action={toggleUserActiveAction}>
					<input type="hidden" name="userId" value={user.id} />
					<input type="hidden" name="isActive" value="true" />
					<SubmitButton
						loadingText="Updating..."
						successText="Updated"
						className="inline-flex h-11 items-center justify-center rounded-lg bg-emerald-700 px-2.5 text-xs font-black text-white hover:bg-emerald-800"
					>
						Activate
					</SubmitButton>
				</form>
			)}
			<ConfirmForm
				action={deleteUserAction}
				hiddenFields={{ userId: user.id }}
				confirmMessage={`Delete ${user.email}? This cannot be undone.`}
			>
				<SubmitButton
					loadingText="Deleting..."
					successText="Deleted"
					disabled={user.restaurantNames.length > 0}
					title={
						user.restaurantNames.length > 0
							? "Cannot delete an owner with restaurants on the platform"
							: undefined
					}
					className="inline-flex h-11 items-center justify-center rounded-lg border border-red-100 px-2.5 text-xs font-black text-red-600 hover:bg-red-50 disabled:opacity-40"
				>
					Delete
				</SubmitButton>
			</ConfirmForm>
		</div>
	);
}

export function UsersTable({ users }: { users: UserRow[] }) {
	const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);

	if (users.length === 0) {
		return (
			<div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm font-medium text-slate-500">
				No restaurant owners found.
			</div>
		);
	}

	return (
		<>
			<div className="grid gap-2 md:hidden">
				{users.map((user) => (
					<button
						key={user.id}
						type="button"
						onClick={() => setSelectedUser(user)}
						className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white p-3 text-left"
					>
						<div className="min-w-0">
							<p className="truncate text-sm font-black text-slate-900">
								{user.name ?? "Unnamed"}
							</p>
							<p className="truncate text-xs font-medium text-slate-400">
								{user.email}
							</p>
						</div>
						<span
							className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${
								user.isActive
									? "bg-emerald-100 text-emerald-700"
									: "bg-red-100 text-red-700"
							}`}
						>
							{user.isActive ? "Active" : "Suspended"}
						</span>
					</button>
				))}
			</div>

			<div className="hidden overflow-x-auto rounded-2xl border border-slate-100 bg-white md:block">
				<table className="w-full min-w-[760px] text-left text-sm">
					<thead>
						<tr className="border-b border-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
							<th className="p-4">Name</th>
							<th className="p-4">Email</th>
							<th className="p-4">Restaurant</th>
							<th className="p-4">Status</th>
							<th className="p-4">Actions</th>
						</tr>
					</thead>
					<tbody>
						{users.map((user) => (
							<tr
								key={user.id}
								className="border-b border-slate-50 last:border-0"
							>
								<td className="p-4 font-black text-slate-900">
									{user.name ?? "Unnamed"}
								</td>
								<td className="p-4 font-medium text-slate-600">{user.email}</td>
								<td className="p-4 font-medium text-slate-600">
									{user.restaurantNames.length > 0
										? user.restaurantNames.join(", ")
										: "—"}
								</td>
								<td className="p-4">
									<span
										title={
											!user.isActive && user.suspensionReason
												? user.suspensionReason
												: undefined
										}
										className={`rounded-full px-2.5 py-1 text-xs font-black ${
											user.isActive
												? "bg-emerald-100 text-emerald-700"
												: "bg-red-100 text-red-700"
										}`}
									>
										{user.isActive ? "Active" : "Suspended"}
									</span>
								</td>
								<td className="p-4">
									<UserActions user={user} />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<MobileModal
				open={selectedUser !== null}
				onClose={() => setSelectedUser(null)}
				title={selectedUser?.name ?? "Unnamed"}
				description={selectedUser?.email}
			>
				{selectedUser ? (
					<div className="grid gap-3 pb-2">
						<div>
							<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								Restaurant
							</p>
							<p className="mt-0.5 text-sm font-semibold text-slate-700">
								{selectedUser.restaurantNames.length > 0
									? selectedUser.restaurantNames.join(", ")
									: "—"}
							</p>
						</div>
						<div>
							<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								Status
							</p>
							<span
								className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-black ${
									selectedUser.isActive
										? "bg-emerald-100 text-emerald-700"
										: "bg-red-100 text-red-700"
								}`}
							>
								{selectedUser.isActive ? "Active" : "Suspended"}
							</span>
						</div>
						{!selectedUser.isActive && selectedUser.suspensionReason ? (
							<div>
								<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
									Suspension Reason
								</p>
								<p className="mt-0.5 text-sm font-medium text-slate-700">
									{selectedUser.suspensionReason}
								</p>
							</div>
						) : null}
						<UserActions user={selectedUser} />
					</div>
				) : null}
			</MobileModal>
		</>
	);
}
