"use client";

import { Lock } from "lucide-react";
import { useState, useTransition } from "react";
import { updateAdminPasswordAction } from "@/actions/auth.actions";
import { LoadingButton } from "@/components/ui/action-button";

export function AdminAccountSettings() {
	const [error, setError] = useState<string | null>(null);
	const [isSuccess, setIsSuccess] = useState(false);
	const [isPending, startTransition] = useTransition();

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
				await updateAdminPasswordAction(formData);
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
		<div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
			<div className="border-b border-slate-100 bg-slate-50/50 p-6 sm:px-8">
				<div className="flex items-center gap-3">
					<div className="flex size-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
						<Lock className="size-5" />
					</div>
					<div>
						<h2 className="text-xl font-black text-slate-950">
							Admin Account Security
						</h2>
						<p className="mt-1 text-sm text-slate-500">
							Update your personal login password.
						</p>
					</div>
				</div>
			</div>

			<div className="p-6 sm:px-8">
				<form onSubmit={handleSubmit} className="grid gap-6">
					<div>
						<label
							htmlFor="currentPassword"
							className="block text-xs font-bold text-slate-700 mb-1.5"
						>
							Current Password
						</label>
						<input
							type="password"
							id="currentPassword"
							name="currentPassword"
							required
							className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-950 placeholder:text-slate-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none"
						/>
					</div>

					<div className="grid gap-6 sm:grid-cols-2">
						<div>
							<label
								htmlFor="newPassword"
								className="block text-xs font-bold text-slate-700 mb-1.5"
							>
								New Password
							</label>
							<input
								type="password"
								id="newPassword"
								name="newPassword"
								required
								minLength={8}
								className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-950 placeholder:text-slate-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none"
							/>
						</div>
						<div>
							<label
								htmlFor="confirmPassword"
								className="block text-xs font-bold text-slate-700 mb-1.5"
							>
								Confirm New Password
							</label>
							<input
								type="password"
								id="confirmPassword"
								name="confirmPassword"
								required
								minLength={8}
								className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-950 placeholder:text-slate-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none"
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
						className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-purple-700 px-5 text-sm font-black text-white sm:w-auto sm:justify-self-end hover:bg-purple-800"
					>
						Update Password
					</LoadingButton>
				</form>
			</div>
		</div>
	);
}
