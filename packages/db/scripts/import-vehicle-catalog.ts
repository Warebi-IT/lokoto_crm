import { db } from "../src/client";

const MAKES = [
	{ requested: "Toyota", stored: "Toyota" },
	{ requested: "Honda", stored: "Honda" },
	{ requested: "Nissan", stored: "Nissan" },
	{ requested: "Renault", stored: "Renault" },
	{ requested: "Peugeot", stored: "Peugeot" },
	{ requested: "Mercedes-Benz", stored: "Mercedes-Benz" },
] as const;

type VpicModel = {
	Make_Name?: string;
	Model_Name?: string;
};

type VpicResponse = {
	Results?: VpicModel[];
};

const endpoint = (make: string) =>
	`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/${encodeURIComponent(make)}?format=json`;

async function fetchModels(make: string): Promise<VpicModel[]> {
	const response = await fetch(endpoint(make), {
		headers: { Accept: "application/json" },
	});
	if (!response.ok) {
		throw new Error(`vPIC returned HTTP ${response.status} for ${make}`);
	}
	const payload = (await response.json()) as VpicResponse;
	return payload.Results ?? [];
}

async function main() {
	let imported = 0;

	for (const make of MAKES) {
		const models = await fetchModels(make.requested);
		const uniqueModels = new Set(
			models
				.map((row) => row.Model_Name?.trim())
				.filter((model): model is string => Boolean(model)),
		);

		if (uniqueModels.size === 0) {
			console.warn(`No vPIC models found for ${make.requested}`);
		}

		for (const model of uniqueModels) {
			await db.vehicleCatalog.upsert({
				where: { make_model: { make: make.stored, model } },
				create: {
					make: make.stored,
					model,
					source: "vpic",
				},
				update: { source: "vpic" },
			});
			imported += 1;
		}
	}

	console.info(`Imported ${imported} vehicle catalog models.`);
}

try {
	await main();
} finally {
	await db.$disconnect();
}
