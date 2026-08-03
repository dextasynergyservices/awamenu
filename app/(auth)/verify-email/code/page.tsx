import { MailCheck } from "lucide-react";
import { VerifyEmailCodeForm } from "@/components/auth/VerifyEmailCodeForm";
import { MarketingBottomNav } from "@/components/marketing/MarketingBottomNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";

export default async function VerifyEmailCodePage({
	searchParams,
}: {
	searchParams: Promise<{ email?: string; plan?: string; billing?: string }>;
}) {
	const { email, plan, billing } = await searchParams;

	return (
		<>
			<main className="min-h-screen bg-[#f6faf7] pb-24 md:pb-8">
				<MarketingHeader variant="light" />
				<div className="mx-auto flex max-w-md items-center px-4 py-8 sm:py-12">
					<section className="card-rise-in w-full rounded-[2rem] border border-slate-100 bg-white p-6 text-center shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-8">
						<div className="badge-pop-in mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
							<MailCheck className="size-7" aria-hidden="true" />
						</div>
						<p className="text-xs font-black uppercase tracking-widest text-emerald-700">
							Verify Your Email
						</p>
						<h1 className="mt-2 text-2xl font-black text-slate-950">
							Enter your code
						</h1>
						<p className="mt-2 mb-7 text-sm font-medium text-slate-600">
							We sent a 6-digit code
							{email ? (
								<>
									{" "}
									to <span className="font-black text-slate-950">{email}</span>
								</>
							) : null}
							. You can also click the link in that email instead.
						</p>
						<VerifyEmailCodeForm
							initialEmail={email ?? ""}
							plan={plan}
							billing={billing}
						/>
					</section>
				</div>
			</main>
			<MarketingFooter />
			<MarketingBottomNav />
		</>
	);
}
