import "@crm/env/load";

import { db } from "@crm/db/client";

const baseUrl = "https://carimage.dev/api/v1";
const firstYear = 1990;
const dryRun = process.argv.includes("--dry");

const MAKES: Record<string, string> = {
	toyota: "Toyota",
	hyundai: "Hyundai",
	kia: "Kia",
	fiat: "Fiat",
	opel: "Opel",
	"mercedes-benz": "Mercedes-Benz",
	honda: "Honda",
	subaru: "Subaru",
	mitsubishi: "Mitsubishi",
	"land rover": "Land Rover",
};

const MODELS: Record<string, string[]> = {
	Toyota: [
		"4Runner",
		"Alphard",
		"Aqua",
		"Auris",
		"Avalon",
		"Avanza",
		"Avensis",
		"Avensis Verso",
		"Aygo",
		"Aygo X",
		"bZ4X",
		"C-HR",
		"Camry",
		"Carina",
		"Celica",
		"Century",
		"Coaster",
		"Corolla",
		"Corolla Cross",
		"Corolla Verso",
		"Cressida",
		"Crown",
		"Estima",
		"FJ Cruiser",
		"Fortuner",
		"GR Supra",
		"GR Yaris",
		"GR86",
		"Granvia",
		"Harrier",
		"Hiace=Hi-Ace",
		"Highlander",
		"Hilux=Hi-Lux",
		"Innova",
		"Land Cruiser=Landcruiser",
		"Land Cruiser Prado=Landcruiser Prado|Prado",
		"Mark X=Markx",
		"Mirai",
		"MR2",
		"Noah",
		"Paseo",
		"Picnic",
		"Previa",
		"Prius",
		"ProAce",
		"ProAce City",
		"Raize",
		"RAV4",
		"Rush",
		"Sequoia",
		"Sienna",
		"Sienta",
		"Starlet",
		"Supra",
		"T100",
		"Tacoma",
		"Tercel",
		"Tundra",
		"Urban Cruiser",
		"Vellfire",
		"Venza",
		"Verso",
		"Vitz",
		"Voxy",
		"Wish",
		"Yaris",
		"Yaris Cross",
	],
	Hyundai: [
		"Accent",
		"Atos",
		"Azera",
		"Bayon",
		"Casper",
		"Coupe",
		"Creta",
		"Elantra",
		"Entourage",
		"Equus",
		"Excel",
		"Galloper",
		"Genesis",
		"Getz",
		"Grandeur",
		"H-1=H1",
		"H100",
		"i10=I10",
		"i20=I20",
		"i30=I30",
		"i40=I40",
		"ix20=IX20",
		"ix35=IX35",
		"Ioniq",
		"Ioniq 5=IONIQ5",
		"Ioniq 6=IONIQ6",
		"Kona",
		"Lantra",
		"Matrix",
		"Nexo",
		"Palisade",
		"Pony",
		"Santa Fe=Santa",
		"Santa Cruz",
		"Santro",
		"Scoupe",
		"Sonata",
		"Starex=Grand Starex",
		"Staria",
		"Terracan",
		"Tiburon",
		"Trajet",
		"Tucson=Tuscon",
		"Veloster",
		"Venue",
		"Veracruz",
		"XG",
	],
	Kia: [
		"Amanti",
		"Borrego",
		"Cadenza",
		"Carens",
		"Carnival",
		"Ceed=CEED",
		"Cerato",
		"Clarus",
		"EV3",
		"EV5",
		"EV6",
		"EV9",
		"Forte",
		"Joice",
		"K4",
		"K5",
		"Magentis",
		"Mentor",
		"Morning",
		"Niro",
		"Optima",
		"Picanto",
		"Pregio",
		"Pride",
		"Proceed",
		"Rio",
		"Rondo",
		"Sedona",
		"Seltos",
		"Sephia",
		"Shuma",
		"Sorento",
		"Soul",
		"Spectra",
		"Sportage",
		"Stinger",
		"Stonic",
		"Telluride",
		"Venga",
		"XCeed=Xceed",
	],
	Fiat: [
		"500",
		"500L",
		"500X",
		"124 Spider",
		"Barchetta",
		"Brava",
		"Bravo",
		"Cinquecento",
		"Coupe",
		"Croma",
		"Doblo",
		"Ducato",
		"Fiorino",
		"Freemont",
		"Fullback",
		"Grande Punto",
		"Idea",
		"Linea",
		"Marea",
		"Multipla",
		"Panda",
		"Punto",
		"Qubo",
		"Scudo",
		"Sedici",
		"Seicento",
		"Stilo",
		"Strada",
		"Talento",
		"Tempra",
		"Tipo",
		"Ulysse=Ulysee",
		"Uno",
	],
	Opel: [
		"Adam=ADAM",
		"Agila",
		"Ampera",
		"Antara",
		"Astra",
		"Calibra",
		"Campo",
		"Cascada",
		"Combo",
		"Corsa",
		"Crossland",
		"Frontera",
		"Grandland",
		"Insignia",
		"Kadett",
		"Karl=KARL",
		"Manta",
		"Meriva",
		"Mokka",
		"Monterey",
		"Movano",
		"Omega",
		"Senator",
		"Signum",
		"Sintra",
		"Speedster",
		"Tigra",
		"Vectra",
		"Vivaro",
		"Zafira",
		"Zafira Life",
	],
	"Mercedes-Benz": [
		"A-Class=A Class|A-Klasse|A",
		"B-Class=B Class|B-Klasse|B",
		"C-Class=C Class|C-Klasse|C",
		"CL",
		"CLA",
		"CLC",
		"CLE",
		"CLK",
		"CLS",
		"E-Class=E Class|E-Klasse|E",
		"EQA",
		"EQB",
		"EQC",
		"EQE",
		"EQS",
		"EQT",
		"EQV",
		"G-Class=G Class|G-Klasse|G",
		"GL",
		"GLA",
		"GLB",
		"GLC",
		"GLE",
		"GLK",
		"GLS",
		"M-Class=M Class|M-Klasse|ML",
		"R-Class=R Class|R-Klasse|R",
		"S-Class=S Class|S-Klasse|S",
		"SL=SL Class|SL-Class",
		"SLC",
		"SLK",
		"SLR",
		"SLS",
		"AMG GT=GT",
		"Citan",
		"Maybach",
		"Metris",
		"Sprinter",
		"T-Class=T Class|T-Klasse",
		"V-Class=V Class|V-Klasse|V",
		"Vaneo",
		"Viano",
		"Vito",
		"X-Class=X Class|X-Klasse",
	],
	Honda: [
		"Accord",
		"Airwave",
		"Amaze",
		"Ballade",
		"Beat",
		"BR-V",
		"Brio",
		"City",
		"Civic",
		"Clarity",
		"Concerto",
		"CR-V=CRV",
		"CR-X=CRX",
		"CR-Z=CRZ",
		"Crosstour",
		"Del Sol",
		"Element",
		"Elysion",
		"Fit",
		"FR-V=FRV",
		"Freed",
		"HR-V",
		"Honda e=E Advance",
		"Insight",
		"Inspire",
		"Integra",
		"Jazz",
		"Legend",
		"Mobilio",
		"N-Box",
		"NSX",
		"Odyssey",
		"Passport",
		"Pilot",
		"Prelude",
		"Ridgeline",
		"S2000",
		"Shuttle",
		"Stepwgn",
		"Stream",
		"Vezel",
		"WR-V",
		"ZR-V",
	],
	Subaru: [
		"Alcyone",
		"Ascent",
		"Baja",
		"BRZ",
		"Crosstrek=Crosstrek",
		"Exiga",
		"Forester",
		"Impreza",
		"Justy",
		"Legacy",
		"Leone",
		"Levorg",
		"Liberty",
		"Loyale",
		"Outback",
		"R2",
		"Sambar",
		"Solterra",
		"SVX",
		"Trezia",
		"Tribeca=B9 Tribeca",
		"Vivio",
		"WRX",
		"XV",
	],
	Mitsubishi: [
		"3000GT=GTO",
		"Airtrek",
		"ASX",
		"Attrage",
		"Canter",
		"Carisma",
		"Colt",
		"Delica",
		"Diamante",
		"Eclipse",
		"Eclipse Cross",
		"Endeavor",
		"Eterna",
		"FTO",
		"Galant",
		"Grandis",
		"i-MiEV=MIEV",
		"L200=L 200",
		"Lancer",
		"Lancer Evolution=Lancer Evo",
		"Legnum",
		"Libero",
		"Mirage",
		"Montero",
		"Outlander",
		"Pajero",
		"Pajero Pinin",
		"Pajero Sport",
		"Sigma",
		"Space Runner=Spacerunner",
		"Space Star",
		"Space Wagon",
		"Starion",
		"Triton",
		"Xpander",
	],
	"Land Rover": [
		"Defender",
		"Discovery",
		"Discovery Sport",
		"Freelander",
		"LR2",
		"LR3",
		"LR4",
		"Range Rover=Rangerover",
		"Range Rover Evoque=Evoque|Range Rover Evogue",
		"Range Rover Sport",
		"Range Rover Velar=Velar",
	],
};

