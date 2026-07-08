"use client";

import { X } from "lucide-react";
import { useState } from "react";

export function PinPromptModal({
	onPinEnter,
	onClose,
}: {
	onPinEnter: (pin: string) => void;
	onClose: () => void;
}) {
	const [pin, setPin] = useState("");

	function handleFormSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (pin.length === 4) {
			onPinEnter(pin);
		}
	}

	return (
		<div className="fixed inset-0 z-160 grid place-items-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
			<section className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-xl font-black text-slate-950">
						Staff PIN Required
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="grid size-8 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100"
					>
						<X className="size-4" aria-hidden="true" />
					</button>
				</div>
				<form onSubmit={handleFormSubmit} className="grid gap-5">
					<div>
						<label
							htmlFor="staff-pin"
							className="block text-sm font-bold text-slate-700 text-center mb-3"
						>
							Enter your 4-digit PIN
						</label>
						<input
							id="staff-pin"
							type="password"
							inputMode="numeric"
							pattern="[0-9]*"
							maxLength={4}
							value={pin}
							onChange={(e) =>
								setPin(e.target.value.replace(/\D/g, "").slice(0, 4))
							}
							className="w-full text-center text-3xl font-black tracking-widest text-slate-950 rounded-2xl border border-slate-200 bg-slate-50 py-4 focus:bg-white focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 outline-none"
							required
						/>
					</div>
					<button
						type="submit"
						disabled={pin.length !== 4}
						className="min-h-12 w-full rounded-2xl bg-emerald-700 text-sm font-black text-white disabled:opacity-50 hover:bg-emerald-800 transition-colors"
					>
						Confirm
					</button>
				</form>
			</section>
		</div>
	);
}
