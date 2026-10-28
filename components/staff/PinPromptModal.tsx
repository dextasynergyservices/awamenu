"use client";

import { IdCard, KeyRound } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogBody, DialogHeader } from "@/components/ui/Dialog";

/** Remembered on the device so staff only type their PIN next time. */
const LAST_STAFF_ID_KEY = "awamenu:last-staff-id";
const PIN_LENGTH = 4;

function readLastStaffId(): string {
	try {
		return localStorage.getItem(LAST_STAFF_ID_KEY) ?? "";
	} catch {
		return "";
	}
}

/**
 * Asks which staff member is performing an action: their Staff ID (visible to
 * colleagues, so it only names them) and their private PIN (which proves it).
 * The dashboard itself is unlocked by the restaurant's shared password.
 */
export function PinPromptModal({
	onPinEnter,
	onClose,
}: {
	/** Receives the Staff ID and PIN, for the action's form data. */
	onPinEnter: (staffId: string, pin: string) => void;
	onClose: () => void;
}) {
	const [staffId, setStaffId] = useState(readLastStaffId);
	const [pin, setPin] = useState("");
	const trimmed = staffId.trim();
	const ready = trimmed.length >= 4 && pin.length === PIN_LENGTH;

	function handleFormSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!ready) return;
		const id = trimmed.toUpperCase();
		try {
			localStorage.setItem(LAST_STAFF_ID_KEY, id);
		} catch {
			// Storage blocked: they'll just type the ID again next time.
		}
		onPinEnter(id, pin);
	}

	const inputClass =
		"w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 text-center text-xl font-black tracking-widest text-slate-950 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-200 sm:py-3 sm:text-2xl";

	return (
		<Dialog
			open
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
			size="sm"
		>
			<DialogHeader title="Who's doing this?" />
			<DialogBody>
				<form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
					<div className="w-full">
						<label
							htmlFor="staff-id"
							className="mb-2 block text-center text-xs font-bold text-slate-700"
						>
							Staff ID
						</label>
						<div className="relative">
							<IdCard
								className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
								aria-hidden="true"
							/>
							<input
								id="staff-id"
								type="text"
								inputMode="text"
								autoCapitalize="characters"
								autoComplete="off"
								maxLength={12}
								value={staffId}
								onChange={(e) =>
									setStaffId(e.target.value.replace(/\s/g, "").toUpperCase())
								}
								placeholder="e.g. 7K2M9Q"
								className={inputClass}
								required
							/>
						</div>
					</div>
					<div className="w-full">
						<label
							htmlFor="staff-pin"
							className="mb-2 block text-center text-xs font-bold text-slate-700"
						>
							PIN
						</label>
						<div className="relative">
							<KeyRound
								className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
								aria-hidden="true"
							/>
							<input
								id="staff-pin"
								type="password"
								inputMode="numeric"
								autoComplete="off"
								maxLength={PIN_LENGTH}
								value={pin}
								onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
								placeholder="••••"
								// The ID is usually remembered, so the PIN is what they type.
								autoFocus={trimmed.length >= 4}
								className={inputClass}
								required
							/>
						</div>
						<p className="mt-2 text-center text-xs font-medium text-slate-500">
							Ask your manager if you don&apos;t have a PIN or forgot it.
						</p>
					</div>
					<button
						type="submit"
						disabled={!ready}
						className="min-h-10 w-full rounded-xl bg-emerald-700 text-sm font-black text-white transition-colors hover:bg-emerald-800 disabled:opacity-50"
					>
						Confirm
					</button>
				</form>
			</DialogBody>
		</Dialog>
	);
}
