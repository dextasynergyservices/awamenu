"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { LoadingButton } from "@/components/ui/action-button";
import { authClient } from "@/lib/auth-client";

type PostLoginRedirect =
	| { suspended: false; path: string }
	| { suspended: true; reason: string };

function suspensionMessage(reason: string) {
	return reason
		? `Your account has been suspended. Reason: ${reason}`
		: "Your account has been suspended.";
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
						setError(result.error.message ?? "Unable to sign in.");
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
			<label className="grid gap-2 text-sm font-bold text-slate-700">
				<div className="flex items-center justify-between">
					<span>Password</span>
					<a
						href="/forgot-password"
						className="text-xs font-bold text-emerald-700 hover:underline"
					>
						Forgot your password?
					</a>
				</div>
				<input
					name="password"
					type="password"
					required
					className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
					autoComplete="current-password"
				/>
			</label>
			{error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
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
