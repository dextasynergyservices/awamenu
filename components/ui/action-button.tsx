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

	useEffect(() => {
		if (pending) {
			wasPending.current = true;
			setIsSuccess(false);
			return;
		}

		if (!wasPending.current) return;

		wasPending.current = false;
		setIsSuccess(true);
		onSuccess?.();
		const timeout = window.setTimeout(
			() => setIsSuccess(false),
			successDuration,
		);
		return () => window.clearTimeout(timeout);
	}, [onSuccess, pending, successDuration]);

	return (
		<button
			{...props}
			type={props.type ?? "submit"}
			aria-busy={pending}
			disabled={disabled || pending || isSuccess}
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
			disabled={disabled || loading || success}
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

	useEffect(() => {
		if (!isLoading) return;

		const loadingTimeout = window.setTimeout(() => {
			setIsLoading(false);
			setIsSuccess(true);
		}, loadingDuration);
		const successTimeout = window.setTimeout(() => {
			setIsSuccess(false);
		}, loadingDuration + successDuration);

		return () => {
			window.clearTimeout(loadingTimeout);
			window.clearTimeout(successTimeout);
		};
	}, [isLoading, loadingDuration, successDuration]);

	return (
		<button
			{...props}
			type={props.type ?? "submit"}
			aria-busy={isLoading}
			disabled={disabled || isLoading || isSuccess}
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
