import type { Prisma } from "@prisma/client";
import { AuditLogsTable } from "@/components/super-admin/AuditLogsTable";
import { Pagination } from "@/components/ui/Pagination";
import { db } from "@/lib/db";
import { clampPage, pageInfo, parsePage } from "@/lib/pagination";

export default async function SuperAdminAuditLogsPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | undefined>>;
}) {
	const params = await searchParams;
	const query = params.q?.trim();
	const where: Prisma.AuditLogWhereInput | undefined = query
		? {
				OR: [
					{ adminName: { contains: query, mode: "insensitive" } },
					{ action: { contains: query, mode: "insensitive" } },
					{ target: { contains: query, mode: "insensitive" } },
				],
			}
		: undefined;

	const total = await db.auditLog.count({ where });
	const page = clampPage(parsePage(params, 50), total);
	const logs = await db.auditLog.findMany({
		where,
		orderBy: { createdAt: "desc" },
		skip: page.skip,
		take: page.take,
	});

	return (
		<div className="grid gap-6">
			<div>
				<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
					Audit Logs
				</h1>
				<p className="mt-1 text-sm font-medium text-slate-600">
					Track every important action performed by Super Admins.
				</p>
			</div>

			<form className="flex gap-2">
				<input
					type="text"
					name="q"
					defaultValue={query ?? ""}
					placeholder="Search by admin, action, or target..."
					className="h-11 w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
				/>
				<button
					type="submit"
					className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
				>
					Search
				</button>
			</form>

			<AuditLogsTable
				logs={logs.map((log) => ({
					id: log.id,
					createdAt: log.createdAt.toISOString(),
					adminName: log.adminName,
					action: log.action,
					target: log.target,
					status: log.status,
				}))}
			/>
			<Pagination
				info={pageInfo(page, total)}
				basePath="/super-admin/audit-logs"
				query={params}
				noun="entries"
			/>
		</div>
	);
}
