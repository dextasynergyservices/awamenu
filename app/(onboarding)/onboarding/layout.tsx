import { redirectCompletedOnboarding, requireUser } from "@/lib/auth-guards";

export default async function OnboardingLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const user = await requireUser();
	await redirectCompletedOnboarding(user.id);

	return <>{children}</>;
}
