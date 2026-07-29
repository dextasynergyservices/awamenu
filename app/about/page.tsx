import { Heart, MapPin, Smartphone, Zap } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MarketingBottomNav } from "@/components/marketing/MarketingBottomNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";

export const metadata: Metadata = {
	title: "About — AwaMenu",
	description: "What AwaMenu is and why we built it.",
};

const values = [
	{
		icon: Smartphone,
		title: "Mobile-first",
		description:
			"Built for the phone in your customer's hand, not a desktop screen.",
	},
	{
		icon: Zap,
		title: "Live in minutes",
		description: "Scan a QR code, browse the menu, order — no app to download.",
	},
	{
		icon: MapPin,
		title: "Made for Nigeria",
		description:
			"Pricing, currency, and payments built around local restaurants.",
	},
];

export default function AboutPage() {
	return (
		<>
			<main className="min-h-screen bg-[#f6faf7] pt-2 pb-24 text-slate-950 md:pb-8">
				<MarketingHeader variant="light" />

				<div className="mx-auto max-w-6xl px-4 pt-6 sm:pt-8 lg:px-8">
					<div className="mx-auto max-w-2xl text-center">
						<p className="text-xs font-black uppercase tracking-widest text-emerald-700">
							About AwaMenu
						</p>
						<h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
							Every restaurant deserves a great digital menu
						</h1>
						<p className="mt-3 text-sm font-medium leading-relaxed text-slate-600 sm:text-base">
							AwaMenu gives restaurants a branded digital menu, QR code, online
							ordering, and staff tools — without needing their own website or
							developer.
						</p>
					</div>

					<div className="mx-auto mt-8 grid gap-4 sm:grid-cols-3">
						{values.map((value) => (
							<section
								key={value.title}
								className="flex items-start gap-4 rounded-[2rem] border border-slate-100 bg-white p-5 shadow-[0_12px_34px_rgba(15,23,42,0.05)] sm:flex-col sm:items-start sm:gap-3"
							>
								<div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
									<value.icon className="size-5" aria-hidden="true" />
								</div>
								<div>
									<h2 className="font-black text-slate-950">{value.title}</h2>
									<p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">
										{value.description}
									</p>
								</div>
							</section>
						))}
					</div>

					<section className="mx-auto mt-8 max-w-lg rounded-[2rem] border border-slate-100 bg-white p-6 text-center shadow-[0_12px_34px_rgba(15,23,42,0.05)]">
						<div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
							<Heart className="size-5" aria-hidden="true" />
						</div>
						<h2 className="mt-3 font-black text-slate-950">Get in touch</h2>
						<p className="mt-1 text-sm font-medium text-slate-600">
							Questions, feedback, or partnership ideas — we&apos;d love to hear
							from you.
						</p>
						<a
							href="mailto:hello@awamenu.com"
							className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
						>
							hello@awamenu.com
						</a>
					</section>

					<div className="mx-auto mt-6 grid max-w-lg gap-2 sm:grid-cols-2">
						<Link
							href="/pricing"
							className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700"
						>
							View pricing
						</Link>
						<Link
							href="/signup"
							className="inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
						>
							Get started free
						</Link>
					</div>
				</div>
			</main>
			<MarketingFooter />
			<MarketingBottomNav />
		</>
	);
}
