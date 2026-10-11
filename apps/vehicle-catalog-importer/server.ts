import "@crm/env/load";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { db } from "@crm/db/client";

const port = Number(process.env.IMPORTER_PORT ?? 4310);
const baseUrl = "https://carimage.dev/api/v1";
const networkLimit = createConcurrencyLimiter(5);
const manifestPath = path.join(import.meta.dir, "data", "import-state.json");
const catalogPath = path.join(
	import.meta.dir,
	"data",
	"car-image-catalog.json",
);
const catalogTtlMs = 7 * 24 * 60 * 60 * 1000;
type CatalogMake = {
	name: string;
	ids: Record<string, number>;
	models?: { name: string; years: number[] }[];
};
type Catalog = {
	fetchedAt: string;
	years: number[];
	makes: Record<string, CatalogMake>;
};
let catalog: Catalog | null = null;
let catalogLoad: Promise<Catalog> | null = null;
let catalogWrite = Promise.resolve();
let manifestSynced: Promise<void> | null = null;
type ManifestEntry = {
	make: string;
	model: string;
	year: number;
	view: string;
	key: string;
	url: string;
	updatedAt: string;
};
let manifest: Record<string, ManifestEntry> = {};
let manifestWrite = Promise.resolve();

async function loadManifest() {
	try {
		manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<
			string,
			ManifestEntry
		>;
	} catch {
		manifest = {};
	}
}

function manifestUrl(key: string) {
	return `${required("OVH_S3_PUBLIC_URL").replace(/\/$/, "")}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function imageKey(make: string, model: string, year: number, view: string) {
	return `vehicle-catalog/${segment(make)}/${segment(model)}/${year}/${segment(view)}-silver.webp`;
}

function recordManifest(entry: ManifestEntry) {
	manifest[entry.key] = entry;
	return saveManifest();
}

function saveManifest() {
	manifestWrite = manifestWrite.then(async () => {
		await mkdir(path.dirname(manifestPath), { recursive: true });
		await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
	});
	return manifestWrite;
}

function createConcurrencyLimiter(limit: number) {
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

function pickYears(years: number[]) {
	const sorted = [...new Set(years)].sort((a, b) => a - b);
	if (sorted.length === 0) return [];
	const first = sorted[0];
	const last = sorted[sorted.length - 1];
	if (first === undefined || last === undefined) return [];
	const selected: number[] = [];
	for (let year = first + 5; year < last; year += 5) {
		const available = sorted.find((value) => value >= year);
		if (available && !selected.includes(available)) selected.push(available);
	}
	selected.push(last);
	return selected;
}

function required(name: string) {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`${name} is required`);
	return value;
}

function segment(value: string) {
	return (
		value
			.normalize("NFKD")
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^a-zA-Z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.toLowerCase()
			.slice(0, 80) || "unknown"
	);
}

function storageClient() {
	return new S3Client({
		endpoint: required("OVH_S3_ENDPOINT"),
		region: required("OVH_S3_REGION"),
		forcePathStyle: true,
		credentials: {
			accessKeyId: required("OVH_S3_ACCESS_KEY"),
			secretAccessKey: required("OVH_S3_SECRET_KEY"),
		},
	});
}

async function syncManifest() {
	const client = storageClient();
	let token: string | undefined;
	try {
		do {
			const page = await networkLimit(() =>
				client.send(
					new ListObjectsV2Command({
						Bucket: required("OVH_S3_BUCKET"),
						ContinuationToken: token,
					}),
				),
			);
			for (const object of page.Contents ?? []) {
				if (!object.Key) continue;
				manifest[object.Key] ??= {
					make: "",
					model: "",
					year: 0,
					view: "",
					key: object.Key,
					url: manifestUrl(object.Key),
					updatedAt: new Date().toISOString(),
				};
			}
			token = page.IsTruncated ? page.NextContinuationToken : undefined;
		} while (token);
	} catch {}
	try {
		const rows = await db.vehicleCatalog.findMany({
			select: { make: true, model: true, photoUrls: true },
		});
		for (const row of rows)
			for (const url of row.photoUrls) {
				const key = url.split("/vehicle-catalog/")[1];
				if (!key) continue;
				manifest[`vehicle-catalog/${key}`] ??= {
					make: row.make,
					model: row.model,
					year: 0,
					view: "",
					key: `vehicle-catalog/${key}`,
					url,
					updatedAt: new Date().toISOString(),
				};
			}
	} catch {}
	await saveManifest();
}

async function carImage<T>(path: string): Promise<T> {
	return networkLimit(async () => {
		const response = await fetch(`${baseUrl}${path}`, {
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${required("CAR_IMAGE_API_KEY")}`,
			},
		});
		if (!response.ok)
			throw new Error(`Car Image API returned HTTP ${response.status}`);
		const payload = (await response.json()) as { data?: T };
		if (!payload.data)
			throw new Error(`Car Image API returned no data for ${path}`);
		return payload.data;
	});
}

