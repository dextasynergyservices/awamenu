import { UserRole } from "@prisma/client";
import { updateUserRoleAction } from "@/actions/super-admin.actions";
import { SubmitButton } from "@/components/ui/action-button";
import { requireUser } from "@/lib/auth-guards";
import { db } from "@/lib/db";

export default async function SuperAdminUsersPage({
	searchParams,
}: {
	searchParams: Promise<{ q?: string }>;
}) {
	const currentUser = await requireUser();
	const { q } = await searchParams;
	const query = q?.trim();

	const users = await db.user.findMany({
		where: query
			? {
					OR: [
						{ email: { contains: query, mode: "insensitive" } },
						{ name: { contains: query, mode: "insensitive" } },
					],
				}
			: undefined,
		orderBy: { createdAt: "desc" },
		select: {
			id: true,
			name: true,
			email: true,
			role: true,
			createdAt: true,
			_count: { select: { restaurants: true } },
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
					Search users and manage platform access.
				</p>
			</div>
			<form className="flex gap-2">
				<input
					type="text"
					name="q"
					defaultValue={query ?? ""}
					placeholder="Search by name or email..."
					className="h-11 w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-950 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
				/>
				<button
					type="submit"
					className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800"
				>
					Search
				</button>
			</form>

			<div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
				<table className="w-full min-w-[640px] text-left text-sm">
					<thead>
						<tr className="border-b border-slate-100 text-xs font-black uppercase tracking-wide text-slate-500">
							<th className="p-4">User</th>
							<th className="p-4">Restaurants</th>
							<th className="p-4">Role</th>
							<th className="p-4">Joined</th>
							<th className="p-4">Actions</th>
						</tr>
					</thead>
					<tbody>
						{users.map((user) => {
							const isSuperAdmin = user.role === UserRole.SUPER_ADMIN;
							const nextRole = isSuperAdmin
								? UserRole.RESTAURANT_OWNER
								: UserRole.SUPER_ADMIN;
							const isSelf = user.id === currentUser.id;

							return (
								<tr
									key={user.id}
									className="border-b border-slate-50 last:border-0"
								>
									<td className="p-4">
										<p className="font-black text-slate-900">
											{user.name ?? "Unnamed"}
										</p>
										<p className="text-xs font-medium text-slate-400">
											{user.email}
										</p>
									</td>
									<td className="p-4 font-semibold text-slate-700">
										{user._count.restaurants}
									</td>
									<td className="p-4">
										<span
											className={`rounded-full px-2.5 py-1 text-xs font-black ${
												isSuperAdmin
													? "bg-purple-100 text-purple-700"
													: "bg-slate-100 text-slate-600"
											}`}
										>
											{isSuperAdmin ? "Super Admin" : "Restaurant Owner"}
										</span>
									</td>
									<td className="p-4 font-medium text-slate-500">
										{new Date(user.createdAt).toLocaleDateString()}
									</td>
									<td className="p-4">
										{isSelf ? (
											<span className="text-xs font-medium text-slate-400">
												You
											</span>
										) : (
											<form action={updateUserRoleAction}>
												<input type="hidden" name="userId" value={user.id} />
												<input type="hidden" name="role" value={nextRole} />
												<SubmitButton
													loadingText="Updating..."
													successText="Updated"
													className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-black ${
														isSuperAdmin
															? "border border-red-100 bg-white text-red-600 hover:bg-red-50"
															: "bg-emerald-700 text-white hover:bg-emerald-800"
													}`}
												>
													{isSuperAdmin ? "Revoke Admin" : "Make Admin"}
												</SubmitButton>
											</form>
										)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		</div>
	);
}
