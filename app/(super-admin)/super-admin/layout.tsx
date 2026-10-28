import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { requireSuperAdmin } from "@/lib/auth-guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const admin = await requireSuperAdmin();
	const settings = await db.platformSetting.findFirst({
		select: { logoUrl: true },
	});

	return (
		<SuperAdminShell
			adminName={admin.name ?? admin.email}
			adminEmail={admin.email}
			logoUrl={settings?.logoUrl ?? null}
		>
			{children}
		</SuperAdminShell>
	);
}
