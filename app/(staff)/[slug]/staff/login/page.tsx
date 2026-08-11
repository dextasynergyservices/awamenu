"use client";

import {
	AlertTriangle,
	ArrowLeft,
	Eye,
	EyeOff,
	Loader2,
	Lock,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState, useTransition } from "react";
import { staffLoginAction } from "@/actions/staff.actions";

export default function StaffLoginPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = use(params);
	const router = useRouter();
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const [shake, setShake] = useState(false);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);

		const fd = new FormData();
		fd.set("slug", slug);
		fd.set("password", password);

		startTransition(async () => {
			try {
				await staffLoginAction(fd);
				// ✅ Redirect to the correct staff dashboard
				router.push(`/${slug}/staff`);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Invalid password.");
				setShake(true);
				setTimeout(() => setShake(false), 500);
				setPassword("");
			}
		});
	}

	return (
		<div className="relative flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50/80 to-white px-4 py-8 overflow-hidden">
			{/* Decorative background */}
			<div className="absolute inset-0 -z-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMwMDAiIGZpbGwtb3BhY2l0eT0iMC4wNCI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
			<div className="absolute -top-24 -right-24 size-64 rounded-full bg-emerald-200/30 blur-3xl" />
			<div className="absolute -bottom-24 -left-24 size-64 rounded-full bg-teal-200/30 blur-3xl" />

			<div className="w-full max-w-md">
				<Link
					href={`/${slug}`}
					className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-emerald-700"
				>
					<ArrowLeft className="size-4" />
					Back to menu
				</Link>

				<div className="rounded-3xl bg-white/80 backdrop-blur-xl shadow-2xl shadow-emerald-900/5 border border-white/40 p-8 sm:p-10 transition-all">
					<div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
						<Lock className="size-8" />
					</div>

					<h1 className="mb-1 text-center text-2xl font-black text-slate-950">
						Staff Login
					</h1>
					<p className="mb-6 text-center text-sm font-medium text-slate-500">
						Access the dashboard for{" "}
						<span className="font-bold text-slate-800">{slug}</span>
					</p>

					<form onSubmit={handleSubmit} className="grid gap-6">
						<div className="relative">
							<label htmlFor="password" className="sr-only">
								Dashboard Password
							</label>
							<div className="relative">
								<input
									type={showPassword ? "text" : "password"}
									id="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									disabled={isPending}
									className={`
										w-full rounded-2xl border-2 bg-white/70 py-3.5 pl-5 pr-12 text-lg font-black tracking-widest text-slate-950 transition-all
										placeholder:font-medium placeholder:tracking-normal placeholder:text-slate-400
										focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200 focus:outline-none
										${error ? "border-red-400 ring-2 ring-red-200" : "border-slate-200"}
										${shake ? "animate-shake" : ""}
									`}
									placeholder="Enter password"
									required
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition-colors hover:text-slate-600"
									aria-label={showPassword ? "Hide password" : "Show password"}
									tabIndex={-1}
								>
									{showPassword ? (
										<EyeOff className="size-5" />
									) : (
										<Eye className="size-5" />
									)}
								</button>
							</div>
						</div>

						{error ? (
							<div className="flex items-start gap-2.5 rounded-xl bg-red-50/80 p-3 text-sm font-medium text-red-600 backdrop-blur-sm border border-red-100">
								<AlertTriangle className="mt-0.5 size-4 shrink-0" />
								<span>{error}</span>
							</div>
						) : null}

						<button
							type="submit"
							disabled={isPending || !password}
							className="relative inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-700 text-sm font-black text-white shadow-lg shadow-emerald-700/20 transition-all hover:shadow-emerald-700/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
						>
							{isPending ? (
								<>
									<Loader2 className="size-5 animate-spin" />
									Authenticating...
								</>
							) : (
								"Login"
							)}
						</button>

						<p className="mt-2 text-center text-xs font-medium text-slate-400">
							Secure, encrypted connection
						</p>
					</form>
				</div>
			</div>

			<style jsx>{`
				@keyframes shake {
					0%, 100% { transform: translateX(0); }
					20% { transform: translateX(-8px); }
					40% { transform: translateX(8px); }
					60% { transform: translateX(-6px); }
					80% { transform: translateX(6px); }
				}
				.animate-shake {
					animation: shake 0.4s ease-in-out;
				}
			`}</style>
		</div>
	);
}
