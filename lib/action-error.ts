import { ZodError } from "zod";

/**
 * Expected, user-facing failures from a server action.
 *
 * Next strips error messages thrown inside server actions in production —
 * the client only ever receives "An error occurred in the Server Components
 * render… A digest property is included…". That is correct for genuine bugs
 * (a stack trace or a Prisma error must never reach a customer) but useless
 * for the rules we *want* people to read: "payment is required first", "you
 * don't have permission to manage this type of order".
 *
 * So expected failures are RETURNED rather than thrown. Throw `ActionError`
 * inside an action body, wrap the body with `actionResult`, and the message
 * survives to the browser intact. Anything else keeps throwing, and keeps
 * being hidden behind a digest, which is exactly what should happen to a bug.
 */
export class ActionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ActionError";
	}
}

export type ActionResponse = { ok: true } | { error: string };

/**
 * Bad form input (most actions validate with `schema.parse`) is the person's
 * to fix, not a bug, so it comes back as a message like any ActionError
 * instead of replacing the page with the error screen.
 */
function expectedFailure(error: unknown): string | null {
	if (error instanceof ActionError) return error.message;
	if (error instanceof ZodError) {
		const issue = error.issues[0];
		const field = issue?.path.at(-1);
		const label =
			typeof field === "string"
				? field.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase()
				: null;
		return label
			? `Check the ${label} and try again.`
			: "Check the form and try again.";
	}
	return null;
}

/**
 * Runs an action body, converting `ActionError` into a returned message.
 *
 * Everything else is rethrown untouched — including Next's `redirect()` and
 * `notFound()`, which signal by throwing and would break if swallowed here.
 */
export async function actionResult(
	run: () => Promise<void>,
): Promise<ActionResponse> {
	try {
		await run();
		return { ok: true };
	} catch (error) {
		const message = expectedFailure(error);
		if (message) return { error: message };
		throw error;
	}
}

/**
 * Same contract for actions that return data (a reset token, a profile).
 *
 * The payload is returned unchanged on success, so callers keep reading their
 * own fields; on an expected failure they get `{ error }` instead. Narrow with
 * `if ("error" in result)` before touching the payload.
 */
export async function actionData<T extends object>(
	run: () => Promise<T>,
): Promise<T | { error: string }> {
	try {
		return await run();
	} catch (error) {
		const message = expectedFailure(error);
		if (message) return { error: message };
		throw error;
	}
}

/**
 * Validates action input, turning the first problem into a readable message
 * ("Say why, for the audit log.") instead of a thrown ZodError, which would
 * reach the browser as a generic error digest.
 */
export function parseInput<T>(
	schema: {
		safeParse: (
			data: unknown,
		) =>
			| { success: true; data: T }
			| { success: false; error: { issues: Array<{ message: string }> } };
	},
	data: unknown,
): T {
	const result = schema.safeParse(data);
	if (!result.success) {
		throw new ActionError(
			result.error.issues[0]?.message ?? "Check the form and try again.",
		);
	}
	return result.data;
}
