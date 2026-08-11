import { OnboardingStatus, SubscriptionStatus } from "@prisma/client";
import { redirect } from "next/navigation";
import { completeSetupAction } from "@/actions/onboarding.actions";
import { RestaurantNameSlugFields } from "@/components/onboarding/RestaurantNameSlugFields";
import { SubmitButton } from "@/components/ui/action-button";
import { ActionForm } from "@/components/ui/action-form";
import { requireUser } from "@/lib/auth-guards";
import { parseBillingInterval } from "@/lib/billing";
import { db } from "@/lib/db";
import { verifySubscriptionPaymentReference } from "@/lib/payments";

export default async function SetupPage({
	searchParams,
}: {
	searchParams: Promise<{
		planId?: string;
		billing?: string;
		reference?: string;
		trxref?: string;
	}>;
}) {
	const user = await requireUser();
	const { planId, billing, reference, trxref } = await searchParams;
	const billingInterval = parseBillingInterval(billing);
	const paymentReference = reference ?? trxref;
	const dbUser = await db.user.findUnique({
		where: { id: user.id },
		select: { onboardingStatus: true },
	});

	if (dbUser?.onboardingStatus === "PENDING_PLAN")
		redirect("/onboarding/choose-plan");
	if (dbUser?.onboardingStatus === "PENDING_PAYMENT") {
		if (planId && paymentReference) {
			await verifySubscriptionPaymentReference({
				reference: paymentReference,
				userId: user.id,
				planId,
				billingInterval,
			});
		}

		const activeSubscription = await db.subscription.findFirst({
			where: {
				userId: user.id,
				restaurantId: null,
				status: SubscriptionStatus.ACTIVE,
			},
			select: { id: true },
		});

		if (activeSubscription) {
			await db.user.update({
				where: { id: user.id },
				data: { onboardingStatus: OnboardingStatus.PENDING_SETUP },
			});
		} else {
			redirect(
				planId
					? `/onboarding/checkout?planId=${planId}&billing=${billingInterval}`
					: "/onboarding/choose-plan",
			);
		}
	}

	return (
		<main className="min-h-screen bg-white px-4 py-10">
			<section className="mx-auto w-full max-w-xl border border-emerald-800/20 bg-white p-6 shadow-[0_12px_40px_rgba(22,101,52,0.08)]">
				<div className="mb-6 h-1.5 w-16 bg-yellow-400" />
				<p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
					Restaurant setup
				</p>
				<h1 className="mt-2 text-2xl font-semibold text-zinc-950">
					Create your restaurant
				</h1>
				<ActionForm action={completeSetupAction} className="mt-6 grid gap-4">
					{planId ? <input type="hidden" name="planId" value={planId} /> : null}
					<input type="hidden" name="billingInterval" value={billingInterval} />
					<RestaurantNameSlugFields />
					<label className="grid gap-2 text-sm font-medium text-zinc-800">
						Phone
						<input
							name="phone"
							className="h-11 border border-zinc-300 px-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-yellow-300/60"
						/>
					</label>
					<label className="grid gap-2 text-sm font-medium text-zinc-800">
						WhatsApp number
						<input
							name="whatsappNumber"
							className="h-11 border border-zinc-300 px-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-yellow-300/60"
						/>
					</label>
					<label className="grid gap-2 text-sm font-medium text-zinc-800">
						Address
						<textarea
							name="address"
							className="min-h-24 border border-zinc-300 px-3 py-2 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-yellow-300/60"
						/>
					</label>
					<SubmitButton
						loadingText="Creating..."
						successText="Created"
						className="h-11 bg-emerald-700 px-4 text-sm font-semibold uppercase tracking-widest text-white transition-colors hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
					>
						Complete Setup
					</SubmitButton>
				</ActionForm>
			</section>
		</main>
	);
}
