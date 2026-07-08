"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
	requestPasswordResetOtpAction,
	resetPasswordWithTokenAction,
	verifyPasswordResetOtpAction,
} from "@/actions/auth.actions";
import { LoadingButton } from "@/components/ui/action-button";

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
				await resetPasswordWithTokenAction(formData);
				router.push("/login?reset=success");
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Failed to reset password.",
				);
			}
		});
	}

	return (
		<main className="flex min-h-screen items-center justify-center bg-white px-4 py-12">
			<section className="w-full max-w-md border border-emerald-800/20 bg-white p-6 shadow-[0_12px_40px_rgba(22,101,52,0.08)]">
				<div className="mb-6 h-1.5 w-16 bg-yellow-400" />
				<div className="mb-6">
					<p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
						AwaMenu
					</p>
					<h1 className="mt-2 text-2xl font-semibold text-zinc-950">
						{step === "email" && "Reset Password"}
						{step === "otp" && "Enter Verification Code"}
						{step === "new_password" && "Set New Password"}
					</h1>
					{step === "email" && (
						<p className="mt-2 text-sm text-zinc-600">
							Enter your email address to receive a 6-character reset code.
						</p>
					)}
					{step === "otp" && (
						<p className="mt-2 text-sm text-zinc-600">
							We sent a code to{" "}
							<span className="font-semibold text-zinc-900">{email}</span>.
						</p>
					)}
					{step === "new_password" && (
						<p className="mt-2 text-sm text-zinc-600">
							Almost there! Enter your new password below.
						</p>
					)}
				</div>

				{/* STEP 1: EMAIL */}
				{step === "email" && (
					<form className="grid gap-4" onSubmit={handleEmailSubmit}>
						<label className="grid gap-2 text-sm font-medium text-zinc-800">
							Email
							<input
								name="email"
								type="email"
								required
								className="h-11 border border-zinc-300 px-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-yellow-300/60"
								autoComplete="email"
							/>
						</label>

						{error ? <p className="text-sm text-red-600">{error}</p> : null}

						<LoadingButton
							type="submit"
							loading={isPending}
							loadingText="Sending Code..."
							className="h-11 bg-emerald-700 px-4 text-sm font-semibold uppercase tracking-widest text-white ring-offset-2 transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 disabled:opacity-60"
						>
							Send Reset Code
						</LoadingButton>
					</form>
				)}

				{/* STEP 2: OTP */}
				{step === "otp" && (
					<form className="grid gap-4" onSubmit={handleOtpSubmit}>
						<label className="grid gap-2 text-sm font-medium text-zinc-800">
							6-Character Code
							<input
								name="otp"
								type="text"
								required
								maxLength={6}
								className="h-11 border border-zinc-300 px-3 text-center text-lg font-mono tracking-[0.5em] outline-none focus:border-emerald-700 focus:ring-2 focus:ring-yellow-300/60 uppercase"
								autoComplete="off"
							/>
						</label>

						{error ? <p className="text-sm text-red-600">{error}</p> : null}

						<LoadingButton
							type="submit"
							loading={isPending}
							loadingText="Verifying..."
							className="h-11 bg-emerald-700 px-4 text-sm font-semibold uppercase tracking-widest text-white ring-offset-2 transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 disabled:opacity-60"
						>
							Verify Code
						</LoadingButton>

						<button
							type="button"
							onClick={() => setStep("email")}
							className="mt-2 text-sm font-medium text-emerald-700 hover:underline"
							disabled={isPending}
						>
							Change email address
						</button>
					</form>
				)}

				{/* STEP 3: NEW PASSWORD */}
				{step === "new_password" && (
					<form className="grid gap-4" onSubmit={handleNewPasswordSubmit}>
						<label className="grid gap-2 text-sm font-medium text-zinc-800">
							New Password
							<input
								name="newPassword"
								type="password"
								required
								minLength={8}
								className="h-11 border border-zinc-300 px-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-yellow-300/60"
							/>
						</label>
						<label className="grid gap-2 text-sm font-medium text-zinc-800">
							Confirm New Password
							<input
								name="confirmPassword"
								type="password"
								required
								minLength={8}
								className="h-11 border border-zinc-300 px-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-yellow-300/60"
							/>
						</label>

						{error ? <p className="text-sm text-red-600">{error}</p> : null}

						<LoadingButton
							type="submit"
							loading={isPending}
							loadingText="Resetting..."
							className="h-11 bg-emerald-700 px-4 text-sm font-semibold uppercase tracking-widest text-white ring-offset-2 transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 disabled:opacity-60"
						>
							Update Password
						</LoadingButton>
					</form>
				)}

				<div className="mt-8 border-t border-zinc-100 pt-5">
					<p className="text-sm text-zinc-600">
						Remember your password?{" "}
						<Link
							href="/login"
							className="font-medium text-emerald-700 underline"
						>
							Back to login
						</Link>
					</p>
				</div>
			</section>
		</main>
	);
}
