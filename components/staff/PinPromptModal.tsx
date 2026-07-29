"use client";

import { useState } from "react";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";

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
		<Dialog
			open
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			size="sm"
		>
			<DialogHeader title="Staff PIN Required" />
			<DialogBody>
				<form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
					<div className="w-full">
						<label
							htmlFor="staff-pin"
							className="block text-xs font-bold text-slate-700 text-center mb-2"
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
							className="w-full text-center text-xl sm:text-2xl font-black tracking-widest text-slate-950 rounded-2xl border border-slate-200 bg-slate-50 py-2.5 sm:py-3 focus:bg-white focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 outline-none"
							required
						/>
					</div>
					<button
						type="submit"
						disabled={pin.length !== 4}
						className="min-h-10 w-full rounded-xl bg-emerald-700 text-sm font-black text-white disabled:opacity-50 hover:bg-emerald-800 transition-colors"
					>
						Confirm
					</button>
				</form>
			</DialogBody>
		</Dialog>
	);
}
