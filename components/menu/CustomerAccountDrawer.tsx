"use client";

import {
	BadgePercent,
	BriefcaseBusiness,
	Check,
	ClipboardList,
	Mail,
	Phone,
	UserRound,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
	getCustomerHubDataAction,
	requestCustomerOtpAction,
	updateCustomerProfileAction,
	verifyCustomerOtpAction,
} from "@/actions/customer.actions";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

function useMounted() {
	return useSyncExternalStore(
		emptySubscribe,
		() => true,
		() => false,
	);
}

type CustomerOrder = {
	id: string;
	customerName: string;
	customerPhone: string;
	customerEmail: string | null;
	type: string;
	status: string;
	statusNote: string | null;
	cancellationNote: string | null;
	paymentStatus: string;
	total: string;
	createdAt: string;
	restaurant: {
		name: string;
		slug: string;
		currency: string;
		phone: string | null;
		address: string | null;
	};
	items: Array<{
		id: string;
		name: string;
		qty: number;
		unitPrice: string;
		notes: string | null;
	}>;
};

type CustomerHubData = {
	profile: {
		id: string;
		fullName: string | null;
		whatsappNumber: string | null;
		alternativePhone: string | null;
		email: string | null;
		deliveryAddress: string | null;
	};
	currentRestaurant: { id: string; name: string; slug: string };
	orders: CustomerOrder[];
	reservations: Array<{
		id: string;
		partySize: number;
		startsAt: string;
		status: string;
		reservationPaymentStatus: string;
		restaurant: { name: string; slug: string };
		table: { label: string };
	}>;
	vendors: Array<{
		name: string;
		slug: string;
		orders: number;
		reservations: number;
	}>;
	rewards: Array<{ id: string; title: string; description: string }>;
};

type IdentityType = "phone" | "email";
type OtpChannel = "whatsapp" | "sms" | "email";
type ActiveTab = "orders" | "vendors" | "rewards" | "profile";

type CustomerAccountDrawerProps = {
	restaurantSlug: string;
};

const SESSION_KEY = "awamenu-customer-session";

type CustomerSession = {
	identityType: IdentityType;
	identifier: string;
};

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

function orderStatusLabel(
	order: Pick<CustomerOrder, "status" | "cancellationNote">,
) {
	if (order.status === "CANCELLED" && order.cancellationNote) return "DECLINED";
	return order.status.replaceAll("_", " ");
}

