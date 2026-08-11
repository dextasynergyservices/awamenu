"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type MarketingAuthCtaProps = {
	/** Rendered when signed out. */
	signedOutClassName: string;
	/** Rendered when signed in (usually the same pill styling). */
	signedInClassName?: string;
};

/**
 * Auth-aware CTA for the marketing pages.
 *
 * The marketing pages are statically rendered, so the server has no session to
 * read — which is why a signed-in owner kept seeing "Login" and had to sign in
 * again. Resolving the session on the client keeps those pages static (and
 * fast) while still reflecting who is signed in.
 *
 * While the session is still resolving this renders a non-interactive
 * placeholder of the same size, so the header doesn't shift or flash the wrong
 * label.
 */
export function MarketingAuthCta({
	signedOutClassName,
	signedInClassName,
}: MarketingAuthCtaProps) {
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return (
			<span
				aria-hidden="true"
				className={cn(signedOutClassName, "pointer-events-none opacity-0")}
			>
				Login
			</span>
		);
	}

	if (session?.user) {
		return (
			<Link
				href="/dashboard"
				className={signedInClassName ?? signedOutClassName}
			>
				Dashboard
			</Link>
		);
	}

	return (
		<Link href="/login" className={signedOutClassName}>
			Login
		</Link>
	);
}
