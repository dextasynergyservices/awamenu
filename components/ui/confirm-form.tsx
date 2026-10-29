"use client";

import { AlertTriangle } from "lucide-react";
import type * as React from "react";
import { useRef, useState } from "react";
import {
	ActionFormStatusContext,
	useActionFormStatus,
} from "@/components/ui/action-form";
import {
	ConfirmDialog,
	type ConfirmTone,
	splitConfirm,
} from "@/components/ui/confirm-dialog";
import type { ActionResponse } from "@/lib/action-error";

type ConfirmFormProps = {
	/** May return `{ error }` (see lib/action-error.ts); it is shown inline. */
	action: (
		formData: FormData,
	) => void | Promise<void> | Promise<ActionResponse | undefined>;
	/** "Question? Explanation." — the question becomes the dialog title. */
	confirmMessage: string;
	/** Defaults to the text of the button that submitted the form. */
	confirmLabel?: string;
	cancelLabel?: string;
	tone?: ConfirmTone;
	hiddenFields: Record<string, string>;
	children: React.ReactNode;
	className?: string;
};

/**
 * A form that asks "are you sure?" in a dialog before submitting, and shows
 * the server's answer if it refuses ("Cannot delete a plan with active
 * subscriptions…").
 *
 * The real submit happens only after confirming, so submit buttons inside
 * (SubmitButton's pending state, a submitter's name/value) behave as usual.
 */
export function ConfirmForm({
	action,
	confirmMessage,
	confirmLabel,
	cancelLabel,
	tone = "danger",
	hiddenFields,
	children,
	className,
}: ConfirmFormProps) {
	const [error, setError] = useState<string | null>(null);
	const [asking, setAsking] = useState(false);
	const [label, setLabel] = useState(confirmLabel ?? "Confirm");
	const formRef = useRef<HTMLFormElement>(null);
	const submitterRef = useRef<HTMLElement | null>(null);
	const confirmedRef = useRef(false);
	const { status, start, finish } = useActionFormStatus();
	const prompt = splitConfirm(confirmMessage);

	return (
		<form
			ref={formRef}
			action={async (formData) => {
				setError(null);
				try {
					const result = await action(formData);
					if (result && typeof result === "object" && "error" in result) {
						setError(result.error);
						finish(false);
						return;
					}
					finish(true);
				} catch (caught) {
					finish(false);
					throw caught;
				}
			}}
			className={className}
			onSubmit={(event) => {
				if (confirmedRef.current) {
					confirmedRef.current = false;
					start();
					return;
				}
				event.preventDefault();
				const submitter = (event.nativeEvent as SubmitEvent).submitter;
				submitterRef.current = submitter;
				setLabel(confirmLabel ?? (submitter?.textContent?.trim() || "Confirm"));
				setAsking(true);
			}}
		>
			<ActionFormStatusContext.Provider value={status}>
				{Object.entries(hiddenFields).map(([name, value]) => (
					<input key={name} type="hidden" name={name} value={value} />
				))}
				{children}
			</ActionFormStatusContext.Provider>
			{error ? (
				<p
					role="alert"
					className="mt-2 flex min-w-0 items-start gap-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-700"
				>
					<AlertTriangle
						className="mt-0.5 size-3.5 shrink-0"
						aria-hidden="true"
					/>
					<span className="min-w-0">{error}</span>
				</p>
			) : null}
			<ConfirmDialog
				open={asking}
				onOpenChange={setAsking}
				title={prompt.title}
				message={prompt.message}
				confirmLabel={label}
				cancelLabel={cancelLabel}
				tone={tone}
				onConfirm={() => {
					setAsking(false);
					confirmedRef.current = true;
					const submitter = submitterRef.current;
					formRef.current?.requestSubmit(
						submitter && formRef.current.contains(submitter)
							? (submitter as HTMLButtonElement)
							: undefined,
					);
				}}
			/>
		</form>
	);
}