function formatDate(value: string) {
	return new Intl.DateTimeFormat("en-NG", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function normalizeIdentifier(type: IdentityType, identifier: string) {
	if (type === "email") return identifier.trim().toLowerCase();
	return identifier.replace(/\s+/g, "").trim();
}

export function CustomerAccountDrawer({
	restaurantSlug,
}: CustomerAccountDrawerProps) {
	const [open, setOpen] = useState(false);
	const mounted = useMounted();
	const [identityType, setIdentityType] = useState<IdentityType>("phone");
	const [identifier, setIdentifier] = useState("");
	const [channel, setChannel] = useState<OtpChannel>("whatsapp");
	const [code, setCode] = useState("");
	const [otpRequested, setOtpRequested] = useState(false);
	const [activeTab, setActiveTab] = useState<ActiveTab>("orders");
	const [hubData, setHubData] = useState<CustomerHubData | null>(null);
	const [selectedOrder, setSelectedOrder] = useState<CustomerOrder | null>(
		null,
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		let active = true;
		const timeoutId = window.setTimeout(() => {
			const stored = window.localStorage.getItem(SESSION_KEY);
			if (!stored || !active) return;

			try {
				const session = JSON.parse(stored) as CustomerSession;
				if (!active) return;

				setIdentityType(session.identityType);
				setIdentifier(session.identifier);
				getCustomerHubDataAction({
					restaurantSlug,
					identityType: session.identityType,
					identifier: session.identifier,
				})
					.then((data) => {
						if (active) setHubData(data as CustomerHubData);
					})
					.catch(() => window.localStorage.removeItem(SESSION_KEY));
			} catch {
				window.localStorage.removeItem(SESSION_KEY);
			}
		}, 0);

		return () => {
			active = false;
			window.clearTimeout(timeoutId);
		};
	}, [restaurantSlug]);

	async function handleRequestOtp(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setLoading(true);
		setError("");
		const normalizedIdentifier = normalizeIdentifier(identityType, identifier);

		try {
			await requestCustomerOtpAction({
				restaurantSlug,
				identityType,
				identifier: normalizedIdentifier,
				channel: identityType === "email" ? "email" : channel,
			});
			setIdentifier(normalizedIdentifier);
			setOtpRequested(true);
		} catch (requestError) {
			setError(
				requestError instanceof Error
					? requestError.message
					: "Unable to send verification code.",
			);
		} finally {
			setLoading(false);
		}
	}

	async function handleVerifyOtp(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setLoading(true);
		setError("");

		try {
			const data = await verifyCustomerOtpAction({
				restaurantSlug,
				identityType,
				identifier,
				code,
			});
			setHubData(data as CustomerHubData);
			window.localStorage.setItem(
				SESSION_KEY,
				JSON.stringify({ identityType, identifier }),
			);
			setActiveTab("orders");
		} catch (verifyError) {
			setError(
				verifyError instanceof Error
					? verifyError.message
					: "Invalid verification code.",
			);
		} finally {
			setLoading(false);
		}
	}

	function handleLogout() {
		window.localStorage.removeItem(SESSION_KEY);
		setHubData(null);
		setCode("");
		setOtpRequested(false);
		setActiveTab("orders");
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/20 transition hover:bg-white/25 md:bg-emerald-50 md:text-emerald-700 md:ring-0"
				aria-label="Open customer account"
				title="Customer account"
			>
				<UserRound className="size-5" aria-hidden="true" />
			</button>

			{open && mounted
				? createPortal(
						<div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] md:items-center md:p-4">
							<button
								type="button"
								className="absolute inset-0 cursor-default"
								aria-label="Close customer account"
								onClick={() => setOpen(false)}
							/>
							<section className="relative z-10 grid max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl md:max-h-[85vh] md:rounded-[1.75rem]">
								<header className="flex items-start justify-between gap-4 border-slate-100 border-b px-4 py-4 md:px-5">
									<div>
										<p className="text-xs font-black uppercase tracking-wide text-emerald-700">
											Customer access
										</p>
										<h2 className="mt-1 text-sm md:text-xl font-black text-slate-950">
											{hubData ? "Your AwaMenu" : "Verify your details"}
										</h2>
									</div>
									<button
										type="button"
										onClick={() => setOpen(false)}
										className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500"
										aria-label="Close"
									>
										<X className="size-4" aria-hidden="true" />
									</button>
								</header>

								<div className="min-h-0 overflow-y-auto px-4 py-4 md:px-5">
									{hubData ? (
										<CustomerHub
											data={hubData}
											identifier={identifier}
											activeTab={activeTab}
											onLogout={handleLogout}
											onSelectOrder={setSelectedOrder}
											onProfileSaved={(profile) =>
												setHubData((current) =>
													current ? { ...current, profile } : current,
												)
											}
										/>
									) : otpRequested ? (
										<form onSubmit={handleVerifyOtp} className="grid gap-4">
											<p className="text-xs md:text-sm font-semibold leading-6 text-slate-600">
												Enter the 6-digit code sent to{" "}
												<span className="font-black text-slate-900">
													{identifier}
												</span>{" "}
												via{" "}
												{channel === "whatsapp"
													? "WhatsApp"
													: channel === "sms"
														? "SMS"
														: "email"}
												.
											</p>
											<label className="grid gap-2 text-xs md:text-sm font-black text-slate-700">
												Verification code
												<input
													value={code}
													onChange={(event) => setCode(event.target.value)}
													inputMode="numeric"
													maxLength={6}
													required
													className="min-h-12 rounded-xl border border-slate-200 px-3 text-base font-semibold outline-none focus:border-emerald-700"
												/>
											</label>
											<ErrorMessage message={error} />
											<div className="grid grid-cols-2 gap-3">
												<button
													type="button"
													onClick={() => {
														setOtpRequested(false);
														setCode("");
													}}
													className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 text-xs md:text-sm font-black text-slate-700"
												>
													Back
												</button>
												<button
													type="submit"
													disabled={loading}
													className="min-h-12 rounded-xl bg-emerald-700 px-4 text-xs md:text-sm font-black text-white disabled:opacity-60"
												>
													{loading ? "Checking..." : "Verify"}
												</button>
											</div>
										</form>
									) : (
										<form onSubmit={handleRequestOtp} className="grid gap-4">
											<div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-1">
												<SegmentButton
													active={identityType === "phone"}
													onClick={() => {
														setIdentityType("phone");
														setChannel("whatsapp");
													}}
												>
													<Phone className="size-3.5 md:size-4" />
													Phone
												</SegmentButton>
												<SegmentButton
													active={identityType === "email"}
													onClick={() => {
														setIdentityType("email");
														setChannel("email");
													}}
												>
													<Mail className="size-3.5 md:size-4" />
													Email
												</SegmentButton>
											</div>

											<label className="grid gap-2 text-xs md:text-sm font-black text-slate-700">
												{identityType === "phone"
													? "Phone number"
													: "Email address"}
												<input
													value={identifier}
													onChange={(event) =>
														setIdentifier(event.target.value)
													}
													type={identityType === "email" ? "email" : "tel"}
													required
													className="min-h-12 rounded-xl border border-slate-200 px-3 text-base font-semibold outline-none focus:border-emerald-700"
												/>
											</label>

											{identityType === "phone" ? (
												<div className="grid gap-2">
													<p className="text-xs md:text-sm font-black text-slate-700">
														Receive code through
													</p>
													<div className="grid grid-cols-2 gap-2">
														<SegmentButton
															active={channel === "whatsapp"}
															onClick={() => setChannel("whatsapp")}
														>
															WhatsApp
														</SegmentButton>
														<SegmentButton
															active={channel === "sms"}
															onClick={() => setChannel("sms")}
														>
															SMS
														</SegmentButton>
													</div>
												</div>
											) : null}

											<ErrorMessage message={error} />
											<button
												type="submit"
												disabled={loading}
												className="min-h-12 rounded-xl bg-emerald-700 px-4 text-xs md:text-sm font-black text-white disabled:opacity-60"
											>
												{loading ? "Sending..." : "Send code"}
											</button>
										</form>
									)}
								</div>

								{hubData ? (
									<CustomerBottomNav
										activeTab={activeTab}
										onChange={setActiveTab}
									/>
								) : null}
							</section>

							{selectedOrder ? (
								<CustomerOrderModal
									order={selectedOrder}
									onClose={() => setSelectedOrder(null)}
								/>
							) : null}
						</div>,
						document.body,
					)
				: null}
		</>
	);
}

