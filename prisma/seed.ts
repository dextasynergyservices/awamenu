import {
	OnboardingStatus,
	PlanTier,
	PrismaClient,
	UserRole,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
	await prisma.plan.upsert({
		where: { tier: PlanTier.FREE },
		update: {
			name: "Free",
			description:
				"1 Category · 8 Items · Basic Analytics · WhatsApp · AwaMenu branding shown",
			monthlyPrice: 0,
			quarterlyPrice: 0,
			yearlyPrice: 0,
			maxCategories: 1,
			maxMenuItems: 8,
			advancedAnalytics: false,
			removeAwamenuBranding: false,
			whatsappIntegration: true,
			basicSupport: false,
			prioritySupport: false,
			availableTemplates: ["classic"],
			isActive: true,
		},
		create: {
			tier: PlanTier.FREE,
			name: "Free",
			description:
				"1 Category · 8 Items · Basic Analytics · WhatsApp · AwaMenu branding shown",
			monthlyPrice: 0,
			quarterlyPrice: 0,
			yearlyPrice: 0,
			maxCategories: 1,
			maxMenuItems: 8,
			whatsappIntegration: true,
			availableTemplates: ["classic"],
		},
	});

	await prisma.plan.upsert({
		where: { tier: PlanTier.STARTER },
		update: {
			name: "Starter",
			description:
				"10 Categories · 100 Items · Multiple Templates · Advanced Analytics · Remove Branding · Basic Support",
			monthlyPrice: 5000,
			quarterlyPrice: 14250,
			yearlyPrice: 54000,
			maxCategories: 10,
			maxMenuItems: 100,
			advancedAnalytics: true,
			removeAwamenuBranding: true,
			whatsappIntegration: true,
			basicSupport: true,
			prioritySupport: false,
			availableTemplates: ["classic", "grid"],
			isActive: true,
		},
		create: {
			tier: PlanTier.STARTER,
			name: "Starter",
			description:
				"10 Categories · 100 Items · Multiple Templates · Advanced Analytics · Remove Branding · Basic Support",
			monthlyPrice: 5000,
			quarterlyPrice: 14250,
			yearlyPrice: 54000,
			maxCategories: 10,
			maxMenuItems: 100,
			advancedAnalytics: true,
			removeAwamenuBranding: true,
			whatsappIntegration: true,
			basicSupport: true,
			availableTemplates: ["classic", "grid"],
		},
	});

	await prisma.plan.upsert({
		where: { tier: PlanTier.PRO },
		update: {
			name: "Pro",
			description:
				"Unlimited Categories · Unlimited Items · Multiple Templates · Advanced Analytics · Remove Branding · Priority Support",
			monthlyPrice: 12000,
			quarterlyPrice: 34200,
			yearlyPrice: 129600,
			maxCategories: -1,
			maxMenuItems: -1,
			advancedAnalytics: true,
			removeAwamenuBranding: true,
			whatsappIntegration: true,
			basicSupport: true,
			prioritySupport: true,
			availableTemplates: ["classic", "grid", "compact", "magazine"],
			isActive: true,
		},
		create: {
			tier: PlanTier.PRO,
			name: "Pro",
			description:
				"Unlimited Categories · Unlimited Items · Multiple Templates · Advanced Analytics · Remove Branding · Priority Support",
			monthlyPrice: 12000,
			quarterlyPrice: 34200,
			yearlyPrice: 129600,
			maxCategories: -1,
			maxMenuItems: -1,
			advancedAnalytics: true,
			removeAwamenuBranding: true,
			whatsappIntegration: true,
			basicSupport: true,
			prioritySupport: true,
			availableTemplates: ["classic", "grid", "compact", "magazine"],
		},
	});

	await prisma.user.upsert({
		where: { email: process.env.SUPER_ADMIN_EMAIL ?? "admin@awamenu.com" },
		update: {
			role: UserRole.SUPER_ADMIN,
			onboardingStatus: OnboardingStatus.COMPLETE,
			emailVerified: true,
		},
		create: {
			email: process.env.SUPER_ADMIN_EMAIL ?? "admin@awamenu.com",
			name: "Super Admin",
			role: UserRole.SUPER_ADMIN,
			onboardingStatus: OnboardingStatus.COMPLETE,
			emailVerified: true,
		},
	});
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (error) => {
		console.error(error);
		await prisma.$disconnect();
		process.exit(1);
	});
