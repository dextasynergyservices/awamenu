"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
	resendVerificationEmailAction,
	verifyEmailWithCodeAction,
} from "@/actions/email-verification.actions";
import { OtpCodeInput } from "@/components/auth/OtpCodeInput";
import { LoadingButton } from "@/components/ui/action-button";

const RESEND_COOLDOWN_SECONDS = 60;

function continueUrl(plan?: string, billing?: string) {
	const params = new URLSearchParams();
	if (plan) params.set("plan", plan);
	if (billing) params.set("billing", billing);
	return `/onboarding/choose-plan${params.toString() ? `?${params.toString()}` : ""}`;
}

export function VerifyEmailCodeForm({
	initialEmail,
	plan,
	billing,
}: {
	initialEmail: string;
	plan?: string;
	billing?: string;
}) {
	const [email] = useState(initialEmail);
	const [error, setError] = useState<string | null>(null);
	const [resendMessage, setResendMessage] = useState<string | null>(null);
	const [cooldown, setCooldown] = useState(0);
	const [isPending, startTransition] = useTransition();
	const [isResending, startResendTransition] = useTransition();
	const formRef = useRef<HTMLFormElement>(null);

	useEffect(() => {
		if (cooldown <= 0) return;
		const timer = window.setInterval(() => {
			setCooldown((s) => Math.max(0, s - 1));
		}, 1000);
		return () => window.clearInterval(timer);
	}, [cooldown]);

	function submitCode(code: string) {
		startTransition(async () => {
			setError(null);
			setResendMessage(null);
			const formData = new FormData();
			formData.set("email", email);
			formData.set("code", code);

			try {
				const result = await verifyEmailWithCodeAction(formData);
				if (result && "error" in result) throw new Error(result.error);
				// A full navigation, not router.push — the client-side transition
				// was completing the fetch (visible in server logs) without the
				// browser actually swapping the displayed page. A hard navigation
				// can't have that failure mode.
				window.location.href = continueUrl(plan, billing);
			} catch (err) {
				setError(
					err instanceof Error ? err.message : "Invalid verification code.",
				);
			}
		});
	}

	function handleResend() {
		startResendTransition(async () => {
			setError(null);
			setResendMessage(null);
			const formData = new FormData();
			formData.set("email", email);
			if (plan) formData.set("plan", plan);
			if (billing) formData.set("billing", billing);

			try {
				const result = await resendVerificationEmailAction(formData);
				if (result && "error" in result) throw new Error(result.error);
				setResendMessage("A new code has been sent to your email.");
				setCooldown(RESEND_COOLDOWN_SECONDS);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Unable to resend.");
			}
		});
	}

	return (
		<form
			ref={formRef}
			className="grid gap-5"
			onSubmit={(event) => event.preventDefault()}
		>
			<OtpCodeInput name="code" disabled={isPending} onComplete={submitCode} />

			{error ? (
				<p className="text-center text-sm font-bold text-red-600">{error}</p>
			) : null}
			{resendMessage ? (
				<p className="text-center text-sm font-bold text-emerald-700">
					{resendMessage}
				</p>
			) : null}

			<LoadingButton
				type="button"
				onClick={() => {
					const code = formRef.current
						? new FormData(formRef.current).get("code")
						: null;
					if (typeof code === "string" && code.length === 6) submitCode(code);
				}}
				loading={isPending}
				loadingText="Verifying..."
				className="h-11 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-800 disabled:opacity-60"
			>
				Verify Email
			</LoadingButton>

			<button
				type="button"
				onClick={handleResend}
				disabled={isResending || isPending || cooldown > 0}
				className="text-sm font-bold text-emerald-700 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
			>
				{isResending
					? "Resending..."
					: cooldown > 0
						? `Resend code in ${cooldown}s`
						: "Resend code"}
			</button>
		</form>
	);
}
