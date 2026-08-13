"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
	requestPasswordResetOtpAction,
	resetPasswordWithTokenAction,
	verifyPasswordResetOtpAction,
} from "@/actions/auth.actions";
import { MarketingBottomNav } from "@/components/marketing/MarketingBottomNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { LoadingButton } from "@/components/ui/action-button";
import { PasswordInput } from "@/components/ui/password-input";

const inputClassName =
	"h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";
const labelClassName = "grid gap-2 text-sm font-bold text-slate-700";
const buttonClassName =
	"h-11 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-800 disabled:opacity-60";

export default function ForgotPasswordPage() {
	const router = useRouter();
	const [step, setStep] = useState<"email" | "otp" | "new_password">("email");
	const [email, setEmail] = useState("");
	const [resetToken, setResetToken] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	// Handlers for each step
	function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		const enteredEmail = String(formData.get("email") ?? "");

		startTransition(async () => {
			setError(null);
			try {
				await requestPasswordResetOtpAction(formData);
				setEmail(enteredEmail);
				setStep("otp");
			} catch (err) {
				setError(err instanceof Error ? err.message : "An error occurred.");
			}
		});
	}

	function handleOtpSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		formData.set("email", email); // inject email

		startTransition(async () => {
			setError(null);
			try {
				const res = await verifyPasswordResetOtpAction(formData);
				if ("error" in res) throw new Error(res.error);
				setResetToken(res.resetToken);
				setStep("new_password");
			} catch (err) {
				setError(err instanceof Error ? err.message : "Invalid code.");
			}
		});
	}

	function handleNewPasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const formData = new FormData(event.currentTarget);
		formData.set("email", email);
		formData.set("resetToken", resetToken);

		const password = String(formData.get("newPassword") ?? "");
		const confirm = String(formData.get("confirmPassword") ?? "");

		if (password !== confirm) {
			setError("Passwords do not match.");
			return;
		}

		startTransition(async () => {
			setError(null);
			try {
				const result = await resetPasswordWithTokenAction(formData);
				if (result && "error" in result) throw new Error(result.error);
				router.push("/login?reset=success");
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to reset password.",
				);
			}
		});
	}

	return (
		<>
			<main className="min-h-screen bg-[#f6faf7] pb-24 md:pb-8">
				<MarketingHeader variant="light" />
				<div className="mx-auto flex max-w-md items-center px-4 py-8 sm:py-12">
					<section className="w-full rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-8">
						<div className="mb-6 h-1.5 w-16 rounded-full bg-yellow-400" />
						<div className="mb-6">
							<p className="text-xs font-black uppercase tracking-widest text-emerald-700">
								AwaMenu
							</p>
							<h1 className="mt-2 text-2xl font-black text-slate-950">
								{step === "email" && "Reset Password"}
								{step === "otp" && "Enter Verification Code"}
								{step === "new_password" && "Set New Password"}
							</h1>
							{step === "email" && (
								<p className="mt-2 text-sm font-medium text-slate-600">
									Enter your email address to receive a 6-character reset code.
								</p>
							)}
							{step === "otp" && (
								<p className="mt-2 text-sm font-medium text-slate-600">
									We sent a code to{" "}
									<span className="font-black text-slate-950">{email}</span>.
								</p>
							)}
							{step === "new_password" && (
								<p className="mt-2 text-sm font-medium text-slate-600">
									Almost there! Enter your new password below.
								</p>
							)}
						</div>

						{/* STEP 1: EMAIL */}
						{step === "email" && (
							<form className="grid gap-4" onSubmit={handleEmailSubmit}>
								<label className={labelClassName}>
									Email
									<input
										name="email"
										type="email"
										required
										className={inputClassName}
										autoComplete="email"
									/>
								</label>

								{error ? (
									<p className="text-sm font-bold text-red-600">{error}</p>
								) : null}

								<LoadingButton
									type="submit"
									loading={isPending}
									loadingText="Sending Code..."
									className={buttonClassName}
								>
									Send Reset Code
								</LoadingButton>
							</form>
						)}

						{/* STEP 2: OTP */}
						{step === "otp" && (
							<form className="grid gap-4" onSubmit={handleOtpSubmit}>
								<label className={labelClassName}>
									6-Character Code
									<input
										name="otp"
										type="text"
										required
										maxLength={6}
										className={`${inputClassName} text-center font-mono text-lg uppercase tracking-[0.5em]`}
										autoComplete="off"
									/>
								</label>

								{error ? (
									<p className="text-sm font-bold text-red-600">{error}</p>
								) : null}

								<LoadingButton
									type="submit"
									loading={isPending}
									loadingText="Verifying..."
									className={buttonClassName}
								>
									Verify Code
								</LoadingButton>

								<button
									type="button"
									onClick={() => setStep("email")}
									className="mt-2 text-sm font-bold text-emerald-700 hover:underline"
									disabled={isPending}
								>
									Change email address
								</button>
							</form>
						)}

						{/* STEP 3: NEW PASSWORD */}
						{step === "new_password" && (
							<form className="grid gap-4" onSubmit={handleNewPasswordSubmit}>
								<label htmlFor="new-password" className={labelClassName}>
									New Password
									<PasswordInput
										id="new-password"
										name="newPassword"
										required
										minLength={8}
										className={inputClassName}
									/>
								</label>
								<label
									htmlFor="confirm-new-password"
									className={labelClassName}
								>
									Confirm New Password
									<PasswordInput
										id="confirm-new-password"
										name="confirmPassword"
										required
										minLength={8}
										className={inputClassName}
									/>
								</label>

								{error ? (
									<p className="text-sm font-bold text-red-600">{error}</p>
								) : null}

								<LoadingButton
									type="submit"
									loading={isPending}
									loadingText="Resetting..."
									className={buttonClassName}
								>
									Update Password
								</LoadingButton>
							</form>
						)}

						<div className="mt-8 border-t border-slate-100 pt-5">
							<p className="text-sm font-medium text-slate-600">
								Remember your password?{" "}
								<Link
									href="/login"
									className="font-black text-emerald-700 underline"
								>
									Back to login
								</Link>
							</p>
						</div>
					</section>
				</div>
			</main>
			<MarketingFooter />
			<MarketingBottomNav />
		</>
	);
}
