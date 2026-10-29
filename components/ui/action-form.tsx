"use client";

import { AlertTriangle } from "lucide-react";
import { createContext, useState } from "react";
import type { ActionResponse } from "@/lib/action-error";

export type ActionFormStatus = {
	pending: boolean;
	/** How the last submission ended; `null` before the first one finishes. */
	result: "ok" | "error" | null;
};

/**
 * The form's own record of its submission, read by SubmitButton.
 *
 * `useFormStatus` can't be trusted for this: with a conditional child in the
 * form (`{cond ? <x/> : null}`), React reports the form as done a few
 * milliseconds after submit while the server is still working. SubmitButton
 * then showed its tick and ran `onSuccess` (usually "close the dialog")
 * before the server answered, so a refused save closed the dialog, hid the
 * error, and looked exactly like a success.
 */
export const ActionFormStatusContext = createContext<ActionFormStatus | null>(
	null,
);

/** Submission state for a form whose action reports `{ error }`. */
export function useActionFormStatus() {
	const [status, setStatus] = useState<ActionFormStatus>({
		pending: false,
		result: null,
	});
	return {
		status,
		/** Call from onSubmit, once the submit is really going ahead. */
		start: () => setStatus((s) => ({ ...s, pending: true })),
		finish: (ok: boolean) =>
			setStatus({ pending: false, result: ok ? "ok" : "error" }),
	};
}

type Props = Omit<React.FormHTMLAttributes<HTMLFormElement>, "action"> & {
	action: (formData: FormData) => Promise<ActionResponse | undefined>;
	/** Runs only when the action reported success. */
	onSuccess?: () => void;
};

/**
 * A `<form>` that shows what the server actually said when something failed.
 *
 * Server actions return `{ error }` for rules a person is meant to read (see
 * lib/action-error.ts). A bare `<form action={someAction}>` throws that return
 * value away, so a failed save would look identical to a successful one. This
 * renders it instead.
 *
 * The action is still passed to `<form action>` rather than an `onSubmit`
 * handler, so native validation and progressive enhancement keep working.
 */
export function ActionForm({
	action,
	onSuccess,
	onSubmit,
	children,
	...props
}: Props) {
	const [error, setError] = useState<string | null>(null);
	const { status, start, finish } = useActionFormStatus();

	return (
		<ActionFormStatusContext.Provider value={status}>
			<form
				{...props}
				onSubmit={(event) => {
					onSubmit?.(event);
					if (!event.defaultPrevented) start();
				}}
				action={async (formData) => {
					setError(null);
					try {
						const result = await action(formData);
						if (result && "error" in result) {
							setError(result.error);
							finish(false);
							return;
						}
						finish(true);
						onSuccess?.();
					} catch (caught) {
						finish(false);
						throw caught;
					}
				}}
			>
				{children}
				{error ? (
					<p
						role="alert"
						className="mt-3 flex min-w-0 items-start gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700"
					>
						<AlertTriangle
							className="mt-0.5 size-4 shrink-0"
							aria-hidden="true"
						/>
						<span className="min-w-0">{error}</span>
					</p>
				) : null}
			</form>
		</ActionFormStatusContext.Provider>
	);
}
