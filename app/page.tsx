import {
	ArrowRight,
	BarChart3,
	CalendarDays,
	MessageCircle,
	QrCode,
	Settings2,
	Smartphone,
} from "lucide-react";
import Link from "next/link";
import { MarketingBottomNav } from "@/components/marketing/MarketingBottomNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { ScrollRevealAnimations } from "@/components/marketing/ScrollRevealAnimations";
import { PublicPricingPlans } from "@/components/pricing/PublicPricingPlans";
import { db } from "@/lib/db";

const HERO_VIDEO_URL_DESKTOP =
	"https://res.cloudinary.com/dfqd7dek9/video/upload/v1785244680/Smartphones_showing_restaurant_m__202607281415_esqcf1.mp4";
const HERO_VIDEO_URL_MOBILE =
	"https://res.cloudinary.com/dfqd7dek9/video/upload/v1785334493/Vertical_mobile_aspect_ra_ohcgdy.mp4";

type LandingPlan = {
	id: string;
	tier: string;
	name: string;
	description: string | null;
	monthlyPrice: unknown;
	quarterlyPrice: unknown;
	yearlyPrice: unknown;
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
			quarterlyPrice: true,
			yearlyPrice: true,
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
		<>
			<main className="min-h-screen bg-white pb-24 text-zinc-950 md:pb-0">
				<section className="relative flex min-h-screen flex-col overflow-hidden bg-[#02170d] text-white">
					<video
						className="hero-bg-video absolute inset-0 size-full object-cover md:hidden"
						autoPlay
						loop
						muted
						playsInline
						preload="auto"
					>
						<source src={HERO_VIDEO_URL_MOBILE} type="video/mp4" />
					</video>
					<video
						className="hero-bg-video absolute inset-0 hidden size-full object-cover md:block"
						autoPlay
						muted
						playsInline
						preload="auto"
					>
						<source src={HERO_VIDEO_URL_DESKTOP} type="video/mp4" />
					</video>
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 bg-[#02170d]/72"
					/>
					<div className="hero-anim-nav relative">
						<MarketingHeader variant="dark" />
					</div>

					<div className="relative mx-auto flex w-full max-w-6xl flex-1 items-center px-4 sm:px-6 lg:px-8">
						<div>
							<p className="hero-anim-eyebrow text-xs font-black uppercase tracking-[0.24em] text-yellow-300 sm:text-sm">
								Digital menus come first
							</p>
							<h1 className="hero-anim-title mt-4 max-w-2xl text-4xl font-black leading-[1.03] tracking-tight text-white sm:text-xl lg:text-7xl">
								Your restaurant menu,{" "}
								<span className="text-yellow-300">online in minutes.</span>
							</h1>
							<div className="hero-anim-ctas mt-7 flex flex-col gap-3 sm:flex-row">
								{/* <Link
									href="/signup?plan=free"
									className="inline-flex h-12 items-center justify-center rounded-full bg-yellow-400 px-7 text-sm font-bold text-emerald-950 shadow-[0_16px_35px_rgba(250,204,21,0.24)] transition-colors hover:bg-yellow-300 sm:h-14 sm:text-base"
								>
									Get Started for Free
								</Link> */}
								<Link
									href="/pricing"
									className="inline-flex h-12 items-center justify-center gap-3 rounded-full border border-white/18 bg-white/10 px-7 text-sm font-bold text-white transition-colors hover:bg-white/15 sm:h-14 sm:gap-4 sm:text-base"
								>
									View Plans
									<ArrowRight className="size-5" aria-hidden="true" />
								</Link>
							</div>
						</div>
					</div>
					<div className="relative mx-auto hidden w-full max-w-6xl px-4 pb-8 sm:px-6 md:block lg:px-8">
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
						<div className="scroll-anim-heading mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
							<p className="inline-flex min-h-10 items-center rounded-full bg-white px-5 text-sm font-black text-emerald-700">
								AwaMenu Features
							</p>
							<h2 className="mt-4 text-2xl font-black leading-tight tracking-tight text-emerald-950 sm:text-5xl">
								Everything you need to manage and share your menu
							</h2>
						</div>
						<div className="scroll-anim-card-group mt-8 flex snap-x gap-4 overflow-x-auto px-4 pb-3 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-6 md:grid-cols-2 lg:grid-cols-3 lg:px-8">
							{featureCards.map((feature) => {
								const Icon = feature.icon;

								return (
									<div
										key={feature.title}
										className="scroll-anim-card w-[82vw] shrink-0 snap-center overflow-hidden rounded-[1.75rem] bg-white p-2 shadow-[0_18px_50px_rgba(6,78,59,0.08)] sm:w-auto"
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
						<div className="scroll-anim-heading mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
							<p className="text-sm font-black uppercase tracking-widest text-emerald-700">
								Pricing
							</p>
							<h2 className="mt-3 text-3xl font-black tracking-tight text-emerald-950 sm:text-5xl">
								Choose a plan and launch today.
							</h2>
						</div>
						<div className="scroll-anim-card-group mt-8 px-4 sm:px-6 lg:px-8">
							<PublicPricingPlans
								compact
								plans={plans.map((plan) => ({
									id: plan.id,
									tier: plan.tier,
									name: plan.name,
									description: plan.description,
									monthlyPrice: Number(plan.monthlyPrice),
									quarterlyPrice: Number(plan.quarterlyPrice),
									yearlyPrice: Number(plan.yearlyPrice),
									features: planFeatures(plan),
								}))}
							/>
						</div>
					</div>
				</section>
			</main>
			<ScrollRevealAnimations />
			<MarketingFooter />
			<MarketingBottomNav />
		</>
	);
}
