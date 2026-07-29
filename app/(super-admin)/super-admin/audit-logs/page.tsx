import { AuditLogsTable } from "@/components/super-admin/AuditLogsTable";
import { db } from "@/lib/db";

export default async function SuperAdminAuditLogsPage({
	searchParams,
}: {
	searchParams: Promise<{ q?: string }>;
}) {
	const { q } = await searchParams;
	const query = q?.trim();

	const logs = await db.auditLog.findMany({
		where: query
			? {
					OR: [
						{ adminName: { contains: query, mode: "insensitive" } },
						{ action: { contains: query, mode: "insensitive" } },
						{ target: { contains: query, mode: "insensitive" } },
					],
				}
			: undefined,
		orderBy: { createdAt: "desc" },
		take: 200,
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
		</div>
	);
}