function CustomerHub({
	data,
	identifier,
	activeTab,
	onLogout,
	onSelectOrder,
	onProfileSaved,
}: {
	data: CustomerHubData;
	identifier: string;
	activeTab: ActiveTab;
	onLogout: () => void;
	onSelectOrder: (order: CustomerOrder) => void;
	onProfileSaved: (profile: CustomerHubData["profile"]) => void;
}) {
	return (
		<div className="pb-20">
			<div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 p-3">
				<div className="min-w-0">
					<p className="truncate text-xs md:text-sm font-black text-emerald-950">
						{data.profile.fullName ?? identifier}
					</p>
					<p className="mt-1 text-xs font-semibold text-emerald-800">
						{data.orders.length} orders · {data.vendors.length} vendors
					</p>
				</div>
				<button
					type="button"
					onClick={onLogout}
					className="shrink-0 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-xs font-black text-emerald-800"
				>
					Logout
				</button>
			</div>

			{activeTab === "orders" ? (
				<OrdersPanel data={data} onSelectOrder={onSelectOrder} />
			) : null}
			{activeTab === "vendors" ? <VendorsPanel data={data} /> : null}
			{activeTab === "rewards" ? <RewardsPanel data={data} /> : null}
			{activeTab === "profile" ? (
				<ProfilePanel
					identifier={identifier}
					profile={data.profile}
					onSaved={onProfileSaved}
				/>
			) : null}
		</div>
	);
}

