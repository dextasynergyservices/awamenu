import { redirect } from "next/navigation";
import { redirectCompletedOnboarding, requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";

export default async function OnboardingLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const user = await requireUser();

	// Read verification straight from the database rather than the session.
	// better-auth caches the session in a signed cookie for five minutes, so
	// the session's `emailVerified` is stale for that long after someone
	// verifies — this guard then bounced them back to the code screen they had
	// just completed, in a loop, with no error anywhere. The database is the
	// only authority on a flag that changes mid-session.
	const fresh = await db.user.findUnique({
		where: { id: user.id },
		select: { emailVerified: true },
	});

	if (!fresh?.emailVerified) {
		redirect(`/verify-email/code?email=${encodeURIComponent(user.email)}`);
	}

	await redirectCompletedOnboarding(user.id);

	return <>{children}</>;
}
