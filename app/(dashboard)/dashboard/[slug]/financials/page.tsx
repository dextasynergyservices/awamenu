import { redirect } from "next/navigation";
import { FinancialsReport } from "@/components/admin/FinancialsReport";
import { Pagination } from "@/components/ui/Pagination";
import { AUDIT_ACTION_LABELS } from "@/lib/audit";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";
import { getLedgerRows, parseDateRange, summarise } from "@/lib/financials";
import { clampPage, pageInfo, parsePage } from "@/lib/pagination";

export const metadata = { title: "Payments & reports" };

export default async function FinancialsPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<Record<string, string | undefined>>;
}) {
	const user = await requireUser();
	const { slug } = await params;
	const filters = await searchParams;

	// Scoped by ownerId, so this page cannot be reached for someone else's
	// restaurant by editing the slug.
	const restaurant = await db.restaurant.findFirst({
		where: { slug, ownerId: user.id },
		select: { id: true, currency: true, timezone: true },
	});

	if (!restaurant) redirect("/dashboard");

	const range = parseDateRange(filters.from, filters.to, restaurant.timezone);

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

	// Totals cover the whole range; only one page of rows goes to the browser.
	const page = clampPage(parsePage(filters, 50), rows.length);
	const pageRows = rows.slice(page.skip, page.skip + page.take);

	return (
		<FinancialsReport
			slug={slug}
			rows={pageRows.map((row) => ({
				...row,
				createdAt: row.createdAt.toISOString(),
			}))}
			summary={summarise(rows)}
			range={{ from: range.fromKey, to: range.toKey }}
			pager={
				<Pagination
					className="mt-4"
					info={pageInfo(page, rows.length)}
					basePath={`/dashboard/${slug}/financials`}
					query={filters}
					noun="transactions"
				/>
			}
			auditEvents={auditEvents.map((event) => ({
				...event,
				createdAt: event.createdAt.toISOString(),
				label: AUDIT_ACTION_LABELS[event.action] ?? event.action,
			}))}
		/>
	);
}
