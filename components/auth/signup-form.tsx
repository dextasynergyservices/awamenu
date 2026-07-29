"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { verifyTurnstileAction } from "@/actions/turnstile.actions";
import { TurnstileWidget } from "@/components/shared/TurnstileWidget";
import { LoadingButton } from "@/components/ui/action-button";
import { authClient } from "@/lib/auth-client";

export function SignupForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [error, setError] = useState<string | null>(null);
	const [isSuccess, setIsSuccess] = useState(false);
	const [isPending, startTransition] = useTransition();
	const selectedPlan = searchParams.get("plan");
	const turnstileTokenRef = useRef("");

	return (
		<form
			className="grid gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				const formData = new FormData(event.currentTarget);
				const name = String(formData.get("name") ?? "");
				const email = String(formData.get("email") ?? "");
				const password = String(formData.get("password") ?? "");
				const query = selectedPlan ? `?plan=${selectedPlan}` : "";

				startTransition(async () => {
					setError(null);
					setIsSuccess(false);

					const { success } = await verifyTurnstileAction(
						turnstileTokenRef.current,
					);
					if (!success) {
						setError("Verification failed. Please try again.");
						return;
					}

					const result = await authClient.signUp.email({
						name,
						email,
						password,
						callbackURL: `/onboarding/choose-plan${query}`,
					});

					if (result.error) {
						setError(result.error.message ?? "Unable to create account.");
						return;
					}

					setIsSuccess(true);
					router.push(`/onboarding/choose-plan${query}`);
					router.refresh();
				});
			}}
		>
			<label className="grid gap-2 text-sm font-bold text-slate-700">
				Name
				<input
					name="name"
					required
					className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
					autoComplete="name"
				/>
			</label>
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
				Password
				<input
					name="password"
					type="password"
					required
					minLength={8}
					className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
					autoComplete="new-password"
				/>
			</label>
			<TurnstileWidget
				onToken={(token) => {
					turnstileTokenRef.current = token;
				}}
			/>
			{error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
			<LoadingButton
				type="submit"
				loading={isPending}
				success={isSuccess}
				loadingText="Creating..."
				successText="Created"
				className="h-11 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
			>
				Create Account
			</LoadingButton>
		</form>
	);
}
