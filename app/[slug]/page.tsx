import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BannerSlider } from "@/components/menu/BannerSlider";
import { CartDrawer } from "@/components/menu/CartDrawer";
import { DesktopPublicMenu } from "@/components/menu/DesktopPublicMenu";
import { OrderLookupForm } from "@/components/menu/OrderLookupForm";
import {
	type MenuGridTemplate,
	PublicMenuContent,
} from "@/components/menu/PublicMenuContent";
import { PublicMenuNavbar } from "@/components/menu/PublicMenuNavbar";
import { SubscriptionInactive } from "@/components/menu/SubscriptionInactive";
import { bannerRecordToItem } from "@/lib/banners";
import { db } from "@/lib/db";
import { isSubscriptionActive } from "@/lib/subscription";

type PublicMenuPageProps = {
	params: Promise<{ slug: string }>;
	searchParams?: Promise<{ orderId?: string }>;
};

export async function generateMetadata({
	params,
}: PublicMenuPageProps): Promise<Metadata> {
	const { slug } = await params;
	const restaurant = await db.restaurant.findFirst({
		where: { slug, isActive: true },
		select: { name: true, description: true },
	});

	if (!restaurant) return {};

	return {
		title: `${restaurant.name} Menu | AwaMenu`,
		description: restaurant.description ?? `Browse ${restaurant.name}'s menu.`,
	};
}

export default async function PublicMenuPage({
	params,
	searchParams,
}: PublicMenuPageProps) {
	const { slug } = await params;
	const { orderId } = (await searchParams) ?? {};
	const restaurant = await db.restaurant.findFirst({
		where: { slug, isActive: true },
		select: {
			name: true,
			description: true,
			logoUrl: true,
			currency: true,
			whatsappNumber: true,
			tableReservationEnabled: true,
			activeTemplate: true,
			subscription: {
				select: {
					status: true,
					currentPeriodEnd: true,
					plan: {
						select: { removeAwamenuBranding: true },
					},
				},
			},
			categories: {
				where: { isActive: true },
				orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
				select: {
					id: true,
					name: true,
					emoji: true,
					items: {
						where: { isAvailable: true },
						orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
						select: {
							id: true,
							name: true,
							description: true,
							price: true,
							imageUrl: true,
						},
					},
				},
			},
			banners: {
				where: { isActive: true },
				orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
				select: {
					id: true,
					imageUrl: true,
					title: true,
					subtitle: true,
					sortOrder: true,
					isActive: true,
				},
			},
		},
	});

	if (!restaurant) notFound();

	if (!isSubscriptionActive(restaurant.subscription)) {
		return <SubscriptionInactive restaurantName={restaurant.name} />;
	}

	const categories = restaurant.categories.map((category) => ({
		...category,
		items: category.items.map((item) => ({
			...item,
			price: Number(item.price),
		})),
	}));
	const showAwamenuBranding =
		!restaurant.subscription?.plan.removeAwamenuBranding;
	const bannerItems = restaurant.banners.map(bannerRecordToItem);
	const validTemplates: MenuGridTemplate[] = [
		"classic",
		"grid",
		"compact",
		"magazine",
	];
	const template = validTemplates.includes(
		restaurant.activeTemplate as MenuGridTemplate,
	)
		? (restaurant.activeTemplate as MenuGridTemplate)
		: "classic";

	return (
		<main className="min-h-screen bg-white text-slate-950">
			<PublicMenuNavbar
				name={restaurant.name}
				logoUrl={restaurant.logoUrl}
				mode="mobile"
				restaurantSlug={slug}
			/>

			<div className="md:hidden">
				<BannerSlider name={restaurant.name} bannerItems={bannerItems} />
				<OrderLookupForm restaurantSlug={slug} />

				<PublicMenuContent
					categories={categories}
					restaurantSlug={slug}
					currency={restaurant.currency}
					template={template}
				/>
			</div>

			<DesktopPublicMenu
				name={restaurant.name}
				logoUrl={restaurant.logoUrl}
				bannerItems={bannerItems}
				categories={categories}
				restaurantSlug={slug}
				currency={restaurant.currency}
				appendOrderId={orderId}
				tableReservationEnabled={restaurant.tableReservationEnabled}
			/>

			{showAwamenuBranding ? (
				<footer className="border-emerald-100 border-t bg-white px-4 py-6 text-center text-sm font-bold text-slate-500 md:hidden">
					Powered by <span className="text-emerald-700">AwaMenu</span>
				</footer>
			) : null}

			{restaurant.tableReservationEnabled ? (
				<Link
					href={`/${slug}/tables`}
					className="fixed right-4 bottom-4 left-4 z-20 inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-700 px-4 text-sm font-black text-white shadow-[0_14px_35px_rgba(4,120,87,0.25)] md:hidden"
				>
					Reserve table
				</Link>
			) : null}

			<div className="md:hidden">
				<CartDrawer
					currency={restaurant.currency}
					restaurantSlug={slug}
					appendOrderId={orderId}
				/>
			</div>
		</main>
	);
}
