"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LoadingButton } from "@/components/ui/action-button";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [isSuccess, setIsSuccess] = useState(false);
	const [isPending, startTransition] = useTransition();

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
						callbackURL: "/onboarding/choose-plan",
					});

					if (result.error) {
						setError(result.error.message ?? "Unable to sign in.");
						return;
					}

					setIsSuccess(true);
					router.push("/onboarding/choose-plan");
					router.refresh();
				});
			}}
		>
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
			<label className="grid gap-2 text-sm font-medium text-zinc-800">
				Password
				<input
					name="password"
					type="password"
					required
					className="h-11 border border-zinc-300 px-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-yellow-300/60"
					autoComplete="current-password"
				/>
			</label>
			{error ? <p className="text-sm text-red-600">{error}</p> : null}
			<LoadingButton
				type="submit"
				loading={isPending}
				success={isSuccess}
				loadingText="Signing in..."
				successText="Signed in"
				className="h-11 bg-emerald-700 px-4 text-sm font-semibold uppercase tracking-widest text-white ring-offset-2 transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 disabled:opacity-60"
			>
				Sign In
			</LoadingButton>
		</form>
	);
}
