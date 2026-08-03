import { SuperAdminShell } from "@/components/super-admin/SuperAdminShell";
import { requireSuperAdmin } from "@/lib/auth-guards";

export const dynamic = "force-dynamic";

export default async function SuperAdminLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const admin = await requireSuperAdmin();

	return (
		<SuperAdminShell adminName={admin.name ?? admin.email}>
			{children}
		</SuperAdminShell>
	);
}
