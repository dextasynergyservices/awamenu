"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useId, useState } from "react";

/**
 * A password field you can unmask.
 *
 * Typing a password blind on a phone keyboard is the main cause of failed
 * logins, and the usual response — asking people to type it twice — makes the
 * problem worse rather than better. Every password field in the app should use
 * this rather than a bare `type="password"`.
 *
 * Details that matter and are easy to miss:
 * - The toggle is a real `<button type="button">`, so it is reachable by
 *   keyboard and never submits the form it sits inside.
 * - `aria-pressed` and a changing label mean a screen reader announces the
 *   current state, not just "button".
 * - Padding-right on the input reserves the toggle's space, so a long password
 *   scrolls under the icon instead of behind it.
 * - The field starts masked on every mount. Remembering "shown" across renders
 *   would eventually reveal a password over someone's shoulder.
 */
export const PasswordInput = forwardRef<
	HTMLInputElement,
	Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(function PasswordInput({ className = "", id, ...props }, ref) {
	const [visible, setVisible] = useState(false);
	const generatedId = useId();
	const inputId = id ?? generatedId;

	return (
		<div className="relative min-w-0">
			<input
				{...props}
				ref={ref}
				id={inputId}
				type={visible ? "text" : "password"}
				className={`w-full min-w-0 pr-11 ${className}`}
			/>
			<button
				type="button"
				onClick={() => setVisible((current) => !current)}
				aria-pressed={visible}
				aria-controls={inputId}
				aria-label={visible ? "Hide password" : "Show password"}
				title={visible ? "Hide password" : "Show password"}
				// Inset rather than absolutely centred on a fixed height, so it stays
				// aligned whatever height the field it wraps happens to be.
				className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
				// Stops the *click* stealing focus, so unmasking mid-typing doesn't
				// move the caret or dismiss the mobile keyboard. Deliberately not
				// tabIndex={-1}: that would fix the same problem by making the
				// toggle unreachable for anyone navigating by keyboard, which is
				// precisely the group who most need to check what they typed.
				onMouseDown={(event) => event.preventDefault()}
			>
				{visible ? (
					<EyeOff className="size-4" aria-hidden="true" />
				) : (
					<Eye className="size-4" aria-hidden="true" />
				)}
			</button>
		</div>
	);
});
