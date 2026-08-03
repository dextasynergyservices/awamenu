"use client";

import { useRef, useState } from "react";

type OtpCodeInputProps = {
	length?: number;
	name: string;
	onComplete?: (code: string) => void;
	disabled?: boolean;
};

/**
 * Segmented one-time-code input — one box per digit, auto-advances on type,
 * steps back on backspace, and accepts a full pasted code in one go. Reports
 * the assembled value through a hidden input (so it still works as a normal
 * form field) and via `onComplete` once every box is filled.
 */
export function OtpCodeInput({
	length = 6,
	name,
	onComplete,
	disabled,
}: OtpCodeInputProps) {
	const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
	const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

	function commit(next: string[]) {
		setDigits(next);
		const code = next.join("");
		if (code.length === length && !next.includes("")) {
			onComplete?.(code);
		}
	}

	function handleChange(index: number, rawValue: string) {
		const value = rawValue.replace(/\D/g, "");
		if (!value) {
			commit(digits.map((d, i) => (i === index ? "" : d)));
			return;
		}

		// Handles a full paste landing in a single box (some browsers/mobile
		// keyboards deliver pasted text as one `onChange` rather than firing
		// the dedicated paste handler).
		if (value.length > 1) {
			const chars = value.slice(0, length - index).split("");
			const next = [...digits];
			chars.forEach((char, offset) => {
				next[index + offset] = char;
			});
			commit(next);
			const lastFilled = Math.min(index + chars.length, length - 1);
			inputRefs.current[lastFilled]?.focus();
			return;
		}

		const next = digits.map((d, i) => (i === index ? value : d));
		commit(next);
		if (index < length - 1) {
			inputRefs.current[index + 1]?.focus();
		}
	}

	function handleKeyDown(
		index: number,
		event: React.KeyboardEvent<HTMLInputElement>,
	) {
		if (event.key === "Backspace" && !digits[index] && index > 0) {
			inputRefs.current[index - 1]?.focus();
		}
	}

	function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
		const pasted = event.clipboardData.getData("text").replace(/\D/g, "");
		if (!pasted) return;
		event.preventDefault();
		const chars = pasted.slice(0, length).split("");
		const next = Array(length).fill("");
		chars.forEach((char, i) => {
			next[i] = char;
		});
		commit(next);
		inputRefs.current[Math.min(chars.length, length - 1)]?.focus();
	}

	return (
		<div className="flex justify-center gap-2 sm:gap-3">
			<input type="hidden" name={name} value={digits.join("")} />
			{digits.map((digit, index) => (
				<input
					// biome-ignore lint/suspicious/noArrayIndexKey: box position is static, never reordered
					key={index}
					ref={(el) => {
						inputRefs.current[index] = el;
					}}
					type="text"
					inputMode="numeric"
					autoComplete={index === 0 ? "one-time-code" : "off"}
					maxLength={length}
					disabled={disabled}
					value={digit}
					onChange={(event) => handleChange(index, event.currentTarget.value)}
					onKeyDown={(event) => handleKeyDown(index, event)}
					onPaste={handlePaste}
					className="size-11 rounded-xl border border-slate-200 bg-white text-center text-lg font-black text-slate-950 outline-none transition-colors focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 sm:size-12 sm:text-xl"
				/>
			))}
		</div>
	);
}