function OrdersPanel({
	data,
	onSelectOrder,
}: {
	data: CustomerHubData;
	onSelectOrder: (order: CustomerOrder) => void;
}) {
	const PAGE_SIZE = 5;
	const [page, setPage] = useState(0);
	const totalPages = Math.max(1, Math.ceil(data.orders.length / PAGE_SIZE));
	const currentPage = Math.min(page, totalPages - 1);
	const pagedOrders = data.orders.slice(
		currentPage * PAGE_SIZE,
		currentPage * PAGE_SIZE + PAGE_SIZE,
	);

	return (
		<div className="grid gap-3">
			{data.orders.length > 0 ? (
				<>
					{pagedOrders.map((order) => (
						<button
							key={order.id}
							type="button"
							onClick={() => onSelectOrder(order)}
							className="grid gap-2 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
						>
							<div className="flex items-start justify-between gap-3">
								<div>
									<p className="text-xs md:text-sm font-black text-slate-950">
										#{order.id.slice(-6).toUpperCase()} ·{" "}
										{order.restaurant.name}
									</p>
									<p className="mt-1 text-xs font-semibold text-slate-500">
										{formatDate(order.createdAt)}
									</p>
								</div>
								<p className="text-xs md:text-sm font-black text-emerald-700">
									{formatMoney(Number(order.total), order.restaurant.currency)}
								</p>
							</div>
							<div className="flex flex-wrap gap-2">
								<Pill>{order.type.replaceAll("_", " ")}</Pill>
								<Pill>{orderStatusLabel(order)}</Pill>
								<Pill>{order.paymentStatus}</Pill>
							</div>
						</button>
					))}

					{totalPages > 1 ? (
						<div className="flex items-center justify-between gap-3 pt-1">
							<button
								type="button"
								onClick={() => setPage((p) => Math.max(0, p - 1))}
								disabled={currentPage === 0}
								className="min-h-9 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 disabled:opacity-40"
							>
								Previous
							</button>
							<p className="text-xs font-semibold text-slate-500">
								{currentPage + 1} / {totalPages}
							</p>
							<button
								type="button"
								onClick={() =>
									setPage(() => Math.min(totalPages - 1, currentPage + 1))
								}
								disabled={currentPage >= totalPages - 1}
								className="min-h-9 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 disabled:opacity-40"
							>
								Next
							</button>
						</div>
					) : null}
				</>
			) : (
				<EmptyState
					title="No orders yet"
					text="Your verified orders will appear here."
				/>
			)}
		</div>
	);
}

function VendorsPanel({ data }: { data: CustomerHubData }) {
	return (
		<div className="grid gap-3">
			{data.vendors.length > 0 ? (
				data.vendors.map((vendor) => (
					<div
						key={vendor.slug}
						className="rounded-2xl border border-slate-100 bg-white p-4"
					>
						<p className="text-xs md:text-sm font-black text-slate-950">
							{vendor.name}
						</p>
						<p className="mt-1 text-xs font-semibold text-slate-500">
							{vendor.orders} orders · {vendor.reservations} reservations
						</p>
					</div>
				))
			) : (
				<EmptyState
					title="No vendors yet"
					text="Restaurants you order from will show here."
				/>
			)}
		</div>
	);
}

function RewardsPanel({ data }: { data: CustomerHubData }) {
	return (
		<div className="grid gap-3">
			{data.rewards.length > 0 ? (
				data.rewards.map((reward) => (
					<div
						key={reward.id}
						className="rounded-2xl border border-slate-100 bg-white p-4"
					>
						<p className="text-xs md:text-sm font-black text-slate-950">
							{reward.title}
						</p>
						<p className="mt-1 text-xs font-semibold text-slate-500">
							{reward.description}
						</p>
					</div>
				))
			) : (
				<EmptyState
					title="No rewards yet"
					text="Vendor rewards will appear here when restaurants enable them."
				/>
			)}
		</div>
	);
}

