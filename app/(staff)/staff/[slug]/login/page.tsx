"use client";

import { AlertTriangle, Lock } from "lucide-react";
import { use, useState, useTransition } from "react";
import { staffLoginAction } from "@/actions/staff.actions";

export default function StaffLoginPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = use(params);
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);

		const fd = new FormData();
		fd.set("slug", slug);
		fd.set("password", password);

		startTransition(async () => {
			try {
				await staffLoginAction(fd);
				// The action calls revalidatePath which redirects if successful
			} catch (err) {
				setError(err instanceof Error ? err.message : "Invalid password.");
				setPassword("");
			}
		});
	}

	return (
		<div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-4">
			<div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
				<div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
					<Lock className="size-8" />
				</div>
				<h1 className="mb-2 text-center text-2xl font-black text-slate-950">
					Staff Terminal
				</h1>
				<p className="mb-8 text-center text-sm font-medium text-slate-500">
					Enter the master password to access the staff dashboard for {slug}.
				</p>

				<form onSubmit={handleSubmit} className="grid gap-5">
					<div>
						<label
							htmlFor="password"
							className="sr-only block text-sm font-bold text-slate-700"
						>
							Dashboard Password
						</label>
						<input
							type="password"
							id="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							disabled={isPending}
							className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-center text-lg font-black tracking-widest text-slate-950 transition-colors placeholder:font-medium placeholder:tracking-normal placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200 focus:outline-none"
							placeholder="Enter Password"
							required
						/>
					</div>

					{error ? (
						<div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-600">
							<AlertTriangle className="size-4 shrink-0" />
							{error}
						</div>
					) : null}

					<button
						type="submit"
						disabled={isPending || !password}
						className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-emerald-700 text-sm font-black text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
					>
						{isPending ? "Unlocking..." : "Unlock Terminal"}
					</button>
				</form>
			</div>
		</div>
	);
}
