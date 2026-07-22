import { PrismaClient } from "@prisma/client";
import { generateStaffId } from "../lib/staff-id";

const prisma = new PrismaClient();

async function main() {
	const staff = await prisma.staffMember.findMany();
	let updated = 0;

	for (const member of staff) {
		// Only update if it's the old long format
		if (member.staffId.length > 6) {
			const newId = generateStaffId();
			await prisma.staffMember.update({
				where: { id: member.id },
				data: { staffId: newId },
			});
			console.log(`Updated ${member.name}: ${member.staffId} -> ${newId}`);
			updated++;
		}
	}

	console.log(`Done. Updated ${updated} staff members.`);
}

main()
	.catch(console.error)
	.finally(() => prisma.$disconnect());
