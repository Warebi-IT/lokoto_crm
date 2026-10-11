if (process.env.BDD_URL) {
	const { db } = await import("@crm/db");
	const { setFallbackTenant } = await import("@crm/db/tenant");
	const { WORKSPACE_ID } = await import("@crm/db/workspace");

	await db.organization.upsert({
		where: { id: WORKSPACE_ID },
		create: {
			id: WORKSPACE_ID,
			name: "CRM",
			slug: "crm",
			joinCode: "LOKOTO-DEMO",
			createdAt: new Date(),
		},
		update: {},
	});

	setFallbackTenant(WORKSPACE_ID);
}
