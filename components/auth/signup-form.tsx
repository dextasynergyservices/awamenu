"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
	getEmailVerificationStateAction,
	resumeEmailVerificationAction,
	sendEmailVerificationAction,
} from "@/actions/email-verification.actions";
import { verifyTurnstileAction } from "@/actions/turnstile.actions";
import { TurnstileWidget } from "@/components/shared/TurnstileWidget";
import { LoadingButton } from "@/components/ui/action-button";
import { env } from "@/env";
import { authClient } from "@/lib/auth-client";

export function SignupForm() {
	const searchParams = useSearchParams();
	const [error, setError] = useState<string | null>(null);
	const [isSuccess, setIsSuccess] = useState(false);
	const [isPending, startTransition] = useTransition();
	const selectedPlan = searchParams.get("plan");
	const selectedBilling = searchParams.get("billing");
	const turnstileTokenRef = useRef("");
	// Starts "ready" when Turnstile isn't configured at all (matches
	// TurnstileWidget's own no-op behavior); otherwise stays false until its
	// async challenge actually completes, so submitting can't race an empty
	// token — that was silently failing signup with "Verification failed."
	const [turnstileReady, setTurnstileReady] = useState(
		!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
	);

	return (
		<form
			className="grid gap-4"
			onSubmit={(event) => {
				event.preventDefault();
				const formData = new FormData(event.currentTarget);
				const name = String(formData.get("name") ?? "");
				const email = String(formData.get("email") ?? "");
				const password = String(formData.get("password") ?? "");
				const nextParams = new URLSearchParams();
				if (selectedPlan) nextParams.set("plan", selectedPlan);
				if (selectedBilling) nextParams.set("billing", selectedBilling);
				const planQuery = nextParams.toString()
					? `&${nextParams.toString()}`
					: "";

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
					});

					if (result.error) {
						// "An account already exists" is a dead end when the account
						// is the user's own half-finished one. Send a fresh code and
						// carry on where they left off.
						const state = await getEmailVerificationStateAction(email);
						if (state.exists && !state.verified) {
							const resume = new FormData();
							resume.set("email", email);
							if (selectedPlan) resume.set("plan", selectedPlan);
							if (selectedBilling) resume.set("billing", selectedBilling);
							await resumeEmailVerificationAction(resume);
							window.location.href = `/verify-email/code?email=${encodeURIComponent(email)}${planQuery}&resumed=1`;
							return;
						}
						setError(result.error.message ?? "Unable to create account.");
						return;
					}

					const verifyFormData = new FormData();
					verifyFormData.set("email", email);
					if (selectedPlan) verifyFormData.set("plan", selectedPlan);
					if (selectedBilling) verifyFormData.set("billing", selectedBilling);
					// Awaited deliberately. Firing this without awaiting and then
					// navigating on the next line aborted the request: the browser
					// tears down in-flight fetches on navigation, so the very first
					// verification email frequently never went out. Worse, the
					// verification rows could commit before the abort, leaving a
					// code the user never received AND a 60-second cooldown that
					// blocked Resend — which is exactly what people hit.
					const sent = await sendEmailVerificationAction(verifyFormData);
					if ("error" in sent) {
						// The account exists, so this is recoverable on the next
						// screen. Say so rather than blocking here.
						setError(sent.error);
					}

					setIsSuccess(true);
					// A full navigation, not router.push — see VerifyEmailCodeForm
					// for why: the client-side transition can complete the fetch
					// without the browser visually swapping to the new page.
					window.location.href = `/verify-email/code?email=${encodeURIComponent(email)}${planQuery}`;
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
					setTurnstileReady(true);
				}}
			/>
			{error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}
			<LoadingButton
				type="submit"
				disabled={!turnstileReady}
				loading={isPending}
				success={isSuccess}
				loadingText="Creating..."
				successText="Created"
				className="h-11 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
			>
				{turnstileReady ? "Create Account" : "Verifying..."}
			</LoadingButton>
		</form>
	);
}
