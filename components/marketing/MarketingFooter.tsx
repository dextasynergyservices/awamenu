import Link from "next/link";

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
};

export function MarketingFooter() {
	return (
		<footer className="hidden bg-[#02170d] text-white md:block">
			<div className="mx-auto max-w-6xl px-6 py-12 lg:px-8">
				<div className="grid gap-10 md:grid-cols-[1.2fr_1fr_1fr]">
					<div>
						<Link
							href="/"
							className="text-2xl font-black italic tracking-tight text-yellow-300"
						>
							AwaMenu
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
