import {
	type ContactBriefSections,
	ContactGender,
	type Db,
	type FactEvidence,
	FactStatus,
	type Prisma,
	Prisma as PrismaNamespace,
	type RecordSource,
} from "@crm/db";
import { blobEnabled } from "@crm/db/blob";
import {
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import { AgentQueueService } from "../agent/agent-queue.service";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import {
	ActivityStampService,
	type StampTargets,
} from "../crm/activity-stamp.service";
import { type BulkResult, runBulk } from "../crm/bulk";
import { blankToNull, normalizeEmail, toCents } from "../crm/values";
import { InjectDatabase } from "../database/database.constants";
import { FieldsService } from "../fields/fields.service";
import {
	countsByKey,
	FACET_ALL,
	type ListResult,
	paginate,
	resolveOrderBy,
} from "../trpc/list-input";
import type {
	ContactCreateInput,
	ContactDocumentUploadInput,
	ContactListInput,
	ContactUpdateInput,
	FactDecisionInput,
} from "./contacts.contracts";

const RENTAL_CONTRACT_SELECT = {
	id: true,
	status: true,
	startDate: true,
	endDate: true,
	totalAmount: true,
	currency: true,
	vehicle: {
		select: { id: true, plateNumber: true, make: true, model: true },
	},
} as const;

type ContactRentalContractRow = Prisma.RentalContractGetPayload<{
	select: typeof RENTAL_CONTRACT_SELECT;
}>;

function serializeRentalContract(contract: ContactRentalContractRow) {
	const { totalAmount, startDate, endDate, ...rest } = contract;

	return {
		...rest,
		totalAmountCents: toCents(totalAmount),
		startDate: startDate.toISOString(),
		endDate: endDate.toISOString(),
	};
}

const FACT_COLUMNS: Record<string, string | undefined> = {
	title: "title",
	linkedinUrl: "linkedinUrl",
	twitterUrl: "twitterUrl",
	githubUrl: "githubUrl",
};

export type ContactRow = {
	id: string;
	firstName: string;
	lastName: string | null;
	gender: ContactGender;
	email: string | null;
	phone: string | null;
	title: string | null;
	imageUrl: string | null;
	documentTypes: string[];
	lastActivityAt: string | null;
	createdAt: string;
	fields: Record<string, string | number | boolean | null>;
};

const SORTABLE: Record<
	string,
	(dir: Prisma.SortOrder) => Prisma.ContactOrderByWithRelationInput[]
> = {
	name: (dir) => [{ lastName: dir }, { firstName: dir }],
	email: (dir) => [{ email: dir }],
	title: (dir) => [{ title: dir }, { lastName: "asc" }],
	createdAt: (dir) => [{ createdAt: dir }],
	lastActivity: (dir) => [{ lastActivityAt: { sort: dir, nulls: "last" } }],
};

@Injectable()
export class ContactsService {
	private readonly logger = new Logger(ContactsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly agent: AgentTriggerService,
		private readonly queue: AgentQueueService,
		private readonly stamp: ActivityStampService,
		private readonly fields: FieldsService,
	) {}

	async options(q: string) {
		return this.db.contact.findMany({
			where: this.searchFilter(q),
			select: {
				id: true,
				firstName: true,
				lastName: true,
				gender: true,
				email: true,
				imageUrl: true,
			},
			orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
			take: 100,
		});
	}

	async list(input: ContactListInput): Promise<ListResult<ContactRow>> {
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);

		const [rows, total, facetCounts] = await Promise.all([
			this.db.contact.findMany({
				where,
				skip,
				take,
				orderBy: resolveOrderBy(input, SORTABLE, [{ createdAt: "desc" }]),
				select: {
					id: true,
					firstName: true,
					lastName: true,
					gender: true,
					email: true,
					phone: true,
					title: true,
					imageUrl: true,
					documents: { select: { type: true } },
					source: true,
					lastActivityAt: true,
					createdAt: true,
				},
			}),
			this.db.contact.count({ where }),
			this.facetCounts(input),
		]);

		const tableFields = await this.fields.tableValuesFor(
			"CONTACT",
			rows.map((row) => row.id),
		);

		return {
			rows: rows.map(({ documents, ...row }) => ({
				...row,
				documentTypes: [...new Set(documents.map((document) => document.type))],
				lastActivityAt: row.lastActivityAt?.toISOString() ?? null,
				createdAt: row.createdAt.toISOString(),
				fields: tableFields.get(row.id) ?? {},
			})),
			total,
			facetCounts,
		};
	}

	async byId(id: string) {
		const contact = await this.db.contact.findUnique({
			where: { id },
			select: {
				id: true,
				firstName: true,
				lastName: true,
				gender: true,
				email: true,
				phone: true,
				title: true,
				linkedinUrl: true,
				twitterUrl: true,
				githubUrl: true,
				imageUrl: true,
				enrichmentStatus: true,
				enrichmentError: true,
				createdAt: true,
				brief: {
					select: {
						narrative: true,
						sections: true,
						score: true,
						sourceUrl: true,
						refreshedAt: true,
					},
				},
				facts: {
					where: { status: { in: [FactStatus.APPLIED, FactStatus.PROPOSED] } },
					orderBy: { observedAt: "desc" },
					select: {
						id: true,
						field: true,
						value: true,
						score: true,
						band: true,
						evidence: true,
						method: true,
						sourceUrl: true,
						status: true,
						observedAt: true,
					},
				},
				rentalContracts: {
					orderBy: { startDate: "desc" },
					select: RENTAL_CONTRACT_SELECT,
				},
				driverOn: {
					select: { role: true, contract: { select: RENTAL_CONTRACT_SELECT } },
				},
				documents: {
					orderBy: { createdAt: "desc" },
					select: {
						id: true,
						type: true,
						url: true,
						fileName: true,
						contentType: true,
						createdAt: true,
					},
				},
			},
		});

		if (!contact) {
			throw new NotFoundException(`No contact with id ${id}.`);
		}

		const relationship = await this.relationship(id);

		const {
			rentalContracts,
			driverOn,
			createdAt,
			brief,
			facts,
			documents,
			...rest
		} = contact;

		const asPrimary = rentalContracts.map((contract) => ({
			...serializeRentalContract(contract),
			role: "PRIMARY" as const,
		}));

		const asDriver = driverOn.map(({ role, contract }) => ({
			...serializeRentalContract(contract),
			role,
		}));

		return {
			...rest,
			fields: await this.fields.valuesFor("CONTACT", id),
			queued: await this.queue.isQueued({ contactId: id }),
			createdAt: createdAt.toISOString(),
			brief: brief
				? {
						...brief,
						sections: brief.sections as ContactBriefSections,
						refreshedAt: brief.refreshedAt.toISOString(),
					}
				: null,
			facts: facts.map((fact) => ({
				...fact,
				evidence: fact.evidence as FactEvidence[],
				observedAt: fact.observedAt.toISOString(),
			})),
			documents: documents.map((document) => ({
				...document,
				createdAt: document.createdAt.toISOString(),
			})),
			relationship,
			rentalContracts: [...asPrimary, ...asDriver].sort((a, b) =>
				b.startDate.localeCompare(a.startDate),
			),
		};
	}

	async create(input: ContactCreateInput) {
		const email = normalizeEmail(input.email ?? "");

		if (email) {
			const existing = await this.db.contact.findFirst({
				where: { email: { equals: email, mode: "insensitive" } },
				select: { id: true, firstName: true, lastName: true },
			});
			if (existing) {
				throw new ConflictException(
					`${[existing.firstName, existing.lastName].filter(Boolean).join(" ")} already uses ${email}.`,
				);
			}
		}

		const contact = await this.db.$transaction(async (tx) => {
			await this.allowAgain(tx, email);

			return tx.contact.create({
				data: {
					firstName: input.firstName.trim(),
					lastName: blankToNull(input.lastName ?? ""),
					gender: input.gender ?? ContactGender.H,
					email,
					phone: blankToNull(input.phone ?? ""),
					title: blankToNull(input.title ?? ""),
				},
				select: { id: true, firstName: true, lastName: true, gender: true },
			});
		});

		this.logger.log({ message: "Contact created", contactId: contact.id });

		await this.agent.contactCreated(
			contact.id,
			"Added by a rep, with nothing on the record yet",
		);

		return contact;
	}

	async delete(id: string): Promise<{ id: string; name: string }> {
		let deleted: {
			targets: StampTargets;
			name: string;
			suppressed: boolean;
		};

		try {
			deleted = await this.db.$transaction(async (tx) => {
				const targets = await this.stamp.targetsOf({ contactId: id }, tx);

				await tx.agentTask.deleteMany({ where: { contactId: id } });
				await tx.agentEvent.deleteMany({ where: { contactId: id } });

				const contact = await tx.contact.delete({
					where: { id },
					select: { firstName: true, lastName: true, email: true },
				});

				const name = [contact.firstName, contact.lastName]
					.filter(Boolean)
					.join(" ");
				const suppress = normalizeEmail(contact.email ?? "");

				if (suppress) {
					await tx.suppressedContact.upsert({
						where: { email: suppress },
						create: {
							email: suppress,
							reason: `Deleted from the CRM (${name})`,
						},
						update: {},
					});
				}

				return { targets, name, suppressed: suppress !== null };
			});
		} catch (error) {
			throw this.translate(error, id);
		}

		await this.stamp.recomputeAfterDelete(deleted.targets, { contactId: id });

		this.logger.log({
			message: "Contact deleted",
			contactId: id,
			suppressed: deleted.suppressed,
		});

		return { id, name: deleted.name };
	}

	async update(id: string, input: ContactUpdateInput) {
		const data: Prisma.ContactUpdateInput = {};

		if (input.firstName !== undefined) data.firstName = input.firstName.trim();
		if (input.lastName !== undefined)
			data.lastName = blankToNull(input.lastName);
		if (input.gender !== undefined) data.gender = input.gender;
		if (input.email !== undefined) data.email = normalizeEmail(input.email);
		if (input.phone !== undefined) data.phone = blankToNull(input.phone);
		if (input.title !== undefined) data.title = blankToNull(input.title);
		if (input.linkedinUrl !== undefined) {
			data.linkedinUrl = blankToNull(input.linkedinUrl);
		}
		if (input.twitterUrl !== undefined) {
			data.twitterUrl = blankToNull(input.twitterUrl);
		}
		if (input.githubUrl !== undefined) {
			data.githubUrl = blankToNull(input.githubUrl);
		}
		try {
			return await this.db.$transaction(async (tx) => {
				if (input.fields) {
					await this.fields.applyValues(tx, "CONTACT", id, input.fields);
				}

				const updated = await tx.contact.update({
					where: { id },
					data,
					select: { id: true, firstName: true, lastName: true, gender: true },
				});

				if (typeof data.email === "string") {
					await this.allowAgain(tx, data.email);
				}

				return updated;
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async bulkEnrich(ids: string[]): Promise<BulkResult> {
		return runBulk(ids, (id) => this.enrich(id));
	}

	async bulkDelete(ids: string[]): Promise<BulkResult> {
		return runBulk(ids, (id) => this.delete(id));
	}

	private async allowAgain(
		tx: Prisma.TransactionClient,
		email: string | null,
	): Promise<void> {
		if (!email) return;
		await tx.suppressedContact.deleteMany({
			where: { email: { equals: email, mode: "insensitive" } },
		});
	}

	private async relationship(contactId: string) {
		const now = new Date();

		const [threads, lastReply, meetings, nextMeeting] = await Promise.all([
			this.db.emailThread.aggregate({
				where: { contactId },
				_sum: { messageCount: true },
				_count: { _all: true },
			}),
			this.db.emailMessage.findFirst({
				where: { thread: { contactId }, direction: "INBOUND" },
				orderBy: { sentAt: "desc" },
				select: { sentAt: true },
			}),
			this.db.calendarEvent.count({
				where: {
					OR: [{ contactId }, { attendees: { some: { contactId } } }],
				},
			}),
			this.db.calendarEvent.findFirst({
				where: {
					startsAt: { gt: now },
					OR: [{ contactId }, { attendees: { some: { contactId } } }],
				},
				orderBy: { startsAt: "asc" },
				select: { title: true, startsAt: true },
			}),
		]);

		return {
			emails: threads._sum.messageCount ?? 0,
			threads: threads._count._all,
			lastReplyAt: lastReply?.sentAt.toISOString() ?? null,
			meetings,
			nextMeeting: nextMeeting
				? {
						title: nextMeeting.title,
						startsAt: nextMeeting.startsAt.toISOString(),
					}
				: null,
		};
	}

	async enrich(id: string): Promise<{ id: string; queued: true }> {
		const contact = await this.db.contact.findUnique({
			where: { id },
			select: { id: true, imageUrl: true, linkedinUrl: true },
		});

		if (!contact) {
			throw new NotFoundException(`No contact with id ${id}.`);
		}

		await this.db.contact.update({
			where: { id },
			data: { enrichmentStatus: "PENDING", enrichmentError: null },
		});

		await this.agent.contactCreated(
			id,
			contact.linkedinUrl && !contact.imageUrl
				? "A rep asked for a fresh look — they have a LinkedIn profile on file but no picture"
				: "A rep asked for a fresh look",
		);

		return { id, queued: true };
	}

	async decideFact(
		input: FactDecisionInput,
		userId: string,
	): Promise<{ contactId: string; field: string; applied: boolean }> {
		const fact = await this.db.contactFact.findUnique({
			where: { id: input.factId },
			select: {
				id: true,
				contactId: true,
				field: true,
				value: true,
				status: true,
			},
		});

		if (!fact) {
			throw new NotFoundException(`No fact with id ${input.factId}.`);
		}

		if (fact.status !== FactStatus.PROPOSED) {
			throw new ConflictException("That suggestion has already been settled.");
		}

		const accepted = input.decision === "accept";
		const column = FACT_COLUMNS[fact.field];

		await this.db.$transaction(async (tx) => {
			if (accepted) {
				await tx.contactFact.updateMany({
					where: {
						contactId: fact.contactId,
						field: fact.field,
						status: FactStatus.APPLIED,
					},
					data: { status: FactStatus.SUPERSEDED, supersededAt: new Date() },
				});
			}

			await tx.contactFact.update({
				where: { id: fact.id },
				data: {
					status: accepted ? FactStatus.APPLIED : FactStatus.DISMISSED,
					decidedById: userId,
					decidedAt: new Date(),
				},
			});

			if (accepted && column) {
				await tx.contact.update({
					where: { id: fact.contactId },
					data: { [column]: fact.value },
				});
			}

			if (accepted && fact.field === "name") {
				const [firstName, ...rest] = fact.value.trim().split(/\s+/);
				if (firstName) {
					await tx.contact.update({
						where: { id: fact.contactId },
						data: {
							firstName,
							lastName: rest.length > 0 ? rest.join(" ") : null,
						},
					});
				}
			}
		});

		this.logger.log({
			message: "Fact decided",
			factId: fact.id,
			contactId: fact.contactId,
			field: fact.field,
			decision: input.decision,
		});

		return { contactId: fact.contactId, field: fact.field, applied: accepted };
	}

	async uploadDocument(
		contactId: string,
		file: { buffer: Buffer; mimetype: string; originalname: string },
		input: ContactDocumentUploadInput,
	) {
		const contact = await this.db.contact.findUnique({
			where: { id: contactId },
			select: { id: true },
		});
		if (!contact)
			throw new NotFoundException(`No contact with id ${contactId}.`);
		if (!blobEnabled())
			return { stored: false as const, reason: "storage_unavailable" };

		const safeName =
			file.originalname.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) ||
			"document";
		const path = `contacts/${contactId}/${input.type.toLowerCase()}/${safeName}`;
		const { put } = await import("@vercel/blob");
		const blob = await put(path, file.buffer, {
			access: "public",
			contentType: file.mimetype,
			addRandomSuffix: true,
		});

		const document = await this.db.contactDocument.create({
			data: {
				contactId,
				type: input.type,
				url: blob.url,
				fileName: file.originalname,
				contentType: file.mimetype,
			},
		});

		this.logger.log({
			message: "Contact document uploaded",
			contactId,
			documentId: document.id,
			type: document.type,
		});

		return {
			stored: true as const,
			document: this.serializeDocument(document),
		};
	}

	async deleteDocument(contactId: string, documentId: string) {
		const document = await this.db.contactDocument.findFirst({
			where: { id: documentId, contactId },
			select: { id: true, url: true },
		});
		if (!document) {
			throw new NotFoundException(`No document with id ${documentId}.`);
		}

		if (blobEnabled()) {
			try {
				const { del } = await import("@vercel/blob");
				await del(document.url);
			} catch (error) {
				this.logger.warn({
					message: "Failed to delete contact document blob",
					contactId,
					documentId,
					reason: error instanceof Error ? error.message : String(error),
				});
			}
		}

		await this.db.contactDocument.delete({ where: { id: documentId } });

		return { id: documentId };
	}

	private serializeDocument(document: {
		id: string;
		type: string;
		url: string;
		fileName: string | null;
		contentType: string | null;
		createdAt: Date;
	}) {
		return { ...document, createdAt: document.createdAt.toISOString() };
	}

	private searchFilter(q: string): Prisma.ContactWhereInput {
		const term = q.trim();
		if (!term) return {};

		return {
			OR: [
				{ firstName: { contains: term, mode: "insensitive" } },
				{ lastName: { contains: term, mode: "insensitive" } },
				{ email: { contains: term, mode: "insensitive" } },
			],
		};
	}

	private buildWhere(input: ContactListInput): Prisma.ContactWhereInput {
		const where: Prisma.ContactWhereInput = {
			...this.searchFilter(input.q),
		};

		if (input.source !== FACET_ALL) {
			where.source = input.source as RecordSource;
		}

		return where;
	}

	private async facetCounts(input: ContactListInput) {
		const where = this.searchFilter(input.q);

		const [sources] = await Promise.all([
			this.db.contact.groupBy({
				by: ["source"],
				where,
				_count: { _all: true },
			}),
		]);

		return { source: countsByKey(sources, "source") };
	}

	private translate(error: unknown, id: string): unknown {
		if (error instanceof PrismaNamespace.PrismaClientKnownRequestError) {
			if (error.code === "P2025") {
				return new NotFoundException(`No contact with id ${id}.`);
			}
			if (error.code === "P2002") {
				return new ConflictException(
					"Another contact already uses that email address.",
				);
			}
		}
		return error;
	}
}
