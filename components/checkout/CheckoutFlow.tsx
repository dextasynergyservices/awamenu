"use client";

import {
	ArrowRight,
	Check,
	Flame,
	Loader2,
	Lock,
	Mail,
	MapPin,
	Minus,
	Phone,
	Plus,
	ShoppingBag,
	Sparkles,
	Star,
	User,
	UserRoundPlus,
	Users,
	Utensils,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lookupCustomerByPhoneAction } from "@/actions/customer.actions";
import { createOrderAction } from "@/actions/order.actions";
import { PublicMenuNavbar } from "@/components/menu/PublicMenuNavbar";
import { SubmitButton } from "@/components/ui/action-button";
import { getCartSubtotal, useCart } from "@/hooks/useCart";
import type { BannerItem } from "@/lib/banners";
import { cn } from "@/lib/utils";

type CheckoutOrderType =
	| "DINE_IN"
	| "PICKUP"
	| "DELIVERY"
	| "TABLE_RESERVATION";

type CheckoutFlowProps = {
	name: string;
	logoUrl: string | null;
	bannerItems: BannerItem[];
	slug: string;
	currency: string;
	dineInPaymentPolicy: "PAY_BEFORE_SERVICE" | "PAY_AFTER_SERVICE";
	enabledOrderTypes: Record<CheckoutOrderType, boolean>;
	existingOrderId?: string;
};

const orderTypes: Array<{
	value: CheckoutOrderType;
	label: string;
	description: string;
	icon: typeof Utensils;
}> = [
	{
		value: "DINE_IN",
		label: "Dine in",
		description: "Eat at the restaurant",
		icon: Utensils,
	},
	{
		value: "PICKUP",
		label: "Pickup",
		description: "Pick up your order",
		icon: ShoppingBag,
	},
	{
		value: "DELIVERY",
		label: "Delivery",
		description: "We deliver to you",
		icon: Sparkles,
	},
];

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

