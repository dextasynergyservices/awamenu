import { redirect } from "next/navigation";
import { redirectCompletedOnboarding, requireUser } from "@/lib/auth-guards";

export default async function OnboardingLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const user = await requireUser();

	if (!user.emailVerified) {
		redirect(`/verify-email/code?email=${encodeURIComponent(user.email)}`);
	}

	await redirectCompletedOnboarding(user.id);

	return <>{children}</>;
}
