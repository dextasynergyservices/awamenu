import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { MarketingBottomNav } from "@/components/marketing/MarketingBottomNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";

export default function LoginPage() {
	return (
		<>
			<main className="min-h-screen bg-[#f6faf7] pb-24 md:pb-8">
				<MarketingHeader variant="light" />
				<div className="mx-auto flex max-w-md items-center px-4 py-8 sm:py-12">
					<section className="w-full rounded-[2rem] border border-slate-100 bg-white p-6 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-8">
						<div className="mb-6 h-1.5 w-16 rounded-full bg-yellow-400" />
						<div className="mb-6">
							<p className="text-xs font-black uppercase tracking-widest text-emerald-700">
								AwaMenu
							</p>
							<h1 className="mt-2 text-2xl font-black text-slate-950">
								Sign in
							</h1>
						</div>
						<LoginForm />
						<p className="mt-5 text-sm font-medium text-slate-600">
							Need an account?{" "}
							<Link
								href="/signup"
								className="font-black text-emerald-700 underline"
							>
								Create one
							</Link>
						</p>
					</section>
				</div>
			</main>
			<MarketingFooter />
			<MarketingBottomNav />
		</>
	);
}
