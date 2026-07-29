import { db } from "@/lib/db";

export async function recordAuditLog(input: {
	adminId: string;
	adminName: string;
	action: string;
	target: string;
	status?: string;
}) {
	await db.auditLog.create({
		data: {
			adminId: input.adminId,
			adminName: input.adminName,
			action: input.action,
			target: input.target,
			status: input.status ?? "success",
		},
	});
}