export function CheckoutFlow({
	name,
	logoUrl,
	bannerItems,
	slug,
	currency,
	dineInPaymentPolicy,
	enabledOrderTypes,
	existingOrderId,
}: CheckoutFlowProps) {
	const allItems = useCart((state) => state.items);
	const appendOrderId = useCart((state) => state.appendOrderId);
	const setAppendOrderId = useCart((state) => state.setAppendOrderId);
	const setQuantity = useCart((state) => state.setQuantity);
	const [type, setType] = useState<CheckoutOrderType>("PICKUP");
	const [orderFor, setOrderFor] = useState<"SELF" | "SOMEONE_ELSE">("SELF");
	const [dineInServiceMode, setDineInServiceMode] = useState<
		"SELF_SERVED" | "SERVED_BY_WAITER"
	>("SELF_SERVED");

	// Auto-fetch customer details
	const [customerName, setCustomerName] = useState("");
	const [customerPhone, setCustomerPhone] = useState("");
	const [customerEmail, setCustomerEmail] = useState("");
	const [deliveryAddress, setDeliveryAddress] = useState("");
	const [autoFetched, setAutoFetched] = useState(false);
	const [fetchingProfile, setFetchingProfile] = useState(false);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handlePhoneChange = useCallback(
		(phone: string) => {
			setCustomerPhone(phone);
			setAutoFetched(false);

			if (debounceRef.current) clearTimeout(debounceRef.current);

			const trimmed = phone.replace(/\s+/g, "").trim();
			if (trimmed.length < 10) {
				setFetchingProfile(false);
				return;
			}

			debounceRef.current = setTimeout(async () => {
				setFetchingProfile(true);
				try {
					const result = await lookupCustomerByPhoneAction({
						restaurantSlug: slug,
						phone: trimmed,
					});
					if (result) {
						let loadedDetails = false;
						if (result.fullName && !customerName) {
							setCustomerName(result.fullName);
							loadedDetails = true;
						}
						if (result.email && !customerEmail) {
							setCustomerEmail(result.email);
							loadedDetails = true;
						}
						if (result.deliveryAddress && !deliveryAddress) {
							setDeliveryAddress(result.deliveryAddress);
							loadedDetails = true;
						}
						setAutoFetched(loadedDetails);
					}
				} catch {
					// Silently fail – customer may not exist
				} finally {
					setFetchingProfile(false);
				}
			}, 600);
		},
		[customerName, customerEmail, deliveryAddress, slug],
	);
	const availableOrderTypes = useMemo(
		() =>
			orderTypes.filter(
				(entry) =>
					entry.value !== "TABLE_RESERVATION" && enabledOrderTypes[entry.value],
			),
		[enabledOrderTypes],
	);
	const items = useMemo(
		() => allItems.filter((item) => item.restaurantSlug === slug),
		[allItems, slug],
	);
	const subtotal = getCartSubtotal(items);
	const total = subtotal;
	const orderIdToAppend = existingOrderId ?? appendOrderId ?? "";
	const selectedType = orderIdToAppend
		? "DINE_IN"
		: availableOrderTypes.some((entry) => entry.value === type)
			? type
			: (availableOrderTypes[0]?.value ?? "PICKUP");
	const heroBanner = bannerItems[0];
	const serializedItems = useMemo(
		() =>
			JSON.stringify(
				items.map((item) => ({
					id: item.id,
					quantity: item.quantity,
					notes: item.notes,
				})),
			),
		[items],
	);

	useEffect(() => {
		if (existingOrderId) {
			setAppendOrderId(existingOrderId);
			return;
		}

		setAppendOrderId(null);
	}, [existingOrderId, setAppendOrderId]);

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	const submitLabel = orderIdToAppend
		? "Add items to order"
		: selectedType === "DINE_IN" && dineInPaymentPolicy === "PAY_AFTER_SERVICE"
			? "Place order"
			: "Submit order for review";

	return (
		<div className="min-h-screen bg-white text-slate-950">
			<PublicMenuNavbar
				name={name}
				logoUrl={logoUrl}
				mode="mobile"
				restaurantSlug={slug}
			/>
			<div className="hidden md:block">
				<PublicMenuNavbar
					name={name}
					logoUrl={logoUrl}
					mode="desktop"
					restaurantSlug={slug}
				/>
			</div>

			<main className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-7">
				<section className="relative overflow-hidden rounded-[1.4rem] bg-emerald-950 text-white md:rounded-[1.75rem]">
					{heroBanner ? (
						<Image
							src={heroBanner.url}
							alt={`${name} banner`}
							fill
							className="object-cover"
							sizes="100vw"
							priority
							unoptimized
						/>
					) : null}
					<div className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-950/80 to-transparent" />
					<div className="relative min-h-[150px] p-5 md:min-h-[180px] md:p-10">
						<div className="flex items-center gap-4">
							{logoUrl ? (
								<Image
									src={logoUrl}
									alt={`${name} logo`}
									width={72}
									height={72}
									className="size-14 rounded-2xl object-cover md:size-16"
									unoptimized
								/>
							) : (
								<div className="grid size-14 place-items-center rounded-2xl bg-yellow-300 text-2xl font-black text-emerald-950 md:size-16">
									{name.charAt(0).toUpperCase()}
								</div>
							)}
							<div className="min-w-0">
								<div className="flex flex-wrap items-center gap-3">
									<h1 className="truncate text-2xl font-black md:text-3xl">
										{name}
									</h1>
									<span className="inline-flex items-center gap-1 text-sm font-bold">
										<Star
											className="size-4 fill-yellow-300 text-yellow-300"
											aria-hidden="true"
										/>
										4.8 (230+)
									</span>
								</div>
								<div className="mt-4 flex flex-wrap gap-4 text-sm font-medium md:text-semibold">
									<span className="inline-flex items-center gap-2">
										<Flame className="size-4 text-yellow-300" />
										25-35 mins
									</span>
									<span className="inline-flex items-center gap-2">
										<MapPin className="size-4 text-yellow-300" />
										3.2 km away
									</span>
									<span className="inline-flex items-center gap-2">
										<ShoppingBag className="size-4 text-yellow-300" />
										Burgers & Drinks
									</span>
								</div>
								{heroBanner?.title || heroBanner?.subtitle ? (
									<div className="mt-5 max-w-xl">
										{heroBanner.title ? (
											<p className="text-xl font-black md:text-2xl">
												{heroBanner.title}
											</p>
										) : null}
										{heroBanner.subtitle ? (
											<p className="mt-1 text-sm font-medium text-white/85 md:text-semibold">
												{heroBanner.subtitle}
											</p>
										) : null}
									</div>
								) : null}
							</div>
						</div>
					</div>
				</section>

				<div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_28rem]">
					<form
						action={createOrderAction}
						className="rounded-[1.4rem] border border-slate-200 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:rounded-[1.75rem] md:p-7"
					>
						<input type="hidden" name="slug" value={slug} />
						<input type="hidden" name="items" value={serializedItems} />
						{orderIdToAppend ? (
							<input
								type="hidden"
								name="existingOrderId"
								value={orderIdToAppend}
							/>
						) : null}
						{orderIdToAppend ? (
							<input type="hidden" name="type" value="DINE_IN" />
						) : null}

						<div>
							<h2 className="text-3xl font-black">Checkout</h2>
							<p className="mt-2 text-semibold font-medium text-slate-500">
								Review your order and provide your details.
							</p>
						</div>

						<div className="my-7 grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-3 text-xs font-black text-slate-500 md:gap-4">
							<span className="inline-flex items-center gap-2 text-emerald-800">
								<span className="grid size-8 place-items-center rounded-full bg-emerald-700 text-white">
									1
								</span>
								Details
							</span>
							<span className="h-px bg-slate-200" />
							<span className="inline-flex items-center gap-2">
								<span className="grid size-8 place-items-center rounded-full bg-slate-200 text-slate-500">
									2
								</span>
								Payment
							</span>
							<span className="h-px bg-slate-200" />
							<span className="inline-flex items-center gap-2">
								<span className="grid size-8 place-items-center rounded-full bg-slate-200 text-slate-500">
									3
								</span>
								Confirm
							</span>
						</div>

						{orderIdToAppend ? (
							<div className="rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
								These items will be added to your existing dine-in order.
							</div>
						) : (
							<section>
								<h3 className="text-lg font-black">Order type</h3>
								<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
									{availableOrderTypes.map((entry) => {
										const Icon = entry.icon;
										const checked = selectedType === entry.value;
										return (
											<label
												key={entry.value}
												className={cn(
													"relative grid min-h-20 cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 transition-colors",
													checked &&
														"border-emerald-700 bg-emerald-50 shadow-[0_10px_25px_rgba(4,120,87,0.08)]",
												)}
											>
												<input
													type="radio"
													name="type"
													value={entry.value}
													checked={selectedType === entry.value}
													onChange={() => setType(entry.value)}
													className="sr-only"
												/>
												<Icon className="size-7 text-slate-700" />
												<span className="min-w-0">
													<span className="block text-sm font-black">
														{entry.label}
													</span>
													<span className="mt-1 block text-xs font-medium text-slate-500">
														{entry.description}
													</span>
												</span>
												{checked ? (
													<span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-emerald-700 text-white">
														<Check className="size-4" aria-hidden="true" />
													</span>
												) : null}
											</label>
										);
									})}
								</div>
							</section>
						)}

						{/* ── Order for Self / Someone Else toggle ── */}
						{!orderIdToAppend ? (
							<section className="mt-7">
								<h3 className="text-lg font-black">Who is this order for?</h3>
								<div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-1">
									<button
										type="button"
										onClick={() => setOrderFor("SELF")}
										className={cn(
											"inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition-colors",
											orderFor === "SELF"
												? "bg-white text-emerald-700 shadow-sm"
												: "text-slate-500 hover:text-slate-700",
										)}
									>
										<User className="size-4" />
										For myself
									</button>
									<button
										type="button"
										onClick={() => setOrderFor("SOMEONE_ELSE")}
										className={cn(
											"inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition-colors",
											orderFor === "SOMEONE_ELSE"
												? "bg-white text-emerald-700 shadow-sm"
												: "text-slate-500 hover:text-slate-700",
										)}
									>
										<Users className="size-4" />
										For somebody
									</button>
								</div>
								<input type="hidden" name="orderFor" value={orderFor} />
							</section>
						) : null}

						{/* ── "For somebody else" fields ── */}
						{orderFor === "SOMEONE_ELSE" && !orderIdToAppend ? (
							<section className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
								<div className="flex items-center gap-2 text-sm font-black text-emerald-800">
									<UserRoundPlus className="size-4" />
									Recipient details
								</div>
								<div className="mt-3 grid gap-4 md:grid-cols-2">
									<label className="grid gap-2">
										<span className="text-sm font-black text-slate-700">
											Recipient name
										</span>
										<input
											name="receiverName"
											required
											placeholder="Enter recipient's name"
											className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-semibold outline-none focus:border-emerald-700"
										/>
									</label>
									<label className="grid gap-2">
										<span className="text-sm font-black text-slate-700">
											Recipient phone
										</span>
										<input
											name="receiverPhone"
											required
											type="tel"
											placeholder="Enter recipient's phone"
											className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-semibold outline-none focus:border-emerald-700"
										/>
									</label>
									{selectedType === "DINE_IN" ? (
										<label className="grid gap-2 md:col-span-2">
											<span className="text-sm font-black text-slate-700">
												Seat number (optional)
											</span>
											<input
												name="seatNumber"
												placeholder="e.g. Seat 3"
												className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-semibold outline-none focus:border-emerald-700"
											/>
										</label>
									) : (
										<label className="grid gap-2 md:col-span-2">
											<span className="text-sm font-black text-slate-700">
												Sender phone (your number)
											</span>
											<input
												name="senderPhone"
												required
												type="tel"
												placeholder="Enter your phone number"
												className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 text-semibold outline-none focus:border-emerald-700"
											/>
										</label>
									)}
								</div>
							</section>
						) : null}

						<section className="mt-7">
							<h3 className="text-lg font-black">Contact information</h3>
							{selectedType === "DINE_IN" || orderIdToAppend ? (
								<p className="mt-1 text-sm font-bold text-slate-500">
									Optional for dine-in orders.
								</p>
							) : null}
							{autoFetched ? (
								<p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
									<Check className="size-3.5" />
									Details loaded from your previous order
								</p>
							) : null}
							<div className="mt-4 grid gap-4 md:grid-cols-2">
								<label className="grid gap-2">
									<span className="text-sm font-medium text-slate-600">
										Full name
									</span>
									<span className="relative">
										<User className="-translate-y-1/2 absolute top-1/2 left-4 size-4 text-slate-400" />
										<input
											name="customerName"
											value={customerName}
											onChange={(e) => setCustomerName(e.target.value)}
											required={selectedType !== "DINE_IN" && !orderIdToAppend}
											placeholder="Enter your full name"
											className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pr-4 pl-11 text-semibold outline-none focus:border-emerald-700"
										/>
									</span>
								</label>
								<label className="grid gap-2">
									<span className="text-sm font-medium text-slate-600">
										Phone number
									</span>
									<span className="relative">
										<Phone className="-translate-y-1/2 absolute top-1/2 left-4 size-4 text-slate-400" />
										<input
											name="customerPhone"
											value={customerPhone}
											onChange={(e) => handlePhoneChange(e.target.value)}
											required={selectedType !== "DINE_IN" && !orderIdToAppend}
											placeholder="Enter your phone number"
											className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pr-4 pl-11 text-semibold outline-none focus:border-emerald-700"
										/>
										{fetchingProfile ? (
											<Loader2 className="-translate-y-1/2 absolute top-1/2 right-4 size-4 animate-spin text-emerald-600" />
										) : null}
									</span>
								</label>
							</div>
							<label className="mt-4 grid gap-2">
								<span className="text-sm font-medium text-slate-600">
									Email address (optional)
								</span>
								<span className="relative">
									<Mail className="-translate-y-1/2 absolute top-1/2 left-4 size-4 text-slate-400" />
									<input
										name="customerEmail"
										value={customerEmail}
										onChange={(e) => setCustomerEmail(e.target.value)}
										type="email"
										placeholder="Enter your email address"
										className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pr-4 pl-11 text-semibold outline-none focus:border-emerald-700"
									/>
								</span>
							</label>
						</section>

						{selectedType === "DINE_IN" && !orderIdToAppend ? (
							<section className="mt-5 grid gap-4 md:grid-cols-2">
								<label className="grid gap-2">
									<span className="text-sm font-black text-slate-700">
										Table number
									</span>
									<input
										name="tableNumber"
										required
										placeholder="Table 4"
										className="min-h-12 rounded-xl border border-slate-200 px-3 text-semibold outline-none focus:border-emerald-700"
									/>
								</label>
								<label className="grid gap-2">
									<span className="text-sm font-black text-slate-700">
										Payment method
									</span>
									<select
										name="dineInPaymentMethod"
										className="min-h-12 rounded-xl border border-slate-200 px-3 text-semibold outline-none focus:border-emerald-700"
									>
										<option value="CASH">Cash</option>
										<option value="TRANSFER_OR_CARD">Transfer/Card</option>
									</select>
								</label>
								<div className="grid gap-2 md:col-span-2">
									<span className="text-sm font-black text-slate-700">
										Service
									</span>
									<div className="grid gap-3 sm:grid-cols-2">
										<label
											className={cn(
												"grid cursor-pointer gap-1 rounded-xl border border-slate-200 px-4 py-3",
												dineInServiceMode === "SELF_SERVED" &&
													"border-emerald-700 bg-emerald-50",
											)}
										>
											<input
												type="radio"
												name="dineInServiceMode"
												value="SELF_SERVED"
												checked={dineInServiceMode === "SELF_SERVED"}
												onChange={() => setDineInServiceMode("SELF_SERVED")}
												className="sr-only"
											/>
											<span className="text-sm font-black text-slate-900">
												Self-served
											</span>
											<span className="text-xs font-bold text-slate-500">
												Default for customers ordering at the table.
											</span>
										</label>
										<label
											className={cn(
												"grid cursor-pointer gap-1 rounded-xl border border-slate-200 px-4 py-3",
												dineInServiceMode === "SERVED_BY_WAITER" &&
													"border-emerald-700 bg-emerald-50",
											)}
										>
											<input
												type="radio"
												name="dineInServiceMode"
												value="SERVED_BY_WAITER"
												checked={dineInServiceMode === "SERVED_BY_WAITER"}
												onChange={() =>
													setDineInServiceMode("SERVED_BY_WAITER")
												}
												className="sr-only"
											/>
											<span className="text-sm font-black text-slate-900">
												Served by
											</span>
											<span className="text-xs font-bold text-slate-500">
												Use when a waiter is attending this table.
											</span>
										</label>
									</div>
								</div>
								{dineInServiceMode === "SERVED_BY_WAITER" ? (
									<label className="grid gap-2 md:col-span-2">
										<span className="text-sm font-black text-slate-700">
											Waiter name
										</span>
										<input
											name="waiterName"
											required
											placeholder="Enter waiter name"
											className="min-h-12 rounded-xl border border-slate-200 px-3 text-semibold outline-none focus:border-emerald-700"
										/>
									</label>
								) : null}
								<p className="text-sm font-bold text-slate-500 md:col-span-2">
									{dineInPaymentPolicy === "PAY_AFTER_SERVICE"
										? "Payment is collected after service."
										: "Payment is required before service."}
								</p>
							</section>
						) : null}

						{selectedType === "DELIVERY" ? (
							<section className="mt-5 grid gap-4">
								<label className="grid gap-2">
									<span className="text-sm font-black text-slate-700">
										Delivery address
									</span>
									<textarea
										name="deliveryAddress"
										required
										rows={3}
										value={deliveryAddress}
										onChange={(e) => setDeliveryAddress(e.target.value)}
										placeholder="Enter your delivery address"
										className="rounded-xl border border-slate-200 px-3 py-3 text-semibold outline-none focus:border-emerald-700"
									/>
								</label>
								<label className="grid gap-2">
									<span className="text-sm font-black text-slate-700">
										Delivery notes
									</span>
									<textarea
										name="deliveryNotes"
										rows={2}
										placeholder="Add any notes for your order..."
										className="rounded-xl border border-slate-200 px-3 py-3 text-semibold outline-none focus:border-emerald-700"
									/>
								</label>
							</section>
						) : (
							<label className="mt-5 grid gap-2">
								<span className="text-sm font-medium text-slate-600">
									Special instructions (optional)
								</span>
								<textarea
									name="deliveryNotes"
									rows={4}
									placeholder="Add any notes for your order..."
									className="rounded-xl border border-slate-200 px-4 py-3 text-semibold outline-none focus:border-emerald-700"
								/>
							</label>
						)}

						<SubmitButton
							disabled={items.length === 0}
							loadingText="Processing..."
							successText="Order created"
							className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-emerald-700 px-5 text-semibold font-black text-white shadow-[0_14px_35px_rgba(4,120,87,0.18)] disabled:opacity-50"
						>
							{submitLabel}
							<ArrowRight className="size-5" aria-hidden="true" />
						</SubmitButton>

						<p className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-slate-500">
							<Lock className="size-4" aria-hidden="true" />
							Your information is secure and encrypted
						</p>
					</form>

					<aside className="rounded-[1.4rem] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.06)] md:rounded-[1.75rem] lg:sticky lg:top-6 lg:self-start">
						<div className="flex items-center justify-between gap-4 border-slate-200 border-b p-5 md:p-6">
							<h2 className="text-xl font-black">Your order</h2>
							<Link
								href={`/${slug}`}
								className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800"
							>
								Edit cart
							</Link>
						</div>

						<div className="grid gap-4 p-5 md:p-6">
							{items.length > 0 ? (
								items.map((item) => (
									<div
										key={item.id}
										className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] gap-4"
									>
										<div className="relative size-[4.5rem] overflow-hidden rounded-xl bg-emerald-50">
											{item.imageUrl ? (
												<Image
													src={item.imageUrl}
													alt={item.name}
													fill
													className="object-cover"
													sizes="72px"
													unoptimized
												/>
											) : (
												<div className="grid h-full place-items-center">
													<Utensils className="size-7 text-emerald-700" />
												</div>
											)}
											<span className="-top-1 -right-1 absolute grid size-6 place-items-center rounded-full bg-emerald-700 text-xs font-black text-white">
												{item.quantity}
											</span>
										</div>
										<div className="min-w-0">
											<p className="truncate text-semibold font-black">
												{item.name}
											</p>
											<p className="mt-1 line-clamp-1 text-sm font-medium text-slate-500">
												{item.notes || "Freshly prepared"}
											</p>
											<div className="mt-3 inline-flex items-center rounded-lg border border-slate-200">
												<button
													type="button"
													onClick={() =>
														setQuantity(item.id, item.quantity - 1)
													}
													className="grid size-8 place-items-center text-emerald-800"
													aria-label={`Reduce ${item.name}`}
												>
													<Minus className="size-4" aria-hidden="true" />
												</button>
												<span className="min-w-8 text-center text-sm font-black">
													{item.quantity}
												</span>
												<button
													type="button"
													onClick={() =>
														setQuantity(item.id, item.quantity + 1)
													}
													className="grid size-8 place-items-center text-emerald-800"
													aria-label={`Increase ${item.name}`}
												>
													<Plus className="size-4" aria-hidden="true" />
												</button>
											</div>
										</div>
										<p className="pt-2 text-sm font-black">
											{formatMoney(item.price * item.quantity, currency)}
										</p>
									</div>
								))
							) : (
								<p className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm font-bold text-slate-500">
									Your cart is empty.
								</p>
							)}
						</div>

						<div className="grid gap-4 border-slate-200 border-t p-5 text-sm md:p-6">
							<div className="flex justify-between">
								<span className="text-slate-600">Subtotal</span>
								<span className="font-black">
									{formatMoney(subtotal, currency)}
								</span>
							</div>
							<div className="flex justify-between border-slate-200 border-t pt-5 text-xl font-black">
								<span>Total</span>
								<span className="text-emerald-800">
									{formatMoney(total, currency)}
								</span>
							</div>

							<div className="rounded-xl bg-emerald-50 p-4">
								<div className="flex gap-3">
									<Sparkles className="size-7 shrink-0 text-emerald-700" />
									<div>
										<p className="text-sm font-black text-emerald-800">
											You are saving {formatMoney(200, currency)} on this order!
										</p>
										<p className="mt-1 text-sm font-medium text-slate-600">
											Free delivery on orders over{" "}
											{formatMoney(10000, currency)}
										</p>
									</div>
								</div>
							</div>
						</div>

						<div className="grid grid-cols-3 gap-3 border-slate-200 border-t p-5 text-center md:p-6">
							<div className="grid gap-2">
								<Lock className="mx-auto size-6 text-emerald-700" />
								<p className="text-xs font-black">Secure payment</p>
							</div>
							<div className="grid gap-2">
								<Flame className="mx-auto size-6 text-emerald-700" />
								<p className="text-xs font-black">Fresh & fast</p>
							</div>
							<div className="grid gap-2">
								<User className="mx-auto size-6 text-emerald-700" />
								<p className="text-xs font-black">Support</p>
							</div>
						</div>

						<div className="border-slate-200 border-t p-5 md:p-6">
							<p className="text-sm font-black">We accept</p>
							<div className="mt-3 flex flex-wrap gap-3">
								<span className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-black text-blue-700">
									VISA
								</span>
								<span className="inline-flex items-center rounded-lg border border-slate-200 px-4 py-2">
									<span className="size-4 rounded-full bg-red-500" />
									<span className="-ml-2 size-4 rounded-full bg-yellow-400 opacity-90" />
								</span>
								<span className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-black text-red-600">
									Verve
								</span>
								<span className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-black">
									Apple Pay
								</span>
								<span className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-black text-slate-700">
									G Pay
								</span>
							</div>
						</div>
					</aside>
				</div>
			</main>
		</div>
	);
}
