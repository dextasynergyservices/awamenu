"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
	getEmailVerificationStateAction,
	resumeEmailVerificationAction,
} from "@/actions/email-verification.actions";
import { LoadingButton } from "@/components/ui/action-button";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";

type PostLoginRedirect =
	| { suspended: false; path: string }
	| { suspended: true; reason: string };

function suspensionMessage(reason: string) {
	return reason
		? `Your account has been suspended. Reason: ${reason}`
		: "Your account has been suspended.";
}

const WRONG_CREDENTIALS =
	"That email and password don't match. Check for typos (and that it's the email you signed up with), or reset your password.";

/**
 * Plain-language sign-in errors. A plan that has run out never blocks sign-in
 * (the dashboard opens read-only), so these are only about the credentials or
 * too many attempts.
 */
function signInErrorMessage(error: {
	status?: number;
	code?: string;
	message?: string;
}) {
	if (error.status === 429) {
		return "Too many sign-in attempts. Please wait a minute and try again.";
	}
	if (error.code === "INVALID_EMAIL_OR_PASSWORD" || error.status === 401) {
		return WRONG_CREDENTIALS;
	}
	return error.message ?? "Unable to sign in. Please try again.";
}

export function LoginForm() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [isSuccess, setIsSuccess] = useState(false);
	const [isPending, startTransition] = useTransition();

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get("suspended") === "1") {
			setError(suspensionMessage(params.get("reason") ?? ""));
		}
	}, []);

	return (
		<form
			className="grid gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				const formData = new FormData(event.currentTarget);
				const email = String(formData.get("email") ?? "");
				const password = String(formData.get("password") ?? "");

				startTransition(async () => {
					setError(null);
					setIsSuccess(false);
					const result = await authClient.signIn.email({
						email,
						password,
					});

					if (result.error) {
						// Someone who closed the tab mid-signup has a real account
						// with a real password — the only thing missing is the code.
						// Dropping them back into verification is the difference
						// between finishing signup and giving up.
						const state = await getEmailVerificationStateAction(email);
						if (state.exists && !state.verified) {
							const resume = new FormData();
							resume.set("email", email);
							await resumeEmailVerificationAction(resume);
							window.location.href = `/verify-email/code?email=${encodeURIComponent(email)}&resumed=1`;
							return;
						}
						setError(signInErrorMessage(result.error));
						return;
					}

					const redirectResponse = await fetch("/api/auth/post-login-redirect");
					const data = (await redirectResponse.json()) as PostLoginRedirect;

					if (data.suspended) {
						await authClient.signOut();
						setError(suspensionMessage(data.reason));
						return;
					}

					setIsSuccess(true);
					router.push(data.path);
					router.refresh();
				});
			}}
		>
			<label className="grid gap-2 text-sm font-bold text-slate-700">
				Email
				<input
					name="email"
					type="email"
					required
					className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
					autoComplete="email"
				/>
			</label>
			<label
				htmlFor="login-password"
				className="grid gap-2 text-sm font-bold text-slate-700"
			>
				<div className="flex items-center justify-between">
					<span>Password</span>
					<a
						href="/forgot-password"
						className="text-xs font-bold text-emerald-700 hover:underline"
					>
						Forgot your password?
					</a>
				</div>
				<PasswordInput
					id="login-password"
					name="password"
					required
					className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
					autoComplete="current-password"
				/>
			</label>
			{error ? (
				<div role="alert" className="grid gap-1 rounded-xl bg-red-50 px-3 py-2">
					<p className="text-sm font-bold text-red-700">{error}</p>
					{error === WRONG_CREDENTIALS ? (
						<Link
							href="/forgot-password"
							className="text-sm font-black text-emerald-700 underline"
						>
							Reset your password
						</Link>
					) : null}
				</div>
			) : null}
			<LoadingButton
				type="submit"
				loading={isPending}
				success={isSuccess}
				loadingText="Signing in..."
				successText="Signed in"
				className="h-11 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
			>
				Sign In
			</LoadingButton>
		</form>
	);
}