function ProfilePanel({
	identifier,
	profile,
	onSaved,
}: {
	identifier: string;
	profile: CustomerHubData["profile"];
	onSaved: (profile: CustomerHubData["profile"]) => void;
}) {
	const [loading, setLoading] = useState(false);
	const [saved, setSaved] = useState(false);
	const [error, setError] = useState("");

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setLoading(true);
		setSaved(false);
		setError("");
		const formData = new FormData(event.currentTarget);

		try {
			const updatedProfile = await updateCustomerProfileAction({
				identifier,
				fullName: String(formData.get("fullName") ?? ""),
				whatsappNumber: String(formData.get("whatsappNumber") ?? ""),
				alternativePhone: String(formData.get("alternativePhone") ?? ""),
				email: String(formData.get("email") ?? ""),
				deliveryAddress: String(formData.get("deliveryAddress") ?? ""),
			});
			onSaved(updatedProfile);
			setSaved(true);
		} catch (profileError) {
			setError(
				profileError instanceof Error
					? profileError.message
					: "Unable to save profile.",
			);
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="grid gap-3">
			<ProfileField
				name="fullName"
				label="Full name"
				defaultValue={profile.fullName}
			/>
			<ProfileField
				name="whatsappNumber"
				label="WhatsApp number"
				defaultValue={profile.whatsappNumber}
			/>
			<ProfileField
				name="alternativePhone"
				label="Alternative phone"
				defaultValue={profile.alternativePhone}
			/>
			<ProfileField
				name="email"
				label="Email address"
				defaultValue={profile.email}
			/>
			<label className="grid gap-2 text-xs md:text-sm font-black text-slate-700">
				Delivery address
				<textarea
					name="deliveryAddress"
					defaultValue={profile.deliveryAddress ?? ""}
					rows={3}
					className="rounded-xl border border-slate-200 px-3 py-2 text-base font-semibold outline-none focus:border-emerald-700"
				/>
			</label>
			<ErrorMessage message={error} />
			{saved ? (
				<p className="inline-flex items-center gap-2 text-xs md:text-sm font-black text-emerald-700">
					<Check className="size-3.5 md:size-4" />
					Profile saved
				</p>
			) : null}
			<button
				type="submit"
				disabled={loading}
				className="min-h-12 rounded-xl bg-emerald-700 px-4 text-xs md:text-sm font-black text-white disabled:opacity-60"
			>
				{loading ? "Saving..." : "Save profile"}
			</button>
		</form>
	);
}

function CustomerOrderModal({
	order,
	onClose,
}: {
	order: CustomerOrder;
	onClose: () => void;
}) {
	const total = Number(order.total);
	const subtotal = useMemo(
		() =>
			order.items.reduce(
				(sum, item) => sum + Number(item.unitPrice) * item.qty,
				0,
			),
		[order.items],
	);

	return (
		<div className="fixed inset-0 z-[130] grid place-items-center bg-slate-950/50 p-4">
			<section className="max-h-[86vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-4 shadow-2xl">
				<div className="flex items-start justify-between gap-3">
					<div>
						<p className="text-xs font-black uppercase tracking-wide text-emerald-700">
							{order.restaurant.name}
						</p>
						<h3 className="mt-1 text-sm md:text-xl font-black text-slate-950">
							Order #{order.id.slice(-6).toUpperCase()}
						</h3>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="grid size-9 place-items-center rounded-xl border border-slate-200 text-slate-500"
					>
						<X className="size-4" />
					</button>
				</div>
				<div className="mt-4 grid grid-cols-2 gap-3">
					<SummaryCard label="Status" value={orderStatusLabel(order)} />
					<SummaryCard label="Payment" value={order.paymentStatus} />
				</div>
				{order.status === "CANCELLED" && order.cancellationNote ? (
					<div className="mt-3 rounded-2xl bg-red-50 p-3 text-xs md:text-sm font-semibold text-red-900">
						<p className="text-xs font-black uppercase tracking-wide text-red-700">
							Decline reason
						</p>
						<p className="mt-1">{order.cancellationNote}</p>
						<div className="mt-3 grid gap-1 rounded-xl bg-white/70 p-3 text-xs md:text-sm font-bold leading-6">
							<p>Phone: {order.restaurant.phone ?? "Not provided"}</p>
							<p>Address: {order.restaurant.address ?? "Not provided"}</p>
						</div>
					</div>
				) : null}
				{order.status !== "CANCELLED" && order.statusNote ? (
					<div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-xs md:text-sm font-semibold text-emerald-900">
						{order.statusNote}
					</div>
				) : null}
				<div className="mt-4 grid gap-2">
					{order.items.map((item) => (
						<div
							key={item.id}
							className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-3"
						>
							<div>
								<p className="text-xs md:text-sm font-black text-slate-950">
									{item.name} x{item.qty}
								</p>
								{item.notes ? (
									<p className="mt-1 text-xs font-semibold text-slate-500">
										{item.notes}
									</p>
								) : null}
							</div>
							<p className="text-xs md:text-sm font-black text-emerald-700">
								{formatMoney(
									Number(item.unitPrice) * item.qty,
									order.restaurant.currency,
								)}
							</p>
						</div>
					))}
				</div>
				<div className="mt-4 flex items-center justify-between border-slate-100 border-t pt-4">
					<span className="text-xs md:text-sm font-black text-slate-600">
						Subtotal
					</span>
					<span className="text-xs md:text-sm font-black text-slate-950">
						{formatMoney(subtotal, order.restaurant.currency)}
					</span>
				</div>
				<div className="mt-2 flex items-center justify-between">
					<span className="text-xs md:text-sm font-black text-slate-600">
						Total
					</span>
					<span className="text-lg md:text-xl font-black text-emerald-700">
						{formatMoney(total, order.restaurant.currency)}
					</span>
				</div>
			</section>
		</div>
	);
}

