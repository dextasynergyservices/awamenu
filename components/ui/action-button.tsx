"use client";

import { Check, LoaderCircle } from "lucide-react";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
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

type FormSubmitButtonProps = SubmitButtonProps & {
	loadingDuration?: number;
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
	const { pending } = useFormStatus();
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
		setIsSuccess(true);
		onSuccessRef.current?.();
		const timeout = window.setTimeout(
			() => setIsSuccess(false),
			successDuration,
		);
		return () => window.clearTimeout(timeout);
	}, [pending, successDuration]);

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

export function FormSubmitButton({
	children,
	className,
	disabled,
	loadingText,
	successText,
	successDuration = 900,
	loadingDuration = 1800,
	onClick,
	...props
}: FormSubmitButtonProps) {
	const [isLoading, setIsLoading] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);
	const buttonRef = useRef<HTMLButtonElement>(null);

	// Each timer is owned by the state that starts it. Previously both were
	// created in one effect keyed on `isLoading`: when loading finished, that
	// effect's cleanup ran and cancelled the *success* timer before it could
	// fire, so the button stayed on the tick and disabled forever — one save
	// per page load.
	useEffect(() => {
		if (!isLoading) return;

		const timeout = window.setTimeout(() => {
			setIsLoading(false);
			setIsSuccess(true);
		}, loadingDuration);

		return () => window.clearTimeout(timeout);
	}, [isLoading, loadingDuration]);

	useEffect(() => {
		if (!isSuccess) return;

		const timeout = window.setTimeout(
			() => setIsSuccess(false),
			successDuration,
		);
		return () => window.clearTimeout(timeout);
	}, [isSuccess, successDuration]);

	// See SubmitButton: any edit clears the tick, so a missed timer can't leave
	// the button claiming "saved" over unsaved changes.
	useEffect(() => {
		if (!isSuccess) return;
		const form = props.form
			? document.getElementById(props.form)
			: buttonRef.current?.form;
		if (!(form instanceof HTMLFormElement)) return;

		const clear = () => setIsSuccess(false);
		form.addEventListener("input", clear);
		form.addEventListener("change", clear);
		return () => {
			form.removeEventListener("input", clear);
			form.removeEventListener("change", clear);
		};
	}, [isSuccess, props.form]);

	return (
		<button
			{...props}
			ref={buttonRef}
			type={props.type ?? "submit"}
			aria-busy={isLoading}
			// Not disabled on success — see SubmitButton.
			disabled={disabled || isLoading}
			onClick={(event) => {
				onClick?.(event);
				if (event.defaultPrevented || disabled) return;

				const form = props.form
					? document.getElementById(props.form)
					: event.currentTarget.form;
				if (form instanceof HTMLFormElement && !form.checkValidity()) return;

				setIsSuccess(false);
				setIsLoading(true);
			}}
			className={cn(
				"disabled:pointer-events-none disabled:opacity-60",
				className,
				(isLoading || isSuccess) && "!inline-flex items-center justify-center",
			)}
		>
			<LoadingContent
				isLoading={isLoading}
				isSuccess={isSuccess}
				loadingText={loadingText}
				successText={successText}
			>
				{children}
			</LoadingContent>
		</button>
	);
}
