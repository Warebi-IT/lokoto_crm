import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { Db } from "@crm/db";
import { closestYearPhoto } from "@crm/db/vehicle-photos";
import { Injectable, Logger } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

const CAR_IMAGE_URL = "https://carimage.dev/api/v1/images/car";
const VIEW = "side-right";
const COLORS = [
	"white",
	"black",
	"gray",
	"silver",
	"blue",
	"red",
	"green",
	"brown",
	"beige",
	"orange",
	"yellow",
	"burgundy",
];
const FORMAT = "webp";
const FIRST_YEAR = 1990;
const YEAR_STEP = 5;
const FETCH_TIMEOUT_MS = 120_000;
const YEAR_CONCURRENCY = 4;

type Storage = { client: S3Client; bucket: string; publicUrl: string };

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

const STORED_YEAR = /\/(\d{4})\/[^/]+$/;

function storedYears(photoUrls: string[]) {
	const years = new Set<number>();
	for (const url of photoUrls) {
		const match = url.match(STORED_YEAR);
		if (match?.[1]) years.add(Number(match[1]));
	}
	return years;
}

function randomColor() {
	return COLORS[Math.floor(Math.random() * COLORS.length)] ?? "silver";
}

export function missingYears(row: {
	yearFrom: number | null;
	yearTo: number | null;
	photoUrls: string[];
}) {
	const have = storedYears(row.photoUrls);
	return sampleYears(row.yearFrom, row.yearTo, null).filter(
		(year) => !have.has(year),
	);
}

export function sampleYears(
	yearFrom: number | null,
	yearTo: number | null,
	target: number | null,
) {
	const from = Math.max(yearFrom ?? FIRST_YEAR, FIRST_YEAR);
	const to = yearTo ?? new Date().getFullYear();
	const years: number[] = [];
	for (let year = from; year < to; year += YEAR_STEP) years.push(year);
	years.push(to);
	const anchor = target ?? to;
	return years.sort((a, b) => Math.abs(a - anchor) - Math.abs(b - anchor));
}

@Injectable()
export class VehicleImagesService {
	private readonly logger = new Logger(VehicleImagesService.name);
	private readonly inFlight = new Set<string>();
	private storageClient: Storage | null = null;

	constructor(@InjectDatabase() private readonly db: Db) {}

	requestImages(make: string, model: string, year: number | null) {
		const key = `${make}|${model}`.toLowerCase();
		if (this.inFlight.has(key) || !this.enabled()) return;
		this.inFlight.add(key);
		void this.importModel(make, model, year)
			.catch((error: unknown) => {
				this.logger.warn(
					{ message: "Vehicle image import failed", make, model },
					error instanceof Error ? error.stack : String(error),
				);
			})
			.finally(() => this.inFlight.delete(key));
	}

	async backfill(limit: number) {
		if (!this.enabled()) return { enabled: false, processed: 0, imported: 0 };
		const incomplete = (
			await this.db.vehicleCatalog.findMany({
				orderBy: { updatedAt: "asc" },
				select: {
					id: true,
					make: true,
					model: true,
					yearFrom: true,
					yearTo: true,
					photoUrls: true,
				},
			})
		).filter((row) => missingYears(row).length > 0);
		const rows = incomplete.slice(0, limit);
		let imported = 0;
		for (const row of rows) {
			try {
				imported += await this.importModel(row.make, row.model, null);
			} catch (error) {
				this.logger.warn(
					{
						message: "Vehicle image import failed",
						make: row.make,
						model: row.model,
					},
					error instanceof Error ? error.stack : String(error),
				);
			}
			await this.db.vehicleCatalog.update({
				where: { id: row.id },
				data: { source: "carimage" },
			});
		}
		return {
			enabled: true,
			processed: rows.length,
			imported,
			remaining: incomplete.length - rows.length,
		};
	}

	private enabled() {
		return Boolean(process.env.CAR_IMAGE_API_KEY?.trim() && this.storage());
	}

	private storage() {
		if (this.storageClient) return this.storageClient;
		const endpoint = process.env.OVH_S3_ENDPOINT?.trim();
		const region = process.env.OVH_S3_REGION?.trim();
		const bucket = process.env.OVH_S3_BUCKET?.trim();
		const accessKeyId = process.env.OVH_S3_ACCESS_KEY?.trim();
		const secretAccessKey = process.env.OVH_S3_SECRET_KEY?.trim();
		const publicUrl = process.env.OVH_S3_PUBLIC_URL?.trim();
		if (
			!endpoint ||
			!region ||
			!bucket ||
			!accessKeyId ||
			!secretAccessKey ||
			!publicUrl
		)
			return null;
		this.storageClient = {
			client: new S3Client({
				endpoint,
				region,
				forcePathStyle: true,
				credentials: { accessKeyId, secretAccessKey },
			}),
			bucket,
			publicUrl: publicUrl.replace(/\/$/, ""),
		};
		return this.storageClient;
	}

