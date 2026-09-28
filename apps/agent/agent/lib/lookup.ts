import { db, RentalContractStatus } from "@crm/db";
import { OPEN_RENTAL_STATUSES } from "@crm/db/rental-status";
import { normalise } from "./names";

export type RecordKind = "contact" | "rentalContract";

export type ContactHit = {
	kind: "contact";
	id: string;
	name: string;
	title: string | null;
	email: string | null;
	lastActivityAt: string | null;
};

export type RentalContractHit = {
	kind: "rentalContract";
	id: string;
	vehicle: string;
	status: string;
	totalAmount: number | null;
	currency: string;
	contact: { id: string; name: string };
};

export type SearchHit = ContactHit | RentalContractHit;

export type SearchResult = {
	query: string;
	contacts: ContactHit[];
	rentalContracts: RentalContractHit[];
	total: number;
};

export type RentalContractListStatus =
	| "open"
	| "completed"
	| "cancelled"
	| "all";

export type RentalContractListOptions = {
	status?: RentalContractListStatus;
	inactiveForDays?: number;
	vehicleId?: string;
	ownerId?: string;
	limit?: number;
	cursor?: string;
	now?: Date;
};

export async function listRentalContracts(
	options: RentalContractListOptions = {},
) {
	const status = options.status ?? "open";
	const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
	const now = options.now ?? new Date();
	const cutoff =
		options.inactiveForDays === undefined
			? null
			: new Date(
					now.getTime() - Math.max(options.inactiveForDays, 0) * 86_400_000,
				);
	const statuses =
		status === "open"
			? [...OPEN_RENTAL_STATUSES]
			: status === "completed"
				? [RentalContractStatus.COMPLETED]
				: status === "cancelled"
					? [RentalContractStatus.CANCELLED]
					: null;

	const rows = await db.rentalContract.findMany({
		where: {
			...(statuses ? { status: { in: statuses } } : {}),
			...(options.vehicleId ? { vehicleId: options.vehicleId } : {}),
			...(options.ownerId ? { ownerId: options.ownerId } : {}),
			...(cutoff
				? {
						OR: [
							{ lastActivityAt: { lte: cutoff } },
							{ lastActivityAt: null, createdAt: { lte: cutoff } },
						],
					}
				: {}),
		},
		orderBy: [
			{ lastActivityAt: { sort: "asc", nulls: "first" } },
			{ createdAt: "asc" },
			{ id: "asc" },
		],
		...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
		take: limit + 1,
		select: {
			id: true,
			status: true,
			totalAmount: true,
			currency: true,
			createdAt: true,
			lastActivityAt: true,
			startDate: true,
			endDate: true,
			vehicle: {
				select: { id: true, make: true, model: true, plateNumber: true },
			},
			contact: { select: { id: true, firstName: true, lastName: true } },
			owner: { select: { id: true, name: true, email: true, image: true } },
		},
	});
	const hasMore = rows.length > limit;
	const page = rows.slice(0, limit);

	return {
		criteria: {
			status,
			inactiveForDays: options.inactiveForDays ?? null,
			vehicleId: options.vehicleId ?? null,
			ownerId: options.ownerId ?? null,
		},
		asOf: now.toISOString(),
		rentalContracts: page.map((contract) => {
			const activityDate = contract.lastActivityAt ?? contract.createdAt;
			return {
				id: contract.id,
				vehicle: `${contract.vehicle.make} ${contract.vehicle.model} (${contract.vehicle.plateNumber})`,
				status: contract.status,
				totalAmount:
					contract.totalAmount === null ? null : Number(contract.totalAmount),
				currency: contract.currency,
				contact: {
					id: contract.contact.id,
					name: [contract.contact.firstName, contract.contact.lastName]
						.filter(Boolean)
						.join(" "),
				},
				owner: contract.owner,
				createdAt: contract.createdAt.toISOString(),
				lastActivityAt: contract.lastActivityAt?.toISOString() ?? null,
				daysSinceLastActivity: Math.max(
					0,
					Math.floor((now.getTime() - activityDate.getTime()) / 86_400_000),
				),
				neverActive: contract.lastActivityAt === null,
				startDate: contract.startDate.toISOString(),
				endDate: contract.endDate.toISOString(),
			};
		}),
		hasMore,
		nextCursor: hasMore ? page.at(-1)?.id : null,
	};
}

