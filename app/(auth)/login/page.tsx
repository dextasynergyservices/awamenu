import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
	return (
		<main className="flex min-h-screen items-center justify-center bg-white px-4 py-12">
			<section className="w-full max-w-md border border-emerald-800/20 bg-white p-6 shadow-[0_12px_40px_rgba(22,101,52,0.08)]">
				<div className="mb-6 h-1.5 w-16 bg-yellow-400" />
				<div className="mb-6">
					<p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
						AwaMenu
					</p>
					<h1 className="mt-2 text-2xl font-semibold text-zinc-950">Sign in</h1>
				</div>
				<LoginForm />
				<p className="mt-5 text-sm text-zinc-600">
					Need an account?{" "}
					<Link
						href="/signup"
						className="font-medium text-emerald-700 underline"
					>
						Create one
					</Link>
				</p>
			</section>
		</main>
	);
}
