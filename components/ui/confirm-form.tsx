"use client";

import type * as React from "react";

type ConfirmFormProps = {
	action: (formData: FormData) => void | Promise<void>;
	confirmMessage: string;
	hiddenFields: Record<string, string>;
	children: React.ReactNode;
	className?: string;
};

export function ConfirmForm({
	action,
	confirmMessage,
	hiddenFields,
	children,
	className,
}: ConfirmFormProps) {
	return (
		<form
			action={action}
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
		</form>
	);
}