	private async importModel(make: string, model: string, year: number | null) {
		const storage = this.storage();
		const apiKey = process.env.CAR_IMAGE_API_KEY?.trim();
		if (!storage || !apiKey) return 0;

		const existing = await this.db.vehicleCatalog.findFirst({
			where: {
				make: { equals: make, mode: "insensitive" },
				model: { equals: model, mode: "insensitive" },
			},
			select: {
				id: true,
				make: true,
				model: true,
				yearFrom: true,
				yearTo: true,
				photoUrls: true,
			},
		});
		const catalogMake = existing?.make ?? make;
		const catalogModel = existing?.model ?? model;
		const catalog =
			existing ??
			(await this.db.vehicleCatalog.create({
				data: {
					make: catalogMake,
					model: catalogModel,
					source: "carimage",
					photoUrls: [],
				},
				select: {
					id: true,
					make: true,
					model: true,
					yearFrom: true,
					yearTo: true,
					photoUrls: true,
				},
			}));

		const have = storedYears(catalog.photoUrls);
		const years = sampleYears(catalog.yearFrom, catalog.yearTo, year).filter(
			(next) => !have.has(next),
		);
		if (years.length === 0) {
			await this.attachPhotos(catalogMake, catalogModel);
			return 0;
		}
		const hadPhotos = catalog.photoUrls.length > 0;
		let stored = 0;

		const keep = async (url: string) => {
			await this.db.vehicleCatalog.update({
				where: { id: catalog.id },
				data: { photoUrls: { push: url } },
			});
			await this.attachPhotos(catalogMake, catalogModel);
			stored += 1;
		};

		let index = 0;
		while (index < years.length && stored === 0 && !hadPhotos) {
			const url = await this.storeYear(
				storage,
				apiKey,
				catalogMake,
				catalogModel,
				years[index] as number,
			);
			index += 1;
			if (url) await keep(url);
		}

		for (; index < years.length; index += YEAR_CONCURRENCY) {
			const urls = await Promise.all(
				years
					.slice(index, index + YEAR_CONCURRENCY)
					.map((next) =>
						this.storeYear(storage, apiKey, catalogMake, catalogModel, next),
					),
			);
			for (const url of urls) if (url) await keep(url);
		}

		if (stored > 0)
			this.logger.log({
				message: "Vehicle images stored",
				make: catalogMake,
				model: catalogModel,
				count: stored,
			});
		return stored;
	}

	private async storeYear(
		storage: Storage,
		apiKey: string,
		make: string,
		model: string,
		year: number,
	) {
		const color = randomColor();
		try {
			const query = new URLSearchParams({
				make,
				model,
				year: String(year),
				view: VIEW,
				color,
				format: FORMAT,
			});
			const response = await fetch(`${CAR_IMAGE_URL}?${query}`, {
				headers: { Authorization: `Bearer ${apiKey}` },
				signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
			});
			if (!response.ok) return null;

			const key = `vehicle-catalog/${segment(make)}/${segment(model)}/${year}/${segment(VIEW)}-${color}.${FORMAT}`;
			await storage.client.send(
				new PutObjectCommand({
					Bucket: storage.bucket,
					Key: key,
					Body: Buffer.from(await response.arrayBuffer()),
					ContentType:
						response.headers.get("content-type")?.split(";")[0]?.trim() ??
						"image/webp",
					ACL: "public-read",
				}),
			);
			return `${storage.publicUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
		} catch (error) {
			this.logger.warn({
				message: "Vehicle image skipped",
				make,
				model,
				year,
				reason: error instanceof Error ? error.message : "unknown",
			});
			return null;
		}
	}

	private async attachPhotos(make: string, model: string) {
		const catalog = await this.db.vehicleCatalog.findFirst({
			where: {
				make: { equals: make, mode: "insensitive" },
				model: { equals: model, mode: "insensitive" },
			},
			select: { photoUrls: true },
		});
		if (!catalog?.photoUrls.length) return;

		const vehicles = await this.db.vehicle.findMany({
			where: {
				make: { equals: make, mode: "insensitive" },
				model: { equals: model, mode: "insensitive" },
				photoUrls: { isEmpty: true },
			},
			select: { id: true, year: true },
		});
		for (const vehicle of vehicles) {
			const photo = closestYearPhoto(catalog.photoUrls, vehicle.year);
			if (photo)
				await this.db.vehicle.update({
					where: { id: vehicle.id },
					data: { photoUrls: [photo] },
				});
		}
	}
}
