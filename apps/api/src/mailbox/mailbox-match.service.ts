import { workspaceDomains } from "@crm/auth/workspace";
import { type Db, RecordSource } from "@crm/db";
import { Injectable } from "@nestjs/common";
import { AgentTriggerService } from "../agent/agent-trigger.service";
import { EnrichmentLogService } from "../crm/enrichment-log.service";
import { InjectDatabase } from "../database/database.constants";
import {
	dominantDomain,
	externalParticipants,
	isDerivedName,
	type Participant,
	splitName,
	workDomain,
} from "./participants";

export type SyncRecordSource =
	| typeof RecordSource.EMAIL
	| typeof RecordSource.CALENDAR;

export type MatchResult = {
	contactId: string | null;
	external: Participant[];
};

export type MatchContext = {
	ourAddresses: ReadonlySet<string>;
	ourDomains: ReadonlySet<string>;
	suppressedDomains: ReadonlySet<string>;
	suppressedEmails: ReadonlySet<string>;
};

export type MatchRequest = {
	participants: readonly Participant[];
	allowCreate: boolean;
	source: SyncRecordSource;
	ownerId: string;
};

@Injectable()
export class MailboxMatchService {
	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly agent: AgentTriggerService,
		private readonly log: EnrichmentLogService,
	) {}

	async internalIdentity(): Promise<{
		addresses: Set<string>;
		domains: Set<string>;
	}> {
		const users = await this.db.user.findMany({ select: { email: true } });

		const addresses = new Set<string>();
		const domains = new Set<string>(workspaceDomains());

		for (const user of users) {
			const email = user.email.toLowerCase();
			addresses.add(email);

			const domain = workDomain(email);
			if (domain) domains.add(domain);
		}

		return { addresses, domains };
	}

	async suppressedDomains(): Promise<Set<string>> {
		const rows = await this.db.suppressedDomain.findMany({
			select: { domain: true },
		});
		return new Set(rows.map((row) => row.domain));
	}

	async suppressedEmails(): Promise<Set<string>> {
		const rows = await this.db.suppressedContact.findMany({
			select: { email: true },
		});
		return new Set(rows.map((row) => row.email.toLowerCase()));
	}

	async resolve(
		request: MatchRequest,
		context: MatchContext,
	): Promise<MatchResult> {
		const external = externalParticipants(request.participants, {
			ourDomains: context.ourDomains,
			ourAddresses: context.ourAddresses,
			suppressedDomains: context.suppressedDomains,
			suppressedEmails: context.suppressedEmails,
		});

		if (external.length === 0) {
			return { contactId: null, external };
		}

		const contact = await this.db.contact.findFirst({
			where: { email: { in: external.map((person) => person.email) } },
			select: { id: true },
		});

		if (contact) {
			return { contactId: contact.id, external };
		}

		if (!request.allowCreate) {
			return { contactId: null, external };
		}

		const domain = dominantDomain(external);
		if (!domain) return { contactId: null, external };

		return this.create(external, domain, request);
	}

	private async create(
		external: Participant[],
		domain: string,
		request: MatchRequest,
	): Promise<MatchResult> {
		const contactId = await this.createContact(external, domain, request);
		return { contactId, external };
	}

	private async createContact(
		external: Participant[],
		domain: string,
		request: MatchRequest,
	): Promise<string | null> {
		const person = external.find(
			(candidate) => workDomain(candidate.email) === domain,
		);
		if (!person) return null;

		const { firstName, lastName } = splitName(person.name, person.email);

		const existing = await this.db.contact.findUnique({
			where: { email: person.email },
			select: { id: true },
		});

		const contact = await this.db.contact.upsert({
			where: { email: person.email },
			create: {
				firstName,
				lastName,
				email: person.email,
				source: request.source,
			},
			update: {},
			select: { id: true, firstName: true, lastName: true },
		});

		if (!existing) {
			await this.log.record({
				contactId: contact.id,
				subject: "Contact added from your inbox",
				body: `${person.email} appeared in a ${request.source === "CALENDAR" ? "meeting" : "thread"}.`,
				meta: { source: request.source },
			});
		}

		const hasRealName = Boolean(person.name?.trim());
		const isPlaceholder = isDerivedName(
			person.email,
			contact.firstName,
			contact.lastName,
		);

		if (hasRealName && isPlaceholder) {
			await this.db.contact.update({
				where: { id: contact.id },
				data: { firstName, lastName },
			});
			return contact.id;
		}

		if (isPlaceholder && !hasRealName) {
			await this.agent.contactCreated(
				contact.id,
				"Created by the sync from an address, with no name on it",
			);
		}

		return contact.id;
	}
}
