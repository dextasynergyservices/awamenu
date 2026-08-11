"use client";

import { Lock } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { updateAdminPasswordAction } from "@/actions/auth.actions";
import { SettingsCard } from "@/components/admin/SettingsCard";
import { LoadingButton } from "@/components/ui/action-button";

export function AdminAccountSettings() {
	const [error, setError] = useState<string | null>(null);
	const [isSuccess, setIsSuccess] = useState(false);
	const [isPending, startTransition] = useTransition();

	// The button is disabled while `isSuccess` is true. Without this it only
	// cleared on the *next* submit — which the user couldn't reach, because the
	// button was still disabled. Clearing it on a timer returns the form to a
	// usable state.
	useEffect(() => {
		if (!isSuccess) return;
		const timeout = window.setTimeout(() => setIsSuccess(false), 2000);
		return () => window.clearTimeout(timeout);
	}, [isSuccess]);

	function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);

		const newPassword = String(formData.get("newPassword") ?? "");
		const confirmPassword = String(formData.get("confirmPassword") ?? "");

		if (newPassword !== confirmPassword) {
			setError("New passwords do not match.");
			return;
		}

		startTransition(async () => {
			setError(null);
			setIsSuccess(false);
			try {
				const result = await updateAdminPasswordAction(formData);
				if (result && "error" in result) throw new Error(result.error);
				setIsSuccess(true);
				(event.target as HTMLFormElement).reset();
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to update password.",
				);
			}
		});
	}

	return (
		<SettingsCard
			title="Admin Account Security"
			description="Update your personal login password."
			icon={Lock}
		>
			<form onSubmit={handleSubmit} className="grid gap-6">
				<div>
					<label
						htmlFor="currentPassword"
						className="mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500"
					>
						Current Password
					</label>
					<input
						type="password"
						id="currentPassword"
						name="currentPassword"
						required
						className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base md:text-[13px] font-medium text-slate-950 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
					/>
				</div>

				<div className="grid gap-6 sm:grid-cols-2">
					<div>
						<label
							htmlFor="newPassword"
							className="mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500"
						>
							New Password
						</label>
						<input
							type="password"
							id="newPassword"
							name="newPassword"
							required
							minLength={8}
							className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base md:text-[13px] font-medium text-slate-950 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
						/>
					</div>
					<div>
						<label
							htmlFor="confirmPassword"
							className="mb-1 block text-xs md:text-[11px] font-bold uppercase tracking-wide text-slate-500"
						>
							Confirm New Password
						</label>
						<input
							type="password"
							id="confirmPassword"
							name="confirmPassword"
							required
							minLength={8}
							className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-base md:text-[13px] font-medium text-slate-950 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
						/>
					</div>
				</div>

				{error && <p className="text-sm font-medium text-red-600">{error}</p>}

				<LoadingButton
					type="submit"
					loading={isPending}
					success={isSuccess}
					loadingText="Updating..."
					successText="Password Updated"
					className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg bg-purple-700 px-4 text-xs md:text-[13px] font-bold text-white hover:bg-purple-800 sm:w-auto sm:justify-self-end"
				>
					Update Password
				</LoadingButton>
			</form>
		</SettingsCard>
	);
}
