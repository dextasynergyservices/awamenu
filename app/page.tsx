import {
	ArrowRight,
	BarChart3,
	CalendarDays,
	Check,
	Clock,
	MapPin,
	MessageCircle,
	Plus,
	QrCode,
	Search,
	Settings2,
	Share2,
	Smartphone,
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/db";

type LandingPlan = {
	id: string;
	tier: string;
	name: string;
	description: string | null;
	monthlyPrice: unknown;
	maxCategories: number;
	maxMenuItems: number;
	advancedAnalytics: boolean;
	removeAwamenuBranding: boolean;
	whatsappIntegration: boolean;
	prioritySupport: boolean;
	basicSupport: boolean;
};

const featureCards = [
	{
		title: "Beautiful digital menus",
		description:
			"Create mobile-friendly menus customers can scan and view instantly.",
		icon: Smartphone,
		tone: "bg-yellow-300/90 text-emerald-950",
	},
	{
		title: "Menu links & QR codes",
		description: "Share your menu through QR codes, direct links, and socials.",
		icon: QrCode,
		tone: "bg-emerald-600 text-white",
	},
	{
		title: "WhatsApp click-to-chat",
		description:
			"Customers can reach you on WhatsApp with one tap — no extra apps needed.",
		icon: MessageCircle,
		tone: "bg-lime-200 text-emerald-950",
	},
	{
		title: "Menu controls",
		description:
			"Update prices, availability, categories, and item details anytime.",
		icon: Settings2,
		tone: "bg-yellow-100 text-emerald-950",
	},
	{
		title: "Payments & reservations",
		description:
			"Support online ordering, dine-in flows, and table reservations.",
		icon: CalendarDays,
		tone: "bg-emerald-100 text-emerald-950",
	},
	{
		title: "Admin insights",
		description: "Track menu activity and manage staff from your dashboard.",
		icon: BarChart3,
		tone: "bg-white text-emerald-950",
	},
];

const menuItems = [
	{
		name: "Fried Rice & Chicken",
		description: "A well-balanced dish suitable for everyday dining.",
		price: "₦7,000",
		image: "bg-yellow-300",
	},
	{
		name: "Pasta spaghetti with sauce",
		description: "Classic pasta with minced beef and peppers.",
		price: "₦5,900",
		image: "bg-emerald-200",
	},
];

function formatLimit(value: number, label: string) {
	return value === -1 ? `Unlimited ${label}` : `${value} ${label}`;
}

function planFeatures(plan: LandingPlan) {
	return [
		formatLimit(plan.maxCategories, "Categories"),
		formatLimit(plan.maxMenuItems, "Items"),
		plan.whatsappIntegration ? "WhatsApp included" : "WhatsApp not included",
		plan.advancedAnalytics ? "Advanced Analytics" : "Basic Analytics",
		plan.removeAwamenuBranding ? "Remove Branding" : "AwaMenu branding shown",
		plan.prioritySupport
			? "Priority Support"
			: plan.basicSupport
				? "Basic Support"
				: "Standard Support",
	];
}

function PhonePreview() {
	return (
		<div className="relative mx-auto w-[min(245px,68vw)] md:w-[min(300px,76vw)]">
			<div className="rounded-[2.25rem] border-[6px] border-emerald-950 bg-emerald-950 p-1.5 shadow-[0_30px_80px_rgba(6,78,59,0.28)] md:rounded-[2.75rem]">
				<div className="overflow-hidden rounded-[1.85rem] bg-white md:rounded-[2.3rem]">
					<div className="relative h-10 bg-lime-50 md:h-12">
						<div className="absolute left-1/2 top-2 h-5 w-16 -translate-x-1/2 rounded-full bg-zinc-900 md:h-6 md:w-20" />
						<p className="absolute left-4 top-3 text-[11px] font-bold text-zinc-950 md:text-xs">
							09:41
						</p>
					</div>
					<div className="relative h-[72px] bg-emerald-700 md:h-24">
						<div className="absolute right-2 top-2 flex gap-1.5">
							<span className="grid size-6 place-items-center rounded-full bg-white/90 md:size-7">
								<Search className="size-3.5 text-zinc-900" aria-hidden="true" />
							</span>
							<span className="grid size-6 place-items-center rounded-full bg-white/90 md:size-7">
								<Share2 className="size-3.5 text-zinc-900" aria-hidden="true" />
							</span>
						</div>
						<div className="-bottom-7 absolute left-4 grid size-14 place-items-center rounded-full border-[3px] border-white bg-emerald-700 text-sm font-bold text-white md:size-16 md:text-base">
							Awa
						</div>
					</div>
					<div className="px-3 pb-3 pt-8 md:px-4 md:pb-4 md:pt-10">
						<h3 className="text-sm font-bold text-emerald-950 md:text-base">
							Awa Tasty Foods
						</h3>
						<div className="mt-2 grid grid-cols-3 border border-emerald-100 text-[8px] text-zinc-600 md:text-[9px]">
							<div className="p-1.5">
								<span className="font-bold text-emerald-700">Open</span>
								<p>Closes 8:30pm</p>
							</div>
							<div className="border-x border-emerald-100 p-1.5">
								<MapPin
									className="mb-0.5 size-2.5 text-emerald-700"
									aria-hidden="true"
								/>
								<p>Lagos, Nigeria</p>
							</div>
							<div className="p-1.5">
								<Clock
									className="mb-0.5 size-2.5 text-emerald-700"
									aria-hidden="true"
								/>
								<p>20 - 40 mins</p>
							</div>
						</div>
						<div className="mt-2 flex gap-1.5 overflow-hidden text-[10px] font-bold text-emerald-700 md:text-xs">
							<span className="rounded-full bg-emerald-700 px-3 py-1.5 text-white md:px-4">
								All
							</span>
							<span className="rounded-full border border-emerald-600 px-3 py-1.5 md:px-4">
								Main Dish
							</span>
							<span className="rounded-full border border-emerald-600 px-3 py-1.5 md:px-4">
								Grills
							</span>
						</div>
						<div className="mt-2 rounded-xl bg-lime-50 p-2 md:rounded-2xl md:p-3">
							<p className="text-sm font-bold text-emerald-800">Main Dish</p>
							<p className="text-[10px] text-zinc-600 md:text-xs">
								Carefully prepared, hearty meals.
							</p>
							<div className="mt-2 grid gap-2">
								{menuItems.slice(0, 1).map((item) => (
									<div
										key={item.name}
										className="flex gap-2 rounded-xl bg-white p-1.5 shadow-sm"
									>
										<div
											className={`size-11 shrink-0 rounded-lg ${item.image} md:size-14`}
										/>
										<div className="min-w-0 flex-1">
											<p className="truncate text-xs font-bold text-emerald-950">
												{item.name}
											</p>
											<p className="line-clamp-1 text-[10px] text-zinc-500">
												{item.description}
											</p>
										</div>
										<div className="flex flex-col items-end justify-between">
											<p className="text-xs font-bold text-emerald-700">
												{item.price}
											</p>
											<span className="grid size-6 place-items-center rounded-full bg-zinc-100">
												<Plus
													className="size-3.5 text-zinc-900"
													aria-hidden="true"
												/>
											</span>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default async function Home() {
	const plans: LandingPlan[] = await db.plan.findMany({
		where: { isActive: true },
		orderBy: { monthlyPrice: "asc" },
		select: {
			id: true,
			tier: true,
			name: true,
			description: true,
			monthlyPrice: true,
			maxCategories: true,
			maxMenuItems: true,
			advancedAnalytics: true,
			removeAwamenuBranding: true,
			whatsappIntegration: true,
			prioritySupport: true,
			basicSupport: true,
		},
	});

	return (
		<main className="min-h-screen bg-white text-zinc-950">
			<section className="relative overflow-hidden bg-[#02170d] text-white">
				<div
					aria-hidden="true"
					className="pointer-events-none absolute -right-24 -top-28 h-[360px] w-[420px] rotate-[-12deg] rounded-[44%_56%_58%_42%] bg-yellow-300/18 sm:h-[460px] sm:w-[560px]"
				/>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute -left-32 top-32 h-[280px] w-[380px] rotate-[14deg] rounded-[60%_40%_46%_54%] bg-emerald-500/16 sm:h-[360px] sm:w-[520px]"
				/>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute bottom-[-160px] right-[18%] h-[280px] w-[420px] rotate-[8deg] rounded-[48%_52%_42%_58%] bg-lime-300/10 sm:h-[360px] sm:w-[560px]"
				/>
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-0 bg-[#02170d]/42"
				/>
				<header className="relative px-4 pt-3 sm:px-6 sm:pt-4 lg:px-8">
					<div className="mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full border border-white/10 bg-white/8 px-4 shadow-[0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur sm:h-20 sm:px-8">
						<Link
							href="/"
							className="text-xl font-black italic tracking-tight text-yellow-300 sm:text-3xl"
						>
							AwaMenu
						</Link>
						<nav className="hidden items-center gap-7 text-sm font-bold text-white/80 md:flex">
							<Link href="/" className="text-yellow-300">
								Home
							</Link>
							<Link href="#features">Features</Link>
							<Link href="/pricing">Pricing</Link>
							<Link href="/about">About</Link>
						</nav>
						<div className="flex items-center gap-2">
							<Link
								href="/login"
								className="hidden h-12 items-center justify-center rounded-full bg-white/10 px-5 text-sm font-bold text-white sm:inline-flex"
							>
								Login
							</Link>
							<Link
								href="/signup?plan=free"
								className="inline-flex h-11 items-center justify-center rounded-full bg-yellow-400 px-4 text-sm font-bold text-emerald-950 transition-colors hover:bg-yellow-300 sm:h-12 sm:px-7"
							>
								Get Started
							</Link>
						</div>
					</div>
				</header>

				<div className="relative mx-auto grid max-w-6xl gap-6 px-4 pb-6 pt-7 sm:px-6 sm:pt-12 lg:min-h-[560px] lg:grid-cols-[0.96fr_1.04fr] lg:items-center lg:px-8">
					<div className="pb-0 lg:pb-16">
						<p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-300 sm:text-sm">
							Digital menus come first
						</p>
						<h1 className="mt-4 max-w-2xl text-4xl font-black leading-[1.03] tracking-tight text-white sm:text-6xl lg:text-7xl">
							Your restaurant menu,{" "}
							<span className="text-yellow-300">online in minutes.</span>
						</h1>
						<p className="mt-4 max-w-lg text-base font-medium leading-7 text-white/78 sm:text-lg">
							Create your QR menu and start taking orders in minutes.
						</p>
						<div className="mt-6 flex flex-col gap-3 sm:flex-row">
							<Link
								href="/signup?plan=free"
								className="inline-flex h-12 items-center justify-center rounded-full bg-yellow-400 px-7 text-sm font-bold text-emerald-950 shadow-[0_16px_35px_rgba(250,204,21,0.24)] transition-colors hover:bg-yellow-300 sm:h-14 sm:text-base"
							>
								Get Started for Free
							</Link>
							<Link
								href="/pricing"
								className="inline-flex h-12 items-center justify-center gap-3 rounded-full border border-white/18 bg-white/10 px-7 text-sm font-bold text-white transition-colors hover:bg-white/15 sm:h-14 sm:gap-4 sm:text-base"
							>
								View Plans
								<ArrowRight className="size-5" aria-hidden="true" />
							</Link>
						</div>
					</div>
					<div className="self-end pb-6 lg:pb-0">
						<PhonePreview />
					</div>
				</div>
				<div className="relative mx-auto hidden max-w-6xl px-4 pb-8 sm:px-6 md:block lg:px-8">
					<div className="grid gap-3 rounded-[2rem] border border-yellow-300/20 bg-white/8 p-3 shadow-[0_24px_70px_rgba(0,0,0,0.22)] backdrop-blur md:grid-cols-5">
						{[
							"QR menu",
							"WhatsApp chat",
							"Reservations",
							"Staff access",
							"Analytics",
						].map((item) => (
							<div
								key={item}
								className="flex min-h-16 items-center justify-center rounded-2xl border border-white/10 bg-emerald-950/35 px-4 text-sm font-black text-white"
							>
								{item}
							</div>
						))}
					</div>
				</div>
			</section>

			<section id="features" className="bg-white py-10 sm:py-14">
				<div className="mx-auto max-w-6xl">
					<div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
						<p className="inline-flex min-h-10 items-center rounded-full bg-white px-5 text-sm font-black text-emerald-700">
							AwaMenu Features
						</p>
						<h2 className="mt-4 text-2xl font-black leading-tight tracking-tight text-emerald-950 sm:text-5xl">
							Everything you need to manage and share your menu
						</h2>
					</div>
					<div className="mt-8 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
						{featureCards.map((feature) => {
							const Icon = feature.icon;

							return (
								<div
									key={feature.title}
									className="w-[82vw] shrink-0 snap-center overflow-hidden rounded-[1.75rem] bg-white p-2 shadow-[0_18px_50px_rgba(6,78,59,0.08)] sm:w-auto"
								>
									<div
										className={`grid aspect-[1.6] place-items-center rounded-[1.35rem] ${feature.tone}`}
									>
										<div className="grid size-20 place-items-center rounded-full bg-white/22">
											<Icon className="size-10" aria-hidden="true" />
										</div>
									</div>
									<div className="px-3 py-5">
										<h3 className="text-xl font-black leading-6 text-emerald-950">
											{feature.title}
										</h3>
										<p className="mt-3 text-sm leading-6 text-zinc-600">
											{feature.description}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</section>

			<section id="pricing" className="bg-yellow-300 py-10 sm:py-16">
				<div className="mx-auto max-w-6xl">
					<div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
						<p className="text-sm font-black uppercase tracking-widest text-emerald-700">
							Pricing
						</p>
						<h2 className="mt-3 text-3xl font-black tracking-tight text-emerald-950 sm:text-5xl">
							Choose a plan and launch today.
						</h2>
					</div>
					<div className="mt-8 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-6 lg:px-8">
						{plans.map((plan) => (
							<div
								key={plan.id}
								className="flex w-[82vw] min-h-full shrink-0 snap-center flex-col rounded-[2rem] bg-white p-6 shadow-[0_18px_55px_rgba(6,78,59,0.1)] sm:w-auto"
							>
								<h3 className="text-2xl font-black text-emerald-950">
									{plan.name}
								</h3>
								<p className="mt-3 min-h-14 text-sm leading-6 text-zinc-600">
									{plan.description}
								</p>
								<p className="mt-6 text-4xl font-black text-emerald-950">
									₦{Number(plan.monthlyPrice).toLocaleString()}
									<span className="text-base font-bold text-emerald-700">
										/mo
									</span>
								</p>
								<ul className="mt-6 grid gap-3 text-sm font-medium text-zinc-700">
									{planFeatures(plan).map((feature) => (
										<li key={feature} className="flex gap-2">
											<Check
												className="mt-0.5 size-4 shrink-0 text-emerald-700"
												aria-hidden="true"
											/>
											<span>{feature}</span>
										</li>
									))}
								</ul>
								<Link
									href={`/signup?plan=${plan.tier.toLowerCase()}`}
									className="mt-7 inline-flex h-12 items-center justify-center rounded-full bg-emerald-700 px-5 text-sm font-black text-white transition-colors hover:bg-emerald-800 md:mt-auto"
								>
									Choose {plan.name}
								</Link>
							</div>
						))}
					</div>
				</div>
			</section>
		</main>
	);
}
