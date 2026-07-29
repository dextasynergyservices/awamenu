import { db } from "@/lib/db";
import { getThemeStyle } from "@/lib/theme-style";

export default async function StorefrontLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	const restaurant = await db.restaurant.findFirst({
		where: { slug },
		select: { primaryColor: true },
	});

	const style = getThemeStyle(restaurant?.primaryColor);

	if (!style) {
		return <>{children}</>;
	}

	return (
		<div style={style} className="h-full">
			{children}
		</div>
	);
}
