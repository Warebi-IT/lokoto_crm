import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { db } from "@crm/db/client";

const BRANDS = [
	{ api: "Toyota", database: "Toyota" },
	{ api: "Lexus", database: "Lexus" },
	{ api: "Nissan", database: "Nissan" },
	{ api: "Chevrolet", database: "Chevrolet" },
	{ api: "Jeep", database: "Jeep" },
	{ api: "Mercedes-Benz", database: "Mercedes-Benz" },
	{ api: "BMW", database: "BMW" },
	{ api: "Audi", database: "Audi" },
	{ api: "Kia", database: "Kia" },
	{ api: "Hyundai", database: "Hyundai" },
	{ api: "Mitsubishi", database: "Mitsubishi" },
	{ api: "Honda", database: "Honda" },
	{ api: "Mazda", database: "Mazda" },
	{ api: "Volkswagen", database: "Volkswagen" },
	{ api: "Ford", database: "Ford" },
	{ api: "Volvo", database: "Volvo" },
	{ api: "Range Rover", database: "Range Rover" },
] as const;

const BASE_URL = "https://carimage.dev/api/v1";
const VIEW = "front-3-4";
const COLOR = "silver";
const FORMAT = "webp";
const networkLimit = createConcurrencyLimiter(5);
const manifestPath = path.join(
	process.cwd(),
	"..",
	"data",
	"import-state.json",
);
let manifest: Record<
	string,
	{
		make: string;
		model: string;
		year: number;
		view: string;
		key: string;
		url: string;
		updatedAt: string;
	}
> = {};

async function loadManifest() {
	try {
		manifest = JSON.parse(await readFile(manifestPath, "utf8"));
	} catch {
		manifest = {};
	}
}

async function recordManifest(entry: (typeof manifest)[string]) {
	manifest[entry.key] = entry;
	await mkdir(path.dirname(manifestPath), { recursive: true });
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
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

type Payload<T> = { data?: T };
type ApiMake = { id: number; name: string };
type ApiModel = { name: string };

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

async function api<T>(path: string): Promise<T> {
	return networkLimit(async () => {
		const response = await fetch(`${BASE_URL}${path}`, {
			headers: {
				Accept: "application/json",
				Authorization: `Bearer ${required("CAR_IMAGE_API_KEY")}`,
			},
		});
		if (!response.ok)
			throw new Error(`Car Image API returned HTTP ${response.status}`);
		const payload = (await response.json()) as Payload<T>;
		if (!payload.data)
			throw new Error(`Car Image API returned no data for ${path}`);
		return payload.data;
	});
}

async function image(make: string, model: string, year: number) {
	const query = new URLSearchParams({
		make,
		model,
		year: String(year),
		view: VIEW,
		color: COLOR,
		format: FORMAT,
	});
	return networkLimit(async () => {
		const response = await fetch(`${BASE_URL}/images/car?${query}`, {
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
}

async function main() {
	await loadManifest();
	const bucket = required("OVH_S3_BUCKET");
	const publicUrl = required("OVH_S3_PUBLIC_URL").replace(/\/$/, "");
	const client = new S3Client({
		endpoint: required("OVH_S3_ENDPOINT"),
		region: required("OVH_S3_REGION"),
		forcePathStyle: true,
		credentials: {
			accessKeyId: required("OVH_S3_ACCESS_KEY"),
			secretAccessKey: required("OVH_S3_SECRET_KEY"),
		},
	});
	const yearData = await api<{ years: number[] }>("/vehicles");
	const years = pickYears(yearData.years);
	if (years.length === 0)
		throw new Error("Car Image API returned no available years");
	let uploaded = 0;

	for (const brand of BRANDS) {
		const makeData = await api<{ makes: ApiMake[] }>(
			`/vehicles?year=${years[0]}`,
		);
		const make = makeData.makes.find(
			(entry) => entry.name.toLowerCase() === brand.api.toLowerCase(),
		);
		if (!make) continue;
		for (const year of years) {
			const modelData = await api<{ models: ApiModel[] }>(
				`/vehicles?year=${year}&makeId=${make.id}`,
			);
			for (const model of modelData.models) {
				const result = await image(brand.api, model.name, year);
				if (!result) continue;
				const key = `vehicle-catalog/${segment(brand.database)}/${segment(model.name)}/${year}/${VIEW}-${COLOR}.${FORMAT}`;
				await networkLimit(() =>
					client.send(
						new PutObjectCommand({
							Bucket: bucket,
							Key: key,
							Body: result.body,
							ContentType: result.contentType,
							ACL: "public-read",
						}),
					),
				);
				const url = `${publicUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
				await recordManifest({
					make: brand.database,
					model: model.name,
					year,
					view: VIEW,
					key,
					url,
					updatedAt: new Date().toISOString(),
				});
				const catalog = await db.vehicleCatalog.findUnique({
					where: { make_model: { make: brand.database, model: model.name } },
					select: { id: true, photoUrls: true },
				});
				if (catalog && !catalog.photoUrls.includes(url))
					await db.vehicleCatalog.update({
						where: { id: catalog.id },
						data: { photoUrls: { push: url } },
					});
				uploaded += 1;
			}
		}
	}
	console.log(`Uploaded ${uploaded} vehicle images.`);
}

try {
	await main();
} finally {
	await db.$disconnect();
}
