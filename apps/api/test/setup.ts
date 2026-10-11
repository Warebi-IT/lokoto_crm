import { afterAll } from "bun:test";

export const TEST_ORGANIZATION_ID = "workspace";

if (process.env.DATABASE_URL) {
	const { db } = await import("@crm/db");
	const { setFallbackTenant } = await import("@crm/db/tenant");

	await db.organization.upsert({
		where: { id: TEST_ORGANIZATION_ID },
		create: {
			id: TEST_ORGANIZATION_ID,
			name: "CRM",
			slug: "crm",
			joinCode: "LOKOTO-DEMO",
			createdAt: new Date(),
		},
		update: {},
	});

	setFallbackTenant(TEST_ORGANIZATION_ID);
}

afterAll(async () => {
	if (!process.env.DATABASE_URL) return;
	const { db } = await import("@crm/db");
	await db.$disconnect();
});
