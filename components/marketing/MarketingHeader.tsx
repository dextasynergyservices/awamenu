import Image from "next/image";
import Link from "next/link";
import { MarketingAuthCta } from "@/components/marketing/MarketingAuthCta";
import { LOGO_DESKTOP_URL, LOGO_ICON_URL } from "@/lib/logo";
import { cn } from "@/lib/utils";

const navLinks = [
	{ label: "Home", href: "/" },
	{ label: "Pricing", href: "/pricing" },
	{ label: "About", href: "/about" },
];

type MarketingHeaderProps = {
	/** "dark" — sits on the homepage's dark hero. "light" — sits on a plain light page. */
	variant?: "dark" | "light";
};

export function MarketingHeader({ variant = "light" }: MarketingHeaderProps) {
	const isDark = variant === "dark";

	return (
		<header className="relative px-4 pt-3 sm:px-6 sm:pt-4 lg:px-8">
			<div
				className={cn(
					"mx-auto flex h-14 max-w-6xl items-center justify-between rounded-full px-4 sm:h-16 sm:px-6",
					isDark
						? "border border-white/10 bg-white/8 shadow-[0_24px_70px_rgba(0,0,0,0.18)] backdrop-blur"
						: "border border-slate-100 bg-white shadow-[0_12px_34px_rgba(15,23,42,0.05)]",
				)}
			>
				<Link href="/" className="flex items-center">
					<Image
						src={LOGO_ICON_URL}
						alt="AwaMenu"
						width={40}
						height={40}
						className="size-9 shrink-0 rounded-lg object-contain sm:hidden"
						priority
						loading="eager"
					/>
					<Image
						src={LOGO_DESKTOP_URL}
						alt="AwaMenu"
						width={240}
						height={31}
						className="hidden h-8 w-auto sm:block"
						priority
						loading="eager"
					/>
				</Link>
				<nav
					className={cn(
						"hidden items-center gap-7 text-sm font-bold md:flex",
						isDark ? "text-white/80" : "text-slate-600",
					)}
				>
					{navLinks.map((link) => (
						<Link
							key={link.href}
							href={link.href}
							className={
								isDark ? "hover:text-yellow-300" : "hover:text-emerald-700"
							}
						>
							{link.label}
						</Link>
					))}
				</nav>
				<div className="flex items-center gap-2">
					<MarketingAuthCta
						signedOutClassName={cn(
							"hidden h-11 items-center justify-center rounded-full px-5 text-sm font-bold sm:inline-flex",
							isDark
								? "bg-white/10 text-white hover:bg-white/15"
								: "border border-slate-200 text-slate-700 hover:bg-slate-50",
						)}
					/>
					<Link
						href="/signup?plan=free"
						className="inline-flex h-11 items-center justify-center rounded-full bg-yellow-400 px-4 text-sm font-bold text-emerald-950 transition-colors hover:bg-yellow-300"
					>
						Get Started
					</Link>
				</div>
			</div>
		</header>
	);
}
