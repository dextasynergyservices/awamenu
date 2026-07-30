import type { Metadata } from "next";
import { Montserrat, Open_Sans, Roboto } from "next/font/google";
import "./globals.css";
import { PosthogProvider } from "@/components/shared/PosthogProvider";
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

export const metadata: Metadata = {
	title: "AwaMenu — Restaurant Management",
	description:
		"Modern restaurant menu management, ordering, and reservation platform.",
	manifest: "/manifest.webmanifest",
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
			<head>
				<meta name="theme-color" content="#047857" />
			</head>
			<body className="min-h-full flex flex-col">
				<PosthogProvider />
				{children}
			</body>
		</html>
	);
}