function CustomerBottomNav({
	activeTab,
	onChange,
}: {
	activeTab: ActiveTab;
	onChange: (tab: ActiveTab) => void;
}) {
	const tabs: Array<{
		value: ActiveTab;
		label: string;
		icon: React.ReactNode;
	}> = [
		{
			value: "orders",
			label: "Orders",
			icon: <ClipboardList className="size-5" />,
		},
		{
			value: "vendors",
			label: "Vendors",
			icon: <BriefcaseBusiness className="size-5" />,
		},
		{
			value: "rewards",
			label: "Rewards",
			icon: <BadgePercent className="size-5" />,
		},
		{
			value: "profile",
			label: "Profile",
			icon: <UserRound className="size-5" />,
		},
	];

	return (
		<nav className="absolute inset-x-0 bottom-0 border-slate-100 border-t bg-white px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
			<div className="grid grid-cols-4 gap-1">
				{tabs.map((tab) => (
					<button
						key={tab.value}
						type="button"
						onClick={() => onChange(tab.value)}
						className={cn(
							"grid min-h-14 place-items-center rounded-2xl px-1 text-xs font-black text-slate-500",
							activeTab === tab.value && "bg-emerald-50 text-emerald-700",
						)}
					>
						{tab.icon}
						<span>{tab.label}</span>
					</button>
				))}
			</div>
		</nav>
	);
}

function SegmentButton({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs md:text-sm font-black",
				active
					? "bg-white text-emerald-700 shadow-sm"
					: "text-slate-500 hover:text-slate-700",
			)}
		>
			{children}
		</button>
	);
}

function ProfileField({
	name,
	label,
	defaultValue,
}: {
	name: string;
	label: string;
	defaultValue: string | null;
}) {
	return (
		<label className="grid gap-2 text-xs md:text-sm font-black text-slate-700">
			{label}
			<input
				name={name}
				defaultValue={defaultValue ?? ""}
				className="min-h-12 rounded-xl border border-slate-200 px-3 text-base font-semibold outline-none focus:border-emerald-700"
			/>
		</label>
	);
}

function Pill({ children }: { children: React.ReactNode }) {
	return (
		<span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-600">
			{children}
		</span>
	);
}

function SummaryCard({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-2xl bg-slate-50 p-3">
			<p className="text-xs font-black text-slate-500">{label}</p>
			<p className="mt-1 text-xs md:text-sm font-black text-slate-950">
				{value}
			</p>
		</div>
	);
}

function EmptyState({ title, text }: { title: string; text: string }) {
	return (
		<div className="rounded-3xl border border-dashed border-slate-200 p-8 text-center">
			<p className="text-sm md:text-base font-black text-slate-950">{title}</p>
			<p className="mt-2 text-xs md:text-sm font-semibold text-slate-500">
				{text}
			</p>
		</div>
	);
}

function ErrorMessage({ message }: { message: string }) {
	if (!message) return null;
	return (
		<p className="rounded-xl bg-red-50 p-3 text-xs md:text-sm font-black text-red-700">
			{message}
		</p>
	);
}
