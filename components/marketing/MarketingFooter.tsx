import Image from "next/image";
import Link from "next/link";
import { LOGO_DESKTOP_URL } from "@/lib/logo";

const footerLinks: Record<string, { label: string; href: string }[]> = {
	Product: [
		{ label: "Pricing", href: "/pricing" },
		{ label: "Get Started", href: "/signup" },
		{ label: "Login", href: "/login" },
	],
	Company: [
		{ label: "Home", href: "/" },
		{ label: "About", href: "/about" },
	],
	Legal: [
		{ label: "Privacy Policy", href: "/privacy" },
		{ label: "Terms of Service", href: "/terms" },
		{ label: "Refund Policy", href: "/refunds" },
	],
};

const legalLinks = footerLinks.Legal;

export function MarketingFooter() {
	return (
		<footer className="bg-[#02170d] text-white">
			{/* Mobile: the bottom nav covers navigation, so only the legal links show. */}
			<div className="flex flex-wrap justify-center gap-x-4 gap-y-2 px-4 pt-6 pb-28 text-xs font-bold text-white/70 md:hidden">
				{legalLinks.map((link) => (
					<Link
						key={link.href}
						href={link.href}
						className="hover:text-yellow-300"
					>
						{link.label}
					</Link>
				))}
				<span className="w-full text-center font-medium text-white/50">
					© {new Date().getFullYear()} AwaMenu
				</span>
			</div>
			<div className="mx-auto hidden max-w-6xl px-6 py-12 md:block lg:px-8">
				<div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr_1fr]">
					<div>
						<Link href="/" className="inline-block">
							<Image
								src={LOGO_DESKTOP_URL}
								alt="AwaMenu"
								width={240}
								height={31}
								className="h-8 w-auto"
							/>
						</Link>
						<p className="mt-3 max-w-xs text-sm font-medium leading-6 text-white/70">
							Your restaurant menu, online in minutes — QR menus, ordering, and
							reservations for restaurants.
						</p>
					</div>
					{Object.entries(footerLinks).map(([section, links]) => (
						<div key={section}>
							<p className="text-xs font-black uppercase tracking-widest text-yellow-300">
								{section}
							</p>
							<ul className="mt-4 grid gap-3 text-sm font-bold text-white/80">
								{links.map((link) => (
									<li key={link.href}>
										<Link href={link.href} className="hover:text-yellow-300">
											{link.label}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
				<div className="mt-10 border-t border-white/10 pt-6 text-xs font-medium text-white/50">
					© {new Date().getFullYear()} AwaMenu. All rights reserved.
				</div>
			</div>
		</footer>
	);
}