function required(name: string) {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required`);
	return value;
}

function createLimiter(limit: number) {
	let active = 0;
	const queue: (() => void)[] = [];
	return async function run<T>(task: () => Promise<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			const execute = () => {
				active += 1;
				task()
					.then(resolve, reject)
					.finally(() => {
						active -= 1;
						queue.shift()?.();
					});
			};
			if (active < limit) execute();
			else queue.push(execute);
		});
	};
}

const limit = createLimiter(5);

async function carImage<T>(path: string): Promise<T> {
	return limit(async () => {
		const response = await fetch(`${baseUrl}${path}`, {
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${required("CAR_IMAGE_API_KEY")}`,
			},
		});
		if (!response.ok)
			throw new Error(`Car Image API returned HTTP ${response.status}`);
		const payload = (await response.json()) as { data?: T };
		if (!payload.data) throw new Error(`No data for ${path}`);
		return payload.data;
	});
}

function key(name: string) {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function consolidate(make: string, seen: Map<string, Set<number>>) {
	const byKey = new Map<string, Set<number>>();
	for (const [name, years] of seen) {
		const slot = byKey.get(key(name)) ?? new Set<number>();
		for (const year of years) slot.add(year);
		byKey.set(key(name), slot);
	}
	const rows: {
		make: string;
		model: string;
		yearFrom: number;
		yearTo: number;
	}[] = [];
	const missing: string[] = [];
	for (const entry of MODELS[make] ?? []) {
		const [model = "", aliases] = entry.split("=");
		const names = [model, ...(aliases?.split("|") ?? [])];
		const years = new Set<number>();
		for (const name of names)
			for (const year of byKey.get(key(name)) ?? []) years.add(year);
		if (years.size === 0) {
			missing.push(model);
			continue;
		}
		const sorted = [...years].sort((a, b) => a - b);
		rows.push({
			make,
			model,
			yearFrom: sorted[0] ?? firstYear,
			yearTo: sorted[sorted.length - 1] ?? firstYear,
		});
	}
	if (missing.length) console.log(`  not in Car Image: ${missing.join(", ")}`);
	return rows;
}

async function main() {
	const yearData = await carImage<{ years: number[] }>("/vehicles");
	const years = yearData.years.filter((year) => year >= firstYear);
	const ids = new Map<string, Map<number, number>>();
	await Promise.all(
		years.map(async (year) => {
			const data = await carImage<{ makes: { id: number; name: string }[] }>(
				`/vehicles?year=${year}`,
			);
			for (const make of data.makes) {
				const display = MAKES[make.name.toLowerCase()];
				if (!display) continue;
				const byYear = ids.get(display) ?? new Map<number, number>();
				byYear.set(year, make.id);
				ids.set(display, byYear);
			}
		}),
	);
	let created = 0;
	let updated = 0;
	for (const make of Object.values(MAKES)) {
		const byYear = ids.get(make);
		if (!byYear) {
			console.warn(`${make}: not found in Car Image`);
			continue;
		}
		const seen = new Map<string, Set<number>>();
		await Promise.all(
			[...byYear].map(async ([year, id]) => {
				const data = await carImage<{ models: { name: string }[] }>(
					`/vehicles?year=${year}&makeId=${id}`,
				);
				for (const model of data.models) {
					const name = model.name.trim().replace(/\s+/g, " ");
					const set = seen.get(name) ?? new Set<number>();
					set.add(year);
					seen.set(name, set);
				}
			}),
		);
		const rows = consolidate(make, seen);
		console.log(`${make}: ${rows.length} models`);
		if (dryRun) {
			console.log(`  ${rows.map((row) => row.model).join(", ")}`);
			continue;
		}
		for (const row of rows) {
			const existing = await db.vehicleCatalog.findFirst({
				where: {
					make: { equals: row.make, mode: "insensitive" },
					model: { equals: row.model, mode: "insensitive" },
				},
				select: { id: true },
			});
			if (existing) {
				await db.vehicleCatalog.update({
					where: { id: existing.id },
					data: { yearFrom: row.yearFrom, yearTo: row.yearTo },
				});
				updated += 1;
			} else {
				await db.vehicleCatalog.create({
					data: { ...row, source: "carimage" },
				});
				created += 1;
			}
		}
	}
	if (!dryRun) console.log(`Created ${created}, updated ${updated}.`);
	await db.$disconnect();
}

await main();
