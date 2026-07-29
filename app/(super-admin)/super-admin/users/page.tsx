import { UserRole } from "@prisma/client";
import { UsersTable } from "@/components/super-admin/UsersTable";
import { db } from "@/lib/db";

export default async function SuperAdminUsersPage({
	searchParams,
}: {
	searchParams: Promise<{ q?: string }>;
}) {
	const { q } = await searchParams;
	const query = q?.trim();

	const users = await db.user.findMany({
		where: {
			role: UserRole.RESTAURANT_OWNER,
			...(query
				? {
						OR: [
							{ email: { contains: query, mode: "insensitive" } },
							{ name: { contains: query, mode: "insensitive" } },
							{
								restaurants: {
									some: { name: { contains: query, mode: "insensitive" } },
								},
							},
						],
					}
				: undefined),
		},
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			name: true,
			email: true,
			isActive: true,
			suspensionReason: true,
			restaurants: { select: { name: true } },
		},
		take: 100,
	});

	return (
		<div className="grid gap-6">
			<div>
				<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
					Users
				</h1>
				<p className="mt-1 text-sm font-medium text-slate-600">
					Manage restaurant owner accounts on the platform.
				</p>
			</div>
			<form className="flex gap-2">
				<input
					type="text"
					name="q"
					defaultValue={query ?? ""}
					placeholder="Search by name, email, or restaurant..."
					className="h-11 w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 text-base font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
				/>
				<button
					type="submit"
					className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
				>
					Search
				</button>
			</form>

			<UsersTable
				users={users.map((user) => ({
					id: user.id,
					name: user.name,
					email: user.email,
					isActive: user.isActive,
					suspensionReason: user.suspensionReason,
					restaurantNames: user.restaurants.map((r) => r.name),
				}))}
			/>
		</div>
	);
}
