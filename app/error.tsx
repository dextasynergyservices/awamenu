"use client";

import { RouteError } from "@/components/shared/RouteError";

/**
 * Root error boundary. This is what renders when a *layout* throws — including
 * the dashboard, staff and super-admin layouts, whose own `error.tsx` files sit
 * beside them and therefore can't catch their failures.
 *
 * Because of that it's seen by restaurant owners and staff, not just diners, so
 * the copy stays audience-neutral (it previously told the reader to "contact
 * the restaurant", which reads as nonsense to the restaurant's own staff) and
 * surfaces the error reference for support.
 */
export default function ErrorPage({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<RouteError
			error={error}
			reset={reset}
			message="Please try again. If this keeps happening, quote the error reference below when contacting support."
		/>
	);
}