function saveCatalog() {
	catalogWrite = catalogWrite.then(async () => {
		await mkdir(path.dirname(catalogPath), { recursive: true });
		await writeFile(catalogPath, JSON.stringify(catalog));
	});
	return catalogWrite;
}

async function buildCatalog() {
	try {
		const stored = JSON.parse(await readFile(catalogPath, "utf8")) as Catalog;
		if (Date.now() - Date.parse(stored.fetchedAt) < catalogTtlMs) {
			catalog = stored;
			return stored;
		}
	} catch {}
	const yearData = await carImage<{ years: number[] }>("/vehicles");
	const years = pickYears(yearData.years);
	const makes: Record<string, CatalogMake> = {};
	await Promise.all(
		years.map(async (year) => {
			const data = await carImage<{ makes: { id: number; name: string }[] }>(
				`/vehicles?year=${year}`,
			);
			for (const make of data.makes) {
				const slot = make.name.toLowerCase();
				const entry = makes[slot] ?? { name: make.name, ids: {} };
				entry.ids[year] = make.id;
				makes[slot] = entry;
			}
		}),
	);
	catalog = { fetchedAt: new Date().toISOString(), years, makes };
	await saveCatalog();
	return catalog;
}

function loadCatalog() {
	if (catalog) return Promise.resolve(catalog);
	catalogLoad ??= buildCatalog().finally(() => {
		catalogLoad = null;
	});
	return catalogLoad;
}

async function getMakes() {
	const loaded = await loadCatalog();
	return Object.values(loaded.makes)
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b));
}

async function catalogModels(make: string) {
	const loaded = await loadCatalog();
	const entry = loaded.makes[make.toLowerCase()];
	if (!entry) return [];
	if (!entry.models) {
		const byModel = new Map<string, number[]>();
		await Promise.all(
			Object.entries(entry.ids).map(async ([year, id]) => {
				const data = await carImage<{ models: { name: string }[] }>(
					`/vehicles?year=${year}&makeId=${id}`,
				);
				for (const model of data.models) {
					const years = byModel.get(model.name) ?? [];
					years.push(Number(year));
					byModel.set(model.name, years);
				}
			}),
		);
		entry.models = [...byModel].map(([name, years]) => ({
			name,
			years: years.sort((a, b) => a - b),
		}));
		await saveCatalog();
	}
	return entry.models.map((model) => ({
		make: entry.name,
		model: model.name,
		years: model.years,
	}));
}

async function getModels(view: string, make: string, query: string) {
	manifestSynced ??= syncManifest();
	await manifestSynced;
	const needle = query.trim().toLowerCase();
	const rows = (await catalogModels(make)).filter(
		(row) => !needle || row.model.toLowerCase().includes(needle),
	);
	if (rows.length === 0) return [];
	let storedByModel = new Map<string, string[]>();
	try {
		const stored = await db.vehicleCatalog.findMany({
			where: {
				OR: rows.map((row) => ({
					make_model: { make: row.make, model: row.model },
				})),
			},
			select: { make: true, model: true, photoUrls: true },
		});
		storedByModel = new Map(
			stored.map((row) => [`${row.make}|${row.model}`, row.photoUrls]),
		);
	} catch {}
	return rows.map((row) => ({
		...row,
		photoUrls: storedByModel.get(`${row.make}|${row.model}`) ?? [],
		downloadedYears: row.years.filter((year) =>
			Boolean(manifest[imageKey(row.make, row.model, year, view)]),
		),
	}));
}

