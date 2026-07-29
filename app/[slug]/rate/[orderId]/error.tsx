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
			title="We could not load the rating form"
			message="Please try again in a moment."
		/>
	);
}
