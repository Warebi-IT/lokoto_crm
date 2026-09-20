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
const brands = [
	"Toyota",
	"Lexus",
	"Nissan",
	"Chevrolet",
	"Jeep",
	"Mercedes-Benz",
	"BMW",
	"Audi",
	"Kia",
	"Hyundai",
	"Mitsubishi",
	"Honda",
	"Mazda",
	"Volkswagen",
	"Ford",
	"Volvo",
	"Range Rover",
];
const networkLimit = createConcurrencyLimiter(5);
const manifestPath = path.join(import.meta.dir, "data", "import-state.json");
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

async function getModels(view = "side-right") {
	const yearData = await carImage<{ years: number[] }>("/vehicles");
	const years = pickYears(yearData.years);
	await syncManifest();
	const catalog = new Map<
		string,
		{ make: string; model: string; years: number[] }
	>();
	const yearResults = await Promise.all(
		years.map(async (year) => {
			const data = await carImage<{ makes: { id: number; name: string }[] }>(
				`/vehicles?year=${year}`,
			);
			const brandResults = await Promise.all(
				brands.map(async (brand) => {
					const make = data.makes.find(
						(entry) => entry.name.toLowerCase() === brand.toLowerCase(),
					);
					if (!make) return [];
					const models = await carImage<{ models: { name: string }[] }>(
						`/vehicles?year=${year}&makeId=${make.id}`,
					);
					return models.models.map((model) => ({ brand, model: model.name }));
				}),
			);
			return { year, brandResults };
		}),
	);
	for (const { year, brandResults } of yearResults) {
		for (const models of brandResults) {
			for (const item of models) {
				const key = `${item.brand}|${item.model}`;
				const existing = catalog.get(key) ?? {
					make: item.brand,
					model: item.model,
					years: [],
				};
				if (!existing.years.includes(year)) existing.years.push(year);
				catalog.set(key, existing);
			}
		}
	}
	const rows = [...catalog.values()];
	try {
		const stored = await db.vehicleCatalog.findMany({
			where: {
				OR: rows.map((row) => ({
					make_model: { make: row.make, model: row.model },
				})),
			},
			select: { make: true, model: true, photoUrls: true },
		});
		const storedByModel = new Map(
			stored.map((row) => [`${row.make}|${row.model}`, row.photoUrls]),
		);
		return rows.map((row) => ({
			...row,
			photoUrls: storedByModel.get(`${row.make}|${row.model}`) ?? [],
			downloadedYears: row.years.filter((year) =>
				Boolean(manifest[imageKey(row.make, row.model, year, view)]),
			),
		}));
	} catch {
		return rows.map((row) => ({
			...row,
			photoUrls: [],
			downloadedYears: row.years.filter((year) =>
				Boolean(manifest[imageKey(row.make, row.model, year, view)]),
			),
		}));
	}
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
			if (url.pathname === "/api/models" && request.method === "GET") {
				return Response.json(
					await getModels(url.searchParams.get("view") ?? "side-right"),
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
