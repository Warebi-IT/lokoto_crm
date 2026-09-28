import type { Db } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";

export type SearchHit = {
	kind: "contact" | "vehicle" | "rentalContract";
	id: string;
	label: string;
	detail: string | null;
	iconUrl: string | null;
	iconDarkUrl: string | null;
	iconTone: string | null;
	imageUrl: string | null;
};

const PER_KIND = 5;

@Injectable()
export class SearchService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async quick(q: string): Promise<{ hits: SearchHit[] }> {
		const term = q.trim();
		if (term.length < 2) return { hits: [] };

		const [contacts, vehicles, rentalContracts] = await Promise.all([
			this.db.contact.findMany({
				where: {
					OR: [
						{ firstName: { contains: term, mode: "insensitive" } },
						{ lastName: { contains: term, mode: "insensitive" } },
						{ email: { contains: term, mode: "insensitive" } },
					],
				},
				take: PER_KIND,
				orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
				select: {
					id: true,
					firstName: true,
					lastName: true,
					email: true,
					imageUrl: true,
				},
			}),
			this.db.vehicle.findMany({
				where: {
					OR: [
						{ plateNumber: { contains: term, mode: "insensitive" } },
						{ make: { contains: term, mode: "insensitive" } },
						{ model: { contains: term, mode: "insensitive" } },
					],
				},
				take: PER_KIND,
				orderBy: [{ plateNumber: "asc" }],
				select: { id: true, plateNumber: true, make: true, model: true },
			}),
			this.db.rentalContract.findMany({
				where: {
					OR: [
						{
							vehicle: { plateNumber: { contains: term, mode: "insensitive" } },
						},
						{ contact: { firstName: { contains: term, mode: "insensitive" } } },
						{ contact: { lastName: { contains: term, mode: "insensitive" } } },
					],
				},
				take: PER_KIND,
				orderBy: [{ startDate: "desc" }],
				select: {
					id: true,
					status: true,
					vehicle: { select: { plateNumber: true } },
					contact: { select: { firstName: true, lastName: true } },
				},
			}),
		]);

		return {
			hits: [
				...contacts.map(
					(contact): SearchHit => ({
						kind: "contact",
						id: contact.id,
						label:
							[contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
							(contact.email ?? "Unnamed"),
						detail: contact.email,
						iconUrl: null,
						iconDarkUrl: null,
						iconTone: null,
						imageUrl: contact.imageUrl,
					}),
				),
				...vehicles.map(
					(vehicle): SearchHit => ({
						kind: "vehicle",
						id: vehicle.id,
						label: `${vehicle.make} ${vehicle.model}`,
						detail: vehicle.plateNumber,
						iconUrl: null,
						iconDarkUrl: null,
						iconTone: null,
						imageUrl: null,
					}),
				),
				...rentalContracts.map(
					(contract): SearchHit => ({
						kind: "rentalContract",
						id: contract.id,
						label:
							[contract.contact.firstName, contract.contact.lastName]
								.filter(Boolean)
								.join(" ") || contract.vehicle.plateNumber,
						detail: contract.vehicle.plateNumber,
						iconUrl: null,
						iconDarkUrl: null,
						iconTone: null,
						imageUrl: null,
					}),
				),
			],
		};
	}
}
