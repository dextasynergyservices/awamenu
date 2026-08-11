"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import type { ActionResponse } from "@/lib/action-error";

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
 * handler, so `useFormStatus` keeps working and the SubmitButton inside still
 * shows its spinner.
 */
export function ActionForm({ action, onSuccess, children, ...props }: Props) {
	const [error, setError] = useState<string | null>(null);

	return (
		<form
			{...props}
			action={async (formData) => {
				setError(null);
				const result = await action(formData);
				if (result && "error" in result) {
					setError(result.error);
					return;
				}
				onSuccess?.();
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
	);
}
