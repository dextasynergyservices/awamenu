"use client";

import { AlertTriangle } from "lucide-react";
import type * as React from "react";
import { useState } from "react";
import type { ActionResponse } from "@/lib/action-error";

type ConfirmFormProps = {
	/** May return `{ error }` (see lib/action-error.ts); it is shown inline. */
	action: (
		formData: FormData,
	) => void | Promise<void> | Promise<ActionResponse | undefined>;
	confirmMessage: string;
	hiddenFields: Record<string, string>;
	children: React.ReactNode;
	className?: string;
};

/**
 * A form that asks "are you sure?" before submitting, and shows the server's
 * answer if it refuses ("Cannot delete a plan with active subscriptions…").
 */
export function ConfirmForm({
	action,
	confirmMessage,
	hiddenFields,
	children,
	className,
}: ConfirmFormProps) {
	const [error, setError] = useState<string | null>(null);

	return (
		<form
			action={async (formData) => {
				setError(null);
				const result = await action(formData);
				if (result && typeof result === "object" && "error" in result) {
					setError(result.error);
				}
			}}
			className={className}
			onSubmit={(event) => {
				if (!window.confirm(confirmMessage)) {
					event.preventDefault();
				}
			}}
		>
			{Object.entries(hiddenFields).map(([name, value]) => (
				<input key={name} type="hidden" name={name} value={value} />
			))}
			{children}
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
		</form>
	);
}
