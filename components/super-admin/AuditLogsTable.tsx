"use client";

import { useState } from "react";
import { MobileModal } from "@/components/ui/MobileModal";

type AuditLogRow = {
	id: string;
	createdAt: string;
	adminName: string;
	action: string;
	target: string;
	status: string;
};

export function AuditLogsTable({ logs }: { logs: AuditLogRow[] }) {
	const [selectedLog, setSelectedLog] = useState<AuditLogRow | null>(null);

	if (logs.length === 0) {
		return (
			<div className="rounded-2xl border border-slate-100 bg-white p-8 text-center text-sm font-medium text-slate-500">
				No audit log entries yet.
			</div>
		);
	}

	return (
		<>
			<div className="grid gap-2 md:hidden">
				{logs.map((log) => (
					<button
						key={log.id}
						type="button"
						onClick={() => setSelectedLog(log)}
						className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white p-3 text-left"
					>
						<div className="min-w-0">
							<p className="truncate text-sm font-black text-slate-900">
								{log.action}
							</p>
							<p className="truncate text-xs font-medium text-slate-400">
								{log.adminName} · {new Date(log.createdAt).toLocaleDateString()}
							</p>
						</div>
						<span
							className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${
								log.status === "success"
									? "bg-emerald-100 text-emerald-700"
									: "bg-red-100 text-red-700"
							}`}
						>
							{log.status}
						</span>
					</button>
				))}
			</div>

			<div className="hidden overflow-x-auto rounded-2xl border border-slate-100 bg-white md:block">
				<table className="w-full min-w-[720px] text-left text-sm">
					<thead>
						<tr className="border-b border-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
							<th className="p-4">Date & Time</th>
							<th className="p-4">Admin</th>
							<th className="p-4">Action</th>
							<th className="p-4">Target</th>
							<th className="p-4">Status</th>
						</tr>
					</thead>
					<tbody>
						{logs.map((log) => (
							<tr
								key={log.id}
								className="border-b border-slate-50 last:border-0"
							>
								<td className="p-4 font-medium text-slate-500">
									{new Date(log.createdAt).toLocaleString()}
								</td>
								<td className="p-4 font-black text-slate-900">
									{log.adminName}
								</td>
								<td className="p-4 font-semibold text-slate-700">
									{log.action}
								</td>
								<td className="p-4 font-medium text-slate-600">{log.target}</td>
								<td className="p-4">
									<span
										className={`rounded-full px-2.5 py-1 text-xs font-black ${
											log.status === "success"
												? "bg-emerald-100 text-emerald-700"
												: "bg-red-100 text-red-700"
										}`}
									>
										{log.status}
									</span>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<MobileModal
				open={selectedLog !== null}
				onClose={() => setSelectedLog(null)}
				title={selectedLog?.action ?? ""}
				description={
					selectedLog
						? new Date(selectedLog.createdAt).toLocaleString()
						: undefined
				}
			>
				{selectedLog ? (
					<div className="grid gap-3 pb-2">
						<div>
							<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								Admin
							</p>
							<p className="mt-0.5 text-sm font-semibold text-slate-700">
								{selectedLog.adminName}
							</p>
						</div>
						<div>
							<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								Target
							</p>
							<p className="mt-0.5 text-sm font-semibold text-slate-700">
								{selectedLog.target}
							</p>
						</div>
						<div>
							<p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
								Status
							</p>
							<span
								className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-black ${
									selectedLog.status === "success"
										? "bg-emerald-100 text-emerald-700"
										: "bg-red-100 text-red-700"
								}`}
							>
								{selectedLog.status}
							</span>
						</div>
					</div>
				) : null}
			</MobileModal>
		</>
	);
}
