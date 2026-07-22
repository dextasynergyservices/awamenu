import { ChevronDown, Eye } from "lucide-react";
import Link from "next/link";
import { BannerManager } from "@/components/admin/BannerManager";
import { CategoryManager } from "@/components/admin/CategoryManager";
import { MenuEditor } from "@/components/admin/MenuEditor";
import { MobileMenuBuilder } from "@/components/admin/MobileMenuBuilder";
import { PlanLimitBanner } from "@/components/admin/PlanLimitBanner";
import { bannerRecordToItem } from "@/lib/banners";
import { db } from "@/lib/db";

type MenuBuilderPageProps = {
	params: Promise<{ slug: string }>;
};

function isWithinLimit(current: number, max: number) {
	return max < 0 || current < max;
}

export default async function MenuBuilderPage({
	params,
}: MenuBuilderPageProps) {
	const { slug } = await params;
	const restaurant = await db.restaurant.findFirstOrThrow({
		where: { slug },
		select: {
			id: true,
			name: true,
			slug: true,
			currency: true,
			activeTemplate: true,
			subscription: {
				select: {
					plan: {
						select: {
							name: true,
							tier: true,
							maxCategories: true,
							maxMenuItems: true,
						},
					},
				},
			},
			categories: {
				orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
				select: {
					id: true,
					name: true,
					emoji: true,
					sortOrder: true,
					isActive: true,
					items: {
						orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
						select: {
							id: true,
							name: true,
							description: true,
							price: true,
							imageUrl: true,
							sortOrder: true,
							isAvailable: true,
							isTodaySpecial: true,
						},
					},
				},
			},
			banners: {
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
	const freePlan = restaurant.subscription
		? null
		: await db.plan.findUnique({
				where: { tier: "FREE" },
				select: {
					name: true,
					tier: true,
					maxCategories: true,
					maxMenuItems: true,
				},
			});
	const plan = restaurant.subscription?.plan ??
		freePlan ?? {
			name: "Free",
			tier: "FREE" as const,
			maxCategories: 2,
			maxMenuItems: 8,
		};
	const categoryCount = restaurant.categories.length;
	const menuItemCount = restaurant.categories.reduce(
		(total, category) => total + category.items.length,
		0,
	);
	const bannerItems = restaurant.banners.map(bannerRecordToItem);
	const categories = restaurant.categories.map(({ items, ...category }) => ({
		...category,
		items: items.map((item) => ({
			...item,
			price: Number(item.price),
		})),
	}));

	return (
		<section className="grid gap-5">
			<div className="hidden gap-4 md:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
				<div>
					<h1 className="text-3xl font-black text-slate-950">Menu Builder</h1>
					<p className="mt-2 text-sm font-medium text-slate-500">
						Manage categories, menu items, prices, availability, and item
						photos.
					</p>
				</div>
				<Link
					href={`/${restaurant.slug}`}
					className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-black text-white"
				>
					<Eye className="size-4" aria-hidden="true" />
					Preview menu
					<ChevronDown className="size-4" aria-hidden="true" />
				</Link>
			</div>

			<MobileMenuBuilder
				restaurantId={restaurant.id}
				slug={restaurant.slug}
				currency={restaurant.currency}
				canCreateCategory={isWithinLimit(categoryCount, plan.maxCategories)}
				categories={categories}
				bannerItems={bannerItems}
				maxCategories={plan.maxCategories}
				maxMenuItems={plan.maxMenuItems}
				activeTemplate={restaurant.activeTemplate}
				planTier={plan.tier}
			/>

			<div className="hidden gap-5 md:grid">
				<PlanLimitBanner
					planName={plan.name}
					categoryCount={categoryCount}
					maxCategories={plan.maxCategories}
					menuItemCount={menuItemCount}
					maxMenuItems={plan.maxMenuItems}
					bannerCount={bannerItems.length}
				/>

				<BannerManager
					restaurantId={restaurant.id}
					slug={restaurant.slug}
					bannerItems={bannerItems}
				/>

				<div className="grid gap-5 xl:grid-cols-[0.9fr_1.3fr]">
					<CategoryManager
						restaurantId={restaurant.id}
						slug={restaurant.slug}
						canCreateCategory={isWithinLimit(categoryCount, plan.maxCategories)}
						categories={categories}
					/>
					<MenuEditor
						restaurantId={restaurant.id}
						slug={restaurant.slug}
						canCreateItem={isWithinLimit(menuItemCount, plan.maxMenuItems)}
						activeTemplate={restaurant.activeTemplate}
						planTier={plan.tier}
						categories={categories}
					/>
				</div>
			</div>
		</section>
	);
}
