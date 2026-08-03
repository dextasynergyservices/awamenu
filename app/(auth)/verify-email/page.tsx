import { CheckCircle2, Mail, XCircle } from "lucide-react";
import { verifyEmailWithToken } from "@/actions/email-verification.actions";
import { MarketingBottomNav } from "@/components/marketing/MarketingBottomNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";

function onboardingContinueUrl(plan?: string, billing?: string) {
	const params = new URLSearchParams();
	if (plan) params.set("plan", plan);
	if (billing) params.set("billing", billing);
	return `/onboarding/choose-plan${params.toString() ? `?${params.toString()}` : ""}`;
}

function codeEntryUrl(email?: string, plan?: string, billing?: string) {
	if (!email) return "/verify-email/code";
	const params = new URLSearchParams({ email });
	if (plan) params.set("plan", plan);
	if (billing) params.set("billing", billing);
	return `/verify-email/code?${params.toString()}`;
}

export default async function VerifyEmailPage({
	searchParams,
}: {
	searchParams: Promise<{
		token?: string;
		email?: string;
		plan?: string;
		billing?: string;
	}>;
}) {
	const { token, email, plan, billing } = await searchParams;

	let status: "missing" | "success" | "failed" = "missing";
	if (token && email) {
		status = (await verifyEmailWithToken(email, token)) ? "success" : "failed";
	}

	return (
		<>
			<main className="min-h-screen bg-[#f6faf7] pb-24 md:pb-8">
				<MarketingHeader variant="light" />
				<div className="mx-auto flex max-w-md items-center px-4 py-8 sm:py-12">
					<section className="card-rise-in w-full rounded-[2rem] border border-slate-100 bg-white p-6 text-center shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:p-8">
						{status === "success" && (
							<>
								<div className="badge-pop-in mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
									<CheckCircle2 className="size-7" aria-hidden="true" />
								</div>
								<p className="text-xs font-black uppercase tracking-widest text-emerald-700">
									Email Verified
								</p>
								<h1 className="mt-2 text-2xl font-black text-slate-950">
									You're all set
								</h1>
								<p className="mt-2 text-sm font-medium text-slate-600">
									Your email address has been verified. Continue to finish
									setting up your restaurant.
								</p>
								<a
									href={onboardingContinueUrl(plan, billing)}
									className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-800"
								>
									Continue
								</a>
							</>
						)}

						{status === "failed" && (
							<>
								<div className="badge-pop-in mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600">
									<XCircle className="size-7" aria-hidden="true" />
								</div>
								<p className="text-xs font-black uppercase tracking-widest text-red-600">
									Link Expired
								</p>
								<h1 className="mt-2 text-2xl font-black text-slate-950">
									This link is no longer valid
								</h1>
								<p className="mt-2 text-sm font-medium text-slate-600">
									It may have expired or already been used. You can request a
									new email or enter the code instead.
								</p>
								<a
									href={codeEntryUrl(email, plan, billing)}
									className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-800"
								>
									Enter code instead
								</a>
							</>
						)}

						{status === "missing" && (
							<>
								<div className="badge-pop-in mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
									<Mail className="size-7" aria-hidden="true" />
								</div>
								<p className="text-xs font-black uppercase tracking-widest text-emerald-700">
									AwaMenu
								</p>
								<h1 className="mt-2 text-2xl font-black text-slate-950">
									Check your inbox
								</h1>
								<p className="mt-2 text-sm font-medium text-slate-600">
									We sent you a verification link and a 6-digit code. Click the
									link in that email, or enter the code below.
								</p>
								<a
									href={codeEntryUrl(email, plan, billing)}
									className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white transition-colors hover:bg-emerald-800"
								>
									Enter code
								</a>
							</>
						)}
					</section>
				</div>
			</main>
			<MarketingFooter />
			<MarketingBottomNav />
		</>
	);
}
