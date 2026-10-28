import type { Metadata, Viewport } from "next";
import { Montserrat, Open_Sans, Roboto } from "next/font/google";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import "./globals.css";
import { PosthogProvider } from "@/components/shared/PosthogProvider";
import { env } from "@/env";
import { LOGO_ICON_URL } from "@/lib/logo";
import { cn } from "@/lib/utils";

const montserrat = Montserrat({
	subsets: ["latin"],
	variable: "--font-montserrat",
	display: "swap",
});

const roboto = Roboto({
	subsets: ["latin"],
	variable: "--font-roboto",
	display: "swap",
});

const openSans = Open_Sans({
	subsets: ["latin"],
	variable: "--font-open-sans",
	display: "swap",
});

/** viewport-fit=cover lets the app bars and tab bars pad for the notch and
 *  home indicator (env(safe-area-inset-*) is 0 without it). */
export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	themeColor: "#047857",
};

export const metadata: Metadata = {
	// Absolute URLs for link previews (og:image) and canonical links.
	metadataBase: new URL(env.NEXT_PUBLIC_APP_URL ?? "https://awamenu.com"),
	title: "AwaMenu — Restaurant Management",
	description:
		"Modern restaurant menu management, ordering, and reservation platform.",
	icons: {
		icon: LOGO_ICON_URL,
		shortcut: LOGO_ICON_URL,
		apple: LOGO_ICON_URL,
	},
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "AwaMenu",
	},
	other: {
		"mobile-web-app-capable": "yes",
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={cn(
				"h-full",
				"antialiased",
				montserrat.variable,
				roboto.variable,
				openSans.variable,
				"font-sans",
			)}
		>
			<body className="min-h-full flex flex-col">
				<PosthogProvider />
				{children}
				<ServiceWorkerRegistrar />
			</body>
		</html>
	);
}
