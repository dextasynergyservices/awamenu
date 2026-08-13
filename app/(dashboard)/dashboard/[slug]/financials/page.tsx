import { redirect } from "next/navigation";
import { FinancialsReport } from "@/components/admin/FinancialsReport";
import { AUDIT_ACTION_LABELS } from "@/lib/audit";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { getLedgerRows, parseDateRange, summarise } from "@/lib/financials";

export const metadata = { title: "Payments & reports" };

export default async function FinancialsPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ from?: string; to?: string }>;
}) {
	const user = await requireUser();
	const { slug } = await params;
	const filters = await searchParams;

	// Scoped by ownerId, so this page cannot be reached for someone else's
	// restaurant by editing the slug.
	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		select: { id: true, currency: true },
	});

	if (!restaurant) redirect("/dashboard");

	const range = parseDateRange(filters.from, filters.to);

	const [rows, auditEvents] = await Promise.all([
		getLedgerRows(restaurant.id, range),
		db.restaurantAuditEvent.findMany({
			where: { restaurantId: restaurant.id },
			orderBy: { createdAt: "desc" },
			take: 50,
			select: {
				id: true,
				createdAt: true,
				actorName: true,
				actorType: true,
				action: true,
				target: true,
				previousValue: true,
				newValue: true,
			},
		}),
	]);

	return (
		<FinancialsReport
			slug={slug}
			rows={rows.map((row) => ({
				...row,
				createdAt: row.createdAt.toISOString(),
			}))}
			summary={summarise(rows)}
			range={{
				from: range.start.toISOString().slice(0, 10),
				to: range.end.toISOString().slice(0, 10),
			}}
			auditEvents={auditEvents.map((event) => ({
				...event,
				createdAt: event.createdAt.toISOString(),
				label: AUDIT_ACTION_LABELS[event.action] ?? event.action,
			}))}
		/>
	);
}