export async function searchCrm(
	query: string,
	options: { kinds?: RecordKind[]; limit?: number } = {},
): Promise<SearchResult> {
	const term = query.trim();
	const kinds = options.kinds ?? ["contact", "rentalContract"];
	const limit = options.limit ?? 10;

	if (term.length < 2) {
		return {
			query: term,
			contacts: [],
			rentalContracts: [],
			total: 0,
		};
	}

	const wants = (kind: RecordKind) => kinds.includes(kind);
	const email = term.includes("@") ? term.toLowerCase() : null;
	const words = term.split(/\s+/).filter((word) => word.length >= 2);

	const [contacts, rentalContracts] = await Promise.all([
		wants("contact") ? searchContacts(term, words, email, limit) : [],
		wants("rentalContract") ? searchRentalContracts(term, words, limit) : [],
	]);

	return {
		query: term,
		contacts,
		rentalContracts,
		total: contacts.length + rentalContracts.length,
	};
}

async function searchContacts(
	term: string,
	words: string[],
	email: string | null,
	limit: number,
): Promise<ContactHit[]> {
	const contains = words.flatMap((word) => [
		{ firstName: { contains: word, mode: "insensitive" as const } },
		{ lastName: { contains: word, mode: "insensitive" as const } },
		{ email: { contains: word, mode: "insensitive" as const } },
	]);

	const rows = await db.contact.findMany({
		where: {
			OR: [
				...(email
					? [{ email: { equals: email, mode: "insensitive" as const } }]
					: []),
				...contains,
			],
		},
		orderBy: [{ lastActivityAt: "desc" }, { createdAt: "asc" }],
		take: limit * 3,
		select: {
			id: true,
			firstName: true,
			lastName: true,
			title: true,
			email: true,
			lastActivityAt: true,
		},
	});

	return rows
		.map((row) => {
			const name = [row.firstName, row.lastName].filter(Boolean).join(" ");
			return {
				score: score(term, [name, row.email ?? ""]),
				hit: {
					kind: "contact" as const,
					id: row.id,
					name,
					title: row.title,
					email: row.email,
					lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
				},
			};
		})
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map((row) => row.hit);
}

async function searchRentalContracts(
	term: string,
	words: string[],
	limit: number,
): Promise<RentalContractHit[]> {
	const rows = await db.rentalContract.findMany({
		where: {
			OR: [
				{ vehicle: { plateNumber: { contains: term, mode: "insensitive" } } },
				{ vehicle: { make: { contains: term, mode: "insensitive" } } },
				{ vehicle: { model: { contains: term, mode: "insensitive" } } },
				...words.map((word) => ({
					contact: {
						OR: [
							{ firstName: { contains: word, mode: "insensitive" as const } },
							{ lastName: { contains: word, mode: "insensitive" as const } },
						],
					},
				})),
			],
		},
		orderBy: [{ lastActivityAt: "desc" }, { createdAt: "desc" }],
		take: limit * 3,
		select: {
			id: true,
			status: true,
			totalAmount: true,
			currency: true,
			vehicle: { select: { make: true, model: true, plateNumber: true } },
			contact: { select: { id: true, firstName: true, lastName: true } },
		},
	});

	return rows
		.map((row) => {
			const vehicleLabel = `${row.vehicle.make} ${row.vehicle.model} ${row.vehicle.plateNumber}`;
			const contactName = [row.contact.firstName, row.contact.lastName]
				.filter(Boolean)
				.join(" ");
			return {
				score: score(term, [vehicleLabel, contactName]),
				hit: {
					kind: "rentalContract" as const,
					id: row.id,
					vehicle: vehicleLabel,
					status: row.status,
					totalAmount:
						row.totalAmount === null ? null : Number(row.totalAmount),
					currency: row.currency,
					contact: { id: row.contact.id, name: contactName },
				},
			};
		})
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map((row) => row.hit);
}

function score(term: string, fields: string[]): number {
	const needle = normalise(term);
	if (!needle) return 0;

	let best = 0;
	for (const field of fields) {
		const hay = normalise(field);
		if (!hay) continue;
		if (hay === needle) best = Math.max(best, 4);
		else if (hay.startsWith(needle)) best = Math.max(best, 3);
		else if (hay.includes(needle)) best = Math.max(best, 2);
	}
	if (best > 0) return best;

	const words = term
		.split(/\s+/)
		.map(normalise)
		.filter((word) => word.length >= 2);
	if (words.length === 0) return 0;

	const hay = fields.map(normalise).join(" ");
	return words.filter((word) => hay.includes(word)).length / words.length;
}
