"use client";

import { Check, LoaderCircle } from "lucide-react";
import type * as React from "react";
import { useContext, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ActionFormStatusContext } from "@/components/ui/action-form";
import { cn } from "@/lib/utils";

type LoadingContentProps = {
	isLoading: boolean;
	isSuccess: boolean;
	children: React.ReactNode;
	loadingText?: React.ReactNode;
	successText?: React.ReactNode;
};

type SubmitButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
	loadingText?: React.ReactNode;
	successText?: React.ReactNode;
	successDuration?: number;
	onSuccess?: () => void;
};

type LoadingButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
	loading?: boolean;
	success?: boolean;
	loadingText?: React.ReactNode;
	successText?: React.ReactNode;
};

function LoadingContent({
	isLoading,
	isSuccess,
	children,
	loadingText = "Processing...",
	successText = "Done",
}: LoadingContentProps) {
	if (isLoading) {
		return (
			<span className="inline-flex h-full min-h-4 w-full min-w-4 items-center justify-center">
				<LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
				<span className="sr-only">{loadingText}</span>
			</span>
		);
	}

	if (isSuccess) {
		return (
			<span className="inline-flex h-full min-h-4 w-full min-w-4 items-center justify-center">
				<Check className="size-4" aria-hidden="true" />
				<span className="sr-only">{successText}</span>
			</span>
		);
	}

	return children;
}

export function SubmitButton({
	children,
	className,
	disabled,
	loadingText,
	successText,
	successDuration = 900,
	onSuccess,
	...props
}: SubmitButtonProps) {
	// Inside ActionForm/ConfirmForm the form's own status is used: it knows
	// whether the server accepted the change, and useFormStatus can report
	// "done" before the server has answered (see ActionFormStatusContext). A
	// plain <form> has only useFormStatus, and finishing is all it can go on.
	const formStatus = useContext(ActionFormStatusContext);
	const nativeStatus = useFormStatus();
	const pending = formStatus ? formStatus.pending : nativeStatus.pending;
	const refused = formStatus?.result === "error";
	const [isSuccess, setIsSuccess] = useState(false);
	const wasPending = useRef(false);
	const buttonRef = useRef<HTMLButtonElement>(null);

	// Held in a ref so it can't drive the effect below. Call sites pass inline
	// arrows (`onSuccess={() => setOpen(false)}`), which are a new identity on
	// every render — as a dependency that re-ran the effect, and the cleanup
	// cancelled the timer that clears the success state. The button then stayed
	// stuck on the tick, permanently disabled, so a second save was impossible.
	const onSuccessRef = useRef(onSuccess);
	useEffect(() => {
		onSuccessRef.current = onSuccess;
	});

	useEffect(() => {
		if (pending) {
			wasPending.current = true;
			setIsSuccess(false);
			return;
		}

		if (!wasPending.current) return;

		wasPending.current = false;
		// The server refused: the form shows why, so no tick and no onSuccess
		// (which would usually close the dialog and hide the message).
		if (refused) return;
		setIsSuccess(true);
		onSuccessRef.current?.();
		const timeout = window.setTimeout(
			() => setIsSuccess(false),
			successDuration,
		);
		return () => window.clearTimeout(timeout);
	}, [pending, successDuration, refused]);

	// Editing anything in the form clears the tick immediately, rather than
	// waiting on the timer. The timer is a nicety; this is the guarantee — if it
	// were ever cancelled or missed, the button would otherwise sit on "saved"
	// while the user has unsaved changes in front of them.
	useEffect(() => {
		if (!isSuccess) return;
		const form = buttonRef.current?.form;
		if (!form) return;

		const clear = () => setIsSuccess(false);
		form.addEventListener("input", clear);
		form.addEventListener("change", clear);
		return () => {
			form.removeEventListener("input", clear);
			form.removeEventListener("change", clear);
		};
	}, [isSuccess]);

	return (
		<button
			{...props}
			ref={buttonRef}
			type={props.type ?? "submit"}
			aria-busy={pending}
			// Deliberately NOT disabled on success. The tick is feedback, not a
			// lock: a stuck success state must never be able to cost someone the
			// ability to save. Only a genuinely in-flight submit blocks a click.
			disabled={disabled || pending}
			className={cn(
				"disabled:pointer-events-none disabled:opacity-60",
				className,
				(pending || isSuccess) && "!inline-flex items-center justify-center",
			)}
		>
			<LoadingContent
				isLoading={pending}
				isSuccess={isSuccess}
				loadingText={loadingText}
				successText={successText}
			>
				{children}
			</LoadingContent>
		</button>
	);
}

export function LoadingButton({
	children,
	className,
	disabled,
	loading = false,
	success = false,
	loadingText,
	successText,
	...props
}: LoadingButtonProps) {
	return (
		<button
			{...props}
			aria-busy={loading}
			// Consistent with the other two: success shows a tick, it doesn't lock
			// the button. Callers that genuinely need it locked pass `disabled`.
			disabled={disabled || loading}
			className={cn(
				"disabled:pointer-events-none disabled:opacity-60",
				className,
				(loading || success) && "!inline-flex items-center justify-center",
			)}
		>
			<LoadingContent
				isLoading={loading}
				isSuccess={success}
				loadingText={loadingText}
				successText={successText}
			>
				{children}
			</LoadingContent>
		</button>
	);
}
