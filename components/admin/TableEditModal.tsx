"use client";

import {
	AlertTriangle,
	Armchair,
	CheckCircle2,
	ChevronDown,
	Edit3,
	MapPin,
	Save,
	Trash2,
	Upload,
	Users,
	WalletCards,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";
import {
	deleteTableSeatAction,
	updateTableSeatAction,
} from "@/actions/reservation.actions";
import { uploadTablePhoto } from "@/components/admin/table-photo-upload";
import {
	Dialog,
	DialogBody,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/Dialog";
import { cn } from "@/lib/utils";

type TableStatus = "AVAILABLE" | "RESERVED" | "OCCUPIED" | "DISABLED";

type TableEditModalProps = {
	currency: string;
	restaurantId: string;
	restaurantSlug: string;
	trigger?: React.ReactNode;
	triggerAriaLabel?: string;
	triggerClassName?: string;
	table: {
		id: string;
		label: string;
		description: string | null;
		imageUrl: string | null;
		capacity: number;
		isActive: boolean;
		sortOrder: number;
		bookingModeOverride: string | null;
		paymentTimingOverride: string | null;
		inclusionTypeOverride: string | null;
		tableFee: string;
		minimumSpend: string;
		displayMinimumSpend: string;
		status: TableStatus;
		location: string;
	};
};

const inputClass =
	"min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-base font-bold text-slate-700 outline-none focus:border-emerald-700 md:text-sm";

function statusTone(status: TableStatus) {
	if (status === "AVAILABLE") return "bg-emerald-50 text-emerald-700";
	if (status === "RESERVED") return "bg-orange-50 text-orange-600";
	if (status === "OCCUPIED") return "bg-red-50 text-red-700";
	return "bg-slate-100 text-slate-600";
}

function tableCode(id: string) {
	return `TBL-${id.slice(-3).toUpperCase()}`;
}

export function TableEditModal({
	table,
	currency,
	restaurantId,
	restaurantSlug,
	trigger,
	triggerAriaLabel,
	triggerClassName,
}: TableEditModalProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deletePending, setDeletePending] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [previewUrl, setPreviewUrl] = useState(table.imageUrl ?? "");

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
			await updateTableSeatAction(new FormData(form));
			setOpen(false);
			router.refresh();
		} catch (caughtError) {
			setError(
				caughtError instanceof Error
					? caughtError.message
					: "Unable to save table changes.",
			);
		} finally {
			setPending(false);
		}
	}

	async function handleDelete(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;

		if (!form.checkValidity()) {
			form.reportValidity();
			return;
		}

		setDeletePending(true);
		setDeleteError(null);

		try {
			await deleteTableSeatAction(new FormData(form));
			setDeleteOpen(false);
			setOpen(false);
			router.refresh();
		} catch (caughtError) {
			setDeleteError(
				caughtError instanceof Error
					? caughtError.message
					: "Unable to delete this table.",
			);
		} finally {
			setDeletePending(false);
		}
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className={
					triggerClassName ??
					"flex min-h-8 items-center justify-end gap-2 text-sm font-black text-slate-950"
				}
				aria-label={triggerAriaLabel}
			>
				{trigger ?? (
					<>
						Edit
						<ChevronDown className="-rotate-90 size-4" aria-hidden="true" />
					</>
				)}
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
				<DialogHeader title="Table Details" className="px-6 pt-6 pb-0" />
				<DialogBody className="px-6 pb-5 pt-5">
					<div className="grid gap-5">
						<div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
							<div className="flex min-w-0 items-center gap-4">
								<span className="grid size-20 shrink-0 place-items-center rounded-3xl bg-emerald-50 text-emerald-700">
									<Armchair className="size-7 md:size-9" aria-hidden="true" />
								</span>
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-3">
										<h3 className="text-lg font-black text-slate-950 md:text-2xl">
											{table.label}
										</h3>
										<span
											className={cn(
												"rounded-full px-3 py-1 text-xs font-black",
												statusTone(table.status),
											)}
										>
											•{" "}
											{table.status.charAt(0) +
												table.status.slice(1).toLowerCase()}
										</span>
									</div>
									<p className="mt-1 text-xs font-semibold text-slate-600 md:text-sm">
										Table ID: {tableCode(table.id)}
									</p>
								</div>
							</div>
						</div>

						<form
							id={`table-edit-${table.id}`}
							onSubmit={handleSubmit}
							aria-busy={pending}
							className="grid gap-5"
						>
							<input type="hidden" name="slug" value={restaurantSlug} />
							<input type="hidden" name="tableId" value={table.id} />
							<input
								type="hidden"
								name="bookingModeOverride"
								value={table.bookingModeOverride ?? ""}
							/>
							<input
								type="hidden"
								name="paymentTimingOverride"
								value={table.paymentTimingOverride ?? ""}
							/>
							<input
								type="hidden"
								name="inclusionTypeOverride"
								value={table.inclusionTypeOverride ?? ""}
							/>
							<input
								type="hidden"
								name="sortOrder"
								value={String(table.sortOrder)}
							/>
							<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
								<section className="rounded-2xl border border-slate-200 p-4">
									<div className="mb-4 flex items-center justify-between gap-3">
										<h4 className="text-sm font-black text-slate-950 md:text-base">
											Table Information
										</h4>
										<span className="inline-flex min-h-8 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-black text-slate-700">
											<Edit3 className="size-3.5" aria-hidden="true" />
											Edit
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
												defaultValue={table.label}
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
												defaultValue={table.capacity}
												className={inputClass}
											/>
										</EditableInfoRow>
										<EditableInfoRow
											icon={<MapPin className="size-4" />}
											label="Section / Note"
										>
											<input
												name="description"
												defaultValue={table.description ?? ""}
												placeholder={table.location}
												className={inputClass}
											/>
										</EditableInfoRow>
										<EditableInfoRow
											icon={<WalletCards className="size-4" />}
											label="Minimum Spend"
										>
											<input
												name="minimumSpend"
												type="number"
												min="0"
												step="100"
												defaultValue={table.minimumSpend}
												className={inputClass}
											/>
										</EditableInfoRow>
										<EditableInfoRow
											icon={<WalletCards className="size-4" />}
											label={`Table Fee (${currency})`}
										>
											<input
												name="tableFee"
												type="number"
												min="0"
												step="100"
												defaultValue={table.tableFee}
												className={inputClass}
											/>
										</EditableInfoRow>
										<StaticInfoRow
											icon={<CheckCircle2 className="size-4" />}
											label="Status"
										>
											<span
												className={cn(
													"inline-flex w-fit rounded-full px-3 py-1 text-xs font-black",
													statusTone(table.status),
												)}
											>
												{table.status.charAt(0) +
													table.status.slice(1).toLowerCase()}
											</span>
										</StaticInfoRow>
									</div>
								</section>

								<section className="rounded-2xl border border-slate-200 p-4">
									<h4 className="text-sm font-black text-slate-950 md:text-base">
										Table Photo
									</h4>
									<input
										type="hidden"
										id={`table-image-${table.id}`}
										name="imageUrl"
										defaultValue={table.imageUrl ?? ""}
									/>
									<div className="relative mt-4 aspect-[1.35] overflow-hidden rounded-xl bg-slate-100">
										{previewUrl ? (
											<Image
												src={previewUrl}
												alt={`${table.label} preview`}
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
												const hiddenInput = document.getElementById(
													`table-image-${table.id}`,
												);
												if (
													!file ||
													!(hiddenInput instanceof HTMLInputElement)
												) {
													return;
												}
												try {
													setUploading(true);
													const imageUrl = await uploadTablePhoto(
														restaurantId,
														file,
													);
													hiddenInput.value = imageUrl;
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
										defaultChecked={table.isActive}
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
					<div className="flex flex-wrap items-center gap-3">
						<button
							type="button"
							onClick={() => setOpen(false)}
							className="min-h-10 rounded-xl border border-slate-200 bg-white px-5 text-xs font-black text-slate-950 md:min-h-11 md:px-7 md:text-sm"
						>
							Close
						</button>
						<button
							type="button"
							onClick={() => {
								setDeleteOpen(true);
								setDeleteError(null);
							}}
							className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 text-xs font-black text-red-700 md:min-h-11 md:px-5 md:text-sm"
						>
							<Trash2 className="size-4" aria-hidden="true" />
							Delete Table
						</button>
					</div>
					<button
						type="submit"
						form={`table-edit-${table.id}`}
						disabled={pending}
						className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-xs font-black text-white disabled:opacity-60 md:min-h-11 md:px-7 md:text-sm"
					>
						<Save className="size-4" aria-hidden="true" />
						{pending ? (
							"Saving..."
						) : (
							<>
								<span className="md:hidden">Save</span>
								<span className="hidden md:inline">Save Changes</span>
							</>
						)}
					</button>
				</DialogFooter>
			</Dialog>

			<Dialog
				open={deleteOpen}
				onOpenChange={(next) => {
					setDeleteOpen(next);
					if (!next) setDeleteError(null);
				}}
				variant="sheet"
				size="md"
			>
				<DialogBody className="pt-4 sm:pt-5">
					<div className="flex items-start justify-between gap-4">
						<div className="flex items-start gap-3">
							<span className="grid size-11 shrink-0 place-items-center rounded-full bg-red-50 text-red-700">
								<AlertTriangle className="size-5" aria-hidden="true" />
							</span>
							<div>
								<DialogTitle className="text-base font-black text-slate-950 md:text-lg">
									Delete {table.label}?
								</DialogTitle>
								<p className="mt-2 text-xs font-semibold leading-5 text-slate-600 md:text-sm md:leading-6">
									Enter your admin password to confirm. This is only allowed
									when the table has no reservation or order history.
								</p>
							</div>
						</div>
					</div>

					<form
						onSubmit={handleDelete}
						aria-busy={deletePending}
						className="mt-5 grid gap-3"
					>
						<input type="hidden" name="slug" value={restaurantSlug} />
						<input type="hidden" name="tableId" value={table.id} />
						<label className="grid gap-1 text-xs font-black text-slate-700 md:text-sm">
							Admin password
							<input
								name="password"
								type="password"
								required
								autoComplete="current-password"
								className={inputClass}
							/>
						</label>
						{deleteError ? (
							<p className="rounded-xl bg-red-50 p-3 text-xs font-bold leading-5 text-red-700 md:text-sm md:leading-6">
								{deleteError}
							</p>
						) : null}
						<div className="mt-2 grid gap-2 sm:grid-cols-2">
							<button
								type="button"
								onClick={() => setDeleteOpen(false)}
								className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-950 md:min-h-11 md:text-sm"
							>
								Keep Table
							</button>
							<button
								type="submit"
								disabled={deletePending}
								className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-black text-white disabled:opacity-60 md:min-h-11 md:text-sm"
							>
								<Trash2 className="size-4" aria-hidden="true" />
								{deletePending ? "Deleting..." : "Delete Table"}
							</button>
						</div>
					</form>
				</DialogBody>
			</Dialog>
		</>
	);
}

function StaticInfoRow({
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
			<span className="font-black text-slate-950">{children}</span>
		</div>
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
