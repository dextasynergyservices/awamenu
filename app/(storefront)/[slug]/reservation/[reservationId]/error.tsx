"use client";

import { RouteError } from "@/components/shared/RouteError";

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
			title="We could not load this reservation"
			message="Please try again. If it still does not work, contact the restaurant with your reservation code."
		/>
	);
}
