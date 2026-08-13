import { redirect } from "next/navigation";

/**
 * Tables moved under Reservations.
 *
 * Kept as a redirect rather than deleted: /tables is what the sidebar linked
 * to for the life of the product, so it is in browser history and very likely
 * bookmarked by owners who manage their floor plan daily.
 */
export default async function TablesRedirectPage({
	params,
}: {
	params: Promise<{ slug: string }>;
}) {
	const { slug } = await params;
	redirect(`/dashboard/${slug}/reservations/tables`);
}
