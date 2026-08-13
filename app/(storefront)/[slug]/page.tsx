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
import { getOpenState } from "@/lib/opening-hours";
import { getRestaurantPlanFeaturesBySlug } from "@/lib/plan-features";
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
			timezone: true,
			openingHours: {
				select: { dayOfWeek: true, opensAt: true, closesAt: true },
			},
			currency: true,
			whatsappNumber: true,
			tableReservationEnabled: true,
			activeTemplate: true,
			// Only the liveness check is needed here now — the actual feature
			// values come from getRestaurantPlanFeaturesBySlug below.
			subscription: {
				select: { status: true, currentPeriodEnd: true },
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

	// Resolved through the shared plan resolver rather than read straight off
	// `subscription.plan`, so a lapsed-but-still-present subscription degrades
	// to Free here exactly like it does everywhere else.
	const planFeatures = await getRestaurantPlanFeaturesBySlug(slug);

	// The item cap is restaurant-wide (matches how the admin editor already
	// enforces it), not per-category — so a downgraded restaurant with one
	// visible category correctly sees up to the full limit there, while a
	// restaurant with multiple visible categories doesn't get the limit
	// multiplied out across each one.
	const maxMenuItems = planFeatures.maxMenuItems;

	// Same rule as the favicon and loading screen: showing the restaurant's own
	// logo is the paid "remove AwaMenu branding" entitlement, so a Free menu
	// carries the AwaMenu mark instead.
	// Evaluated in the restaurant's timezone, not the viewer's — a Lagos menu
	// must read "Closed" at 3am Lagos time however far away the customer is.
	const openState = getOpenState(
		restaurant.openingHours,
		restaurant.timezone ?? "Africa/Lagos",
	);

	const displayLogoUrl = planFeatures.showAwamenuBranding
		? null
		: restaurant.logoUrl;
	const maxCategories = planFeatures.maxCategories;
	let remainingItemBudget = maxMenuItems;

	// The category cap is enforced here too, not just on creation. A restaurant
	// can end up over its limit without ever creating anything — dropping to a
	// cheaper plan, or a super-admin lowering a plan's limit — and in those
	// cases the extra categories are still `isActive`, so without this the
	// public menu would keep serving more than the plan allows.
	const visibleCategories =
		maxCategories < 0
			? restaurant.categories
			: restaurant.categories.slice(0, Math.max(0, maxCategories));

	const categories = visibleCategories
		.map((category) => {
			const items = category.items.map((item) => ({
				...item,
				price: Number(item.price),
			}));
			if (maxMenuItems < 0) return { ...category, items };

			const capped = items.slice(0, Math.max(0, remainingItemBudget));
			remainingItemBudget -= capped.length;
			return { ...category, items: capped };
		})
		.filter((category) => category.items.length > 0);
	const bannerItems = restaurant.banners.map(bannerRecordToItem);
	// Checked against the plan's entitlements, not just "is this a real
	// template" — a restaurant that picked Magazine on Pro and later dropped
	// to Free would otherwise keep rendering a paid layout indefinitely.
	const template = (planFeatures.availableTemplates as string[]).includes(
		restaurant.activeTemplate,
	)
		? (restaurant.activeTemplate as MenuGridTemplate)
		: "classic";

	return (
		<main className="min-h-screen bg-white text-slate-950">
			<PublicMenuNavbar
				openState={openState}
				reservationsEnabled={restaurant.tableReservationEnabled}
				openingPeriods={restaurant.openingHours}
				timezone={restaurant.timezone ?? "Africa/Lagos"}
				name={restaurant.name}
				logoUrl={displayLogoUrl}
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
				openState={openState}
				openingPeriods={restaurant.openingHours}
				timezone={restaurant.timezone ?? "Africa/Lagos"}
				reservationsEnabled={restaurant.tableReservationEnabled}
				name={restaurant.name}
				logoUrl={displayLogoUrl}
				bannerItems={bannerItems}
				categories={categories}
				restaurantSlug={slug}
				currency={restaurant.currency}
				appendOrderId={orderId}
				tableReservationEnabled={restaurant.tableReservationEnabled}
			/>

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