async function upload(input: {
	make: string;
	model: string;
	years: number[];
	view: string;
}) {
	const client = new S3Client({
		endpoint: required("OVH_S3_ENDPOINT"),
		region: required("OVH_S3_REGION"),
		forcePathStyle: true,
		credentials: {
			accessKeyId: required("OVH_S3_ACCESS_KEY"),
			secretAccessKey: required("OVH_S3_SECRET_KEY"),
		},
	});
	const catalog = await db.vehicleCatalog.upsert({
		where: { make_model: { make: input.make, model: input.model } },
		create: { make: input.make, model: input.model, source: "carimage" },
		update: { source: "carimage" },
		select: { id: true, photoUrls: true },
	});
	const urls: string[] = [];
	for (const year of input.years) {
		const query = new URLSearchParams({
			make: input.make,
			model: input.model,
			year: String(year),
			view: input.view,
			color: "silver",
			format: "webp",
		});
		const imageResult = await networkLimit(async () => {
			const response = await fetch(`${baseUrl}/images/car?${query}`, {
				headers: { Authorization: `Bearer ${required("CAR_IMAGE_API_KEY")}` },
			});
			if (!response.ok) return null;
			return {
				body: Buffer.from(await response.arrayBuffer()),
				contentType:
					response.headers.get("content-type")?.split(";")[0]?.trim() ??
					"image/webp",
			};
		});
		if (!imageResult) continue;
		const key = imageKey(input.make, input.model, year, input.view);
		await networkLimit(() =>
			client.send(
				new PutObjectCommand({
					Bucket: required("OVH_S3_BUCKET"),
					Key: key,
					Body: imageResult.body,
					ContentType: imageResult.contentType,
					ACL: "public-read",
				}),
			),
		);
		const url = manifestUrl(key);
		await recordManifest({
			make: input.make,
			model: input.model,
			year,
			view: input.view,
			key,
			url,
			updatedAt: new Date().toISOString(),
		});
		urls.push(url);
	}
	const newUrls = urls.filter((url) => !catalog.photoUrls.includes(url));
	if (newUrls.length)
		await db.vehicleCatalog.update({
			where: { id: catalog.id },
			data: { photoUrls: { push: newUrls } },
		});
	return {
		make: input.make,
		model: input.model,
		years: input.years,
		uploaded: urls.length,
	};
}

await loadManifest();

const server = Bun.serve({
	port,
	async fetch(request) {
		const url = new URL(request.url);
		try {
			if (url.pathname === "/api/years") {
				const data = await carImage<{ years: number[] }>("/vehicles");
				return Response.json({ years: pickYears(data.years) });
			}
			if (url.pathname === "/api/makes" && request.method === "GET")
				return Response.json({ makes: await getMakes() });
			if (url.pathname === "/api/models" && request.method === "GET") {
				const make = url.searchParams.get("make")?.trim();
				if (!make) return Response.json([]);
				return Response.json(
					await getModels(
						url.searchParams.get("view") ?? "side-right",
						make,
						url.searchParams.get("q") ?? "",
					),
				);
			}
			if (url.pathname === "/api/upload" && request.method === "POST")
				return Response.json(await upload(await request.json()));
			if (url.pathname === "/" || url.pathname === "/index.html")
				return new Response(
					Bun.file(new URL("./public/index.html", import.meta.url)),
				);
			if (url.pathname.startsWith("/public/"))
				return new Response(
					Bun.file(new URL(`.${url.pathname}`, import.meta.url)),
				);
			return new Response("Not found", { status: 404 });
		} catch (error) {
			return Response.json(
				{ error: error instanceof Error ? error.message : "Unknown error" },
				{ status: 500 },
			);
		}
	},
});

console.log(`Vehicle catalog importer: http://localhost:${server.port}`);
