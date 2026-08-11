"use client";

import { AlertTriangle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import type { ActionResponse } from "@/lib/action-error";

type ReservationActionFormProps = {
	action: (formData: FormData) => Promise<ActionResponse | undefined>;
	children: React.ReactNode;
	className?: string;
	onSuccess?: () => void;
};

export function ReservationActionForm({
	action,
	children,
	className,
	onSuccess,
}: ReservationActionFormProps) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;

		if (!form.checkValidity()) {
			form.reportValidity();
			return;
		}

		setPending(true);
		setError(null);

		try {
			const result = await action(new FormData(form));
			if (result && "error" in result) throw new Error(result.error);
			onSuccess?.();
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setPending(false);
		}
	}

	return (
		<>
			<form
				onSubmit={handleSubmit}
				aria-busy={pending}
				data-pending={pending ? "true" : undefined}
				className={className}
			>
				<fieldset disabled={pending} className="contents">
					{children}
				</fieldset>
			</form>

			{error ? (
				<div className="fixed inset-0 z-160 grid place-items-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
					<section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
						<div className="flex items-start justify-between gap-4">
							<div className="flex items-start gap-3">
								<span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-700">
									<AlertTriangle className="size-5" aria-hidden="true" />
								</span>
								<div>
									<h2 className="text-base font-black text-slate-950">
										Action failed
									</h2>
									<p className="mt-2 text-sm font-bold leading-6 text-slate-700">
										{error}
									</p>
								</div>
							</div>
							<button
								type="button"
								onClick={() => setError(null)}
								className="grid size-8 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500"
								aria-label="Close error message"
							>
								<X className="size-4" aria-hidden="true" />
							</button>
						</div>

						<button
							type="button"
							onClick={() => setError(null)}
							className="mt-5 min-h-11 w-full rounded-xl bg-slate-950 px-4 text-sm font-black text-white"
						>
							Okay
						</button>
					</section>
				</div>
			) : null}
		</>
	);
}
