"use client";

import {
	CreditCard,
	LayoutDashboard,
	LogOut,
	Store,
	Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LoadingButton } from "@/components/ui/action-button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const navItems = [
	{ label: "Overview", href: "", icon: LayoutDashboard },
	{ label: "Restaurants", href: "/restaurants", icon: Store },
	{ label: "Plans", href: "/plans", icon: CreditCard },
	{ label: "Users", href: "/users", icon: Users },
];

export function SuperAdminShell({
	adminName,
	children,
}: {
	adminName: string;
	children: React.ReactNode;
}) {
	const pathname = usePathname();
	const router = useRouter();
	const [isLoggingOut, setIsLoggingOut] = useState(false);
	const basePath = "/super-admin";

	async function handleLogout() {
		setIsLoggingOut(true);
		await authClient.signOut();
		router.push("/login");
		router.refresh();
	}

	return (
		<div className="min-h-screen bg-white text-[#10182f]">
			<aside className="fixed top-0 left-0 z-40 hidden h-screen w-[264px] flex-col border-emerald-100 border-r bg-white md:flex">
				<div className="px-6 pt-8 pb-7">
					<Link href={basePath} className="text-xl font-black text-slate-950">
						AwaMenu <span className="text-emerald-700">Admin</span>
					</Link>
				</div>
				<nav className="grid gap-2 px-4">
					{navItems.map((item) => {
						const href = `${basePath}${item.href}`;
						const Icon = item.icon;
						const isActive =
							pathname === href ||
							(item.href !== "" && pathname.startsWith(href));

						return (
							<Link
								key={item.label}
								href={href}
								className={cn(
									"flex min-h-13 items-center gap-4 rounded-2xl px-4 text-sm font-black text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800",
									isActive &&
										"bg-emerald-100 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-800",
								)}
							>
								<Icon className="size-5" aria-hidden="true" />
								{item.label}
							</Link>
						);
					})}
				</nav>
				<div className="mt-auto p-5">
					<p className="mb-3 truncate text-xs font-bold text-slate-500">
						{adminName}
					</p>
					<LoadingButton
						type="button"
						onClick={handleLogout}
						loading={isLoggingOut}
						loadingText="Logging out..."
						className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white px-4 text-sm font-black text-red-600 hover:bg-red-50"
					>
						<LogOut className="size-4" aria-hidden="true" />
						Logout
					</LoadingButton>
				</div>
			</aside>
			<div className="min-w-0 max-w-full pt-4 pb-10 md:ml-[264px] md:pt-8">
				<main className="px-4 md:px-8">{children}</main>
			</div>
		</div>
	);
}
