"use client";

import {
	Armchair,
	Edit3,
	MapPin,
	Plus,
	Save,
	Upload,
	Users,
	WalletCards,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type React from "react";
import { useId, useState } from "react";
import { createTableSeatAction } from "@/actions/reservation.actions";
import { TableBookingRulesFields } from "@/components/admin/TableBookingRulesFields";
import { uploadTablePhoto } from "@/components/admin/table-photo-upload";
import {
	Dialog,
	DialogBody,
	DialogFooter,
	DialogHeader,
} from "@/components/ui/Dialog";

type TableCreateModalProps = {
	currency: string;
	restaurantId: string;
	restaurantSlug: string;
	triggerClassName?: string;
	triggerLabel?: string;
};

const inputClass =
	"min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-bold text-slate-700 outline-none focus:border-emerald-700 md:text-sm";

export function TableCreateModal({
	currency,
	restaurantId,
	restaurantSlug,
	triggerClassName,
	triggerLabel = "Add Table",
}: TableCreateModalProps) {
	const router = useRouter();
	const imageInputId = useId();
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [previewUrl, setPreviewUrl] = useState("");

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;

		if (!form.checkValidity()) {
			form.reportValidity();
			return;
		}

		setPending(true);
		setError(null);

		try {
			const result = await createTableSeatAction(new FormData(form));
			if ("error" in result) throw new Error(result.error);
			setOpen(false);
			setPreviewUrl("");
			form.reset();
			router.refresh();
		} catch (caughtError) {
			setError(
				caughtError instanceof Error
					? caughtError.message
					: "Unable to add table.",
			);
		} finally {
			setPending(false);
		}
	}

	return (
		<>
			<button
				type="button"
				onClick={() => {
					setOpen(true);
					setError(null);
				}}
				className={
					triggerClassName ??
					"inline-flex min-h-12 items-center justify-center gap-3 rounded-2xl bg-emerald-700 px-6 text-sm font-black text-white shadow-[0_12px_28px_rgba(4,120,87,0.18)] transition-colors hover:bg-emerald-800"
				}
			>
				<Plus className="size-5" aria-hidden="true" />
				{triggerLabel}
			</button>

			<Dialog
				open={open}
				onOpenChange={(next) => {
					setOpen(next);
					if (!next) setError(null);
				}}
				variant="sheet"
				size="2xl"
			>
				<DialogHeader
					title="Add Table"
					className="px-4 pt-5 pb-0 sm:px-6 sm:pt-6"
				/>
				<DialogBody className="px-4 pb-5 pt-4 sm:px-6 sm:pt-5">
					<div className="grid min-w-0 gap-5">
						<div className="flex min-w-0 items-center gap-4">
							<span className="grid size-20 shrink-0 place-items-center rounded-3xl bg-emerald-50 text-emerald-700">
								<Armchair className="size-7 md:size-9" aria-hidden="true" />
							</span>
							<div className="min-w-0">
								<h3 className="text-lg font-black text-slate-950 md:text-2xl">
									New Table
								</h3>
								<p className="mt-1 text-xs font-semibold text-slate-600 md:text-sm">
									Add the table details customers will see.
								</p>
							</div>
						</div>

						<form
							id="table-create"
							onSubmit={handleSubmit}
							aria-busy={pending}
							className="grid gap-5"
						>
							<input type="hidden" name="slug" value={restaurantSlug} />
							<input type="hidden" name="sortOrder" value="0" />
							<div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
								<section className="rounded-2xl border border-slate-200 p-4">
									<div className="mb-4 flex items-center justify-between gap-3">
										<h4 className="text-sm font-black text-slate-950 md:text-base">
											Table Information
										</h4>
										<span className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700">
											<Edit3 className="size-3.5" aria-hidden="true" />
											Add
										</span>
									</div>
									<div className="grid gap-3">
										<EditableInfoRow
											icon={<WalletCards className="size-4" />}
											label="Table Name"
										>
											<input
												name="label"
												required
												placeholder="Table for couples"
												className={inputClass}
											/>
										</EditableInfoRow>
										<EditableInfoRow
											icon={<Users className="size-4" />}
											label="Seats"
										>
											<input
												name="capacity"
												type="number"
												min="1"
												defaultValue={2}
												className={inputClass}
											/>
										</EditableInfoRow>
										<EditableInfoRow
											icon={<MapPin className="size-4" />}
											label="Section / Note"
										>
											<input
												name="description"
												placeholder="Indoor, VIP Room, Outdoor..."
												className={inputClass}
											/>
										</EditableInfoRow>
									</div>

									<div className="mt-5 border-t border-slate-100 pt-5">
										<h4 className="mb-3 text-sm font-black text-slate-950">
											Booking rules
										</h4>
										<TableBookingRulesFields currency={currency} />
									</div>
								</section>

								<section className="rounded-2xl border border-slate-200 p-4">
									<h4 className="text-sm font-black text-slate-950 md:text-base">
										Table Photo
									</h4>
									{/* Controlled, not written through the DOM. The uploaded URL
									    used to be assigned with `hiddenInput.value = …`, which
									    React can overwrite on the next reconcile — the preview
									    updated while the submitted value stayed empty, so the
									    photo silently never saved. */}
									<input
										type="hidden"
										id={imageInputId}
										name="imageUrl"
										value={previewUrl}
										readOnly
									/>
									<div className="relative mt-4 aspect-[1.35] overflow-hidden rounded-xl bg-slate-100">
										{previewUrl ? (
											<Image
												src={previewUrl}
												alt="New table preview"
												fill
												className="object-cover"
												sizes="320px"
												unoptimized
											/>
										) : (
											<div className="grid h-full place-items-center bg-emerald-50 text-emerald-700">
												<Armchair className="size-16" aria-hidden="true" />
											</div>
										)}
									</div>
									<label className="mt-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-800">
										<Upload className="size-4" aria-hidden="true" />
										{uploading ? "Uploading..." : "Upload photo"}
										<input
											type="file"
											accept="image/webp,image/jpeg,image/png"
											className="sr-only"
											onChange={async (event) => {
												const input = event.currentTarget;
												const file = input.files?.[0];

												if (!file) {
													return;
												}
												try {
													setUploading(true);
													const imageUrl = await uploadTablePhoto(
														restaurantId,
														file,
													);
													setPreviewUrl(imageUrl);
												} catch (caughtError) {
													setError(
														caughtError instanceof Error
															? caughtError.message
															: "Unable to upload table photo.",
													);
												} finally {
													setUploading(false);
													input.value = "";
												}
											}}
										/>
									</label>
									<p className="mt-2 text-xs font-semibold text-slate-500">
										Upload WebP, JPG, or PNG. Save changes after upload.
									</p>
								</section>
							</div>

							<section className="rounded-2xl border border-slate-200 p-4">
								<h4 className="text-sm font-black text-slate-950 md:text-base">
									Table Settings
								</h4>
								<div className="mt-4 grid gap-3 md:grid-cols-2">
									<ToggleRow
										label="Allow Online Booking"
										name="isActive"
										defaultChecked={true}
									/>
								</div>
							</section>
						</form>

						{error ? (
							<p className="rounded-2xl bg-red-50 p-3 text-xs font-bold text-red-700 md:text-sm">
								{error}
							</p>
						) : null}
					</div>
				</DialogBody>

				<DialogFooter
					bordered
					className="flex items-center justify-between gap-3 px-6 py-4"
				>
					<button
						type="button"
						onClick={() => setOpen(false)}
						className="min-h-10 rounded-xl border border-slate-200 bg-white px-5 text-xs font-black text-slate-950 md:min-h-11 md:px-7 md:text-sm"
					>
						Close
					</button>
					<button
						type="submit"
						form="table-create"
						disabled={pending}
						className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-xs font-black text-white disabled:opacity-60 md:min-h-11 md:px-7 md:text-sm"
					>
						<Save className="size-4" aria-hidden="true" />
						{pending ? "Adding..." : "Add Table"}
					</button>
				</DialogFooter>
			</Dialog>
		</>
	);
}

function EditableInfoRow({
	icon,
	label,
	children,
}: {
	icon: React.ReactNode;
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="grid grid-cols-[1.25rem_minmax(6.5rem,0.8fr)_minmax(0,1fr)] items-center gap-2 text-xs font-semibold text-slate-600 md:grid-cols-[1.25rem_minmax(8rem,0.8fr)_minmax(0,1fr)] md:gap-3 md:text-sm">
			<span className="text-slate-600">{icon}</span>
			<span>{label}</span>
			{children}
		</div>
	);
}

function ToggleRow({
	label,
	name,
	defaultChecked,
}: {
	label: string;
	name: string;
	defaultChecked: boolean;
}) {
	return (
		<label className="flex min-h-9 items-center justify-between gap-3 text-xs font-semibold text-slate-600 md:text-sm">
			<span>{label}</span>
			<span className="relative inline-flex h-6 w-10 items-center rounded-full bg-slate-200 has-checked:bg-emerald-700">
				<input
					type="checkbox"
					name={name}
					defaultChecked={defaultChecked}
					className="peer sr-only"
				/>
				<span className="ml-1 size-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
			</span>
		</label>
	);
}
