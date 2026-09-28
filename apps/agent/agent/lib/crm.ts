import { db, EnrichmentStatus } from "@crm/db";
import { isDerivedName } from "./names";
import type { Person } from "./socials";

export type WorkItem = {
	id: string;
	fullName: string;
	email: string | null;
	title: string | null;
	linkedinUrl: string | null;
	needs: {
		identity: boolean;
		brief: boolean;
		socials: boolean;
	};
};

export async function contactsNeedingWork(limit: number): Promise<WorkItem[]> {
	const rows = await db.contact.findMany({
		where: {
			OR: [
				{ brief: { is: null } },
				{ socialsCheckedAt: null },
				{ AND: [{ email: { not: null } }, { lastName: null }] },
			],
		},
		select: {
			id: true,
			email: true,
			firstName: true,
			lastName: true,
			title: true,
			linkedinUrl: true,
			socialsCheckedAt: true,
			brief: { select: { contactId: true } },
		},
		orderBy: { createdAt: "asc" },
		take: limit,
	});

	return rows.map((row) => ({
		id: row.id,
		fullName: [row.firstName, row.lastName].filter(Boolean).join(" "),
		email: row.email,
		title: row.title,
		linkedinUrl: row.linkedinUrl,
		needs: {
			identity: isDerivedName(row.email, row.firstName, row.lastName),
			brief: row.brief === null,
			socials: row.socialsCheckedAt === null,
		},
	}));
}

export async function personForVerification(
	contactId: string,
): Promise<Person | null> {
	const contact = await db.contact.findUnique({
		where: { id: contactId },
		select: {
			firstName: true,
			lastName: true,
			title: true,
			email: true,
		},
	});

	if (!contact) return null;

	return {
		firstName: contact.firstName,
		lastName: contact.lastName,
		fullName: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
		title: contact.title,
	};
}

export async function contactProfileSlug(
	contactId: string,
): Promise<{ slug: string; profileUrl: string } | null> {
	const contact = await db.contact.findUnique({
		where: { id: contactId },
		select: { linkedinUrl: true },
	});

	const slug = linkedinSlug(contact?.linkedinUrl ?? null);
	return slug
		? { slug, profileUrl: `https://www.linkedin.com/in/${slug}` }
		: null;
}

export function linkedinSlug(url: string | null): string | null {
	if (!url) return null;
	const match = /linkedin\.com\/in\/([A-Za-z0-9\-_%]+)/.exec(url);
	return match?.[1] ?? null;
}

export type CrmHistory = {
	contact: {
		fullName: string;
		email: string | null;
		title: string | null;
	};
	rentalContracts: {
		id: string;
		vehicle: string;
		status: string;
		role: string;
		totalAmount: number | null;
		currency: string;
		startDate: string;
		endDate: string;
	}[];
	threads: {
		subject: string | null;
		messageCount: number;
		lastMessageAt: string;
		messages: {
			direction: string;
			from: string;
			fromName: string | null;
			sentAt: string;
			body: string | null;
		}[];
	}[];
	meetings: {
		title: string | null;
		startsAt: string;
		attended: boolean;
		attendees: { email: string; name: string | null }[];
	}[];
	stats: {
		emails: number;
		theyReplied: boolean;
		lastReplyAt: string | null;
		meetings: number;
		nextMeetingAt: string | null;
	};
};

export async function readCrmHistory(
	contactId: string,
	options: {
		threads?: number;
		messagesPerThread?: number;
		includeEmail?: boolean;
		includeCalendar?: boolean;
	} = {},
): Promise<CrmHistory | null> {
	const contact = await db.contact.findUnique({
		where: { id: contactId },
		select: {
			id: true,
			firstName: true,
			lastName: true,
			email: true,
			title: true,
			rentalContracts: {
				orderBy: { lastActivityAt: "desc" },
				select: {
					id: true,
					status: true,
					totalAmount: true,
					currency: true,
					startDate: true,
					endDate: true,
					vehicle: { select: { make: true, model: true, plateNumber: true } },
				},
			},
			driverOn: {
				select: {
					role: true,
					contract: {
						select: {
							id: true,
							status: true,
							totalAmount: true,
							currency: true,
							startDate: true,
							endDate: true,
							vehicle: {
								select: { make: true, model: true, plateNumber: true },
							},
						},
					},
				},
			},
		},
	});

	if (!contact) return null;
	const includeEmail = options.includeEmail ?? true;
	const includeCalendar = options.includeCalendar ?? true;

	const [threads, meetings] = await Promise.all([
		includeEmail
			? db.emailThread.findMany({
					where: { contactId },
					orderBy: { lastMessageAt: "desc" },
					take: options.threads ?? 5,
					select: {
						subject: true,
						messageCount: true,
						lastMessageAt: true,
						messages: {
							orderBy: { sentAt: "desc" },
							take: options.messagesPerThread ?? 6,
							select: {
								direction: true,
								fromEmail: true,
								fromName: true,
								sentAt: true,
								body: true,
								snippet: true,
							},
						},
					},
				})
			: Promise.resolve([]),
		includeCalendar
			? db.calendarEvent.findMany({
					where: {
						OR: [{ contactId }, { attendees: { some: { contactId } } }],
					},
					orderBy: { startsAt: "desc" },
					take: 10,
					select: {
						title: true,
						startsAt: true,
						attendees: {
							select: {
								email: true,
								name: true,
								contactId: true,
								responseStatus: true,
							},
						},
					},
				})
			: Promise.resolve([]),
	]);

	const inbound = threads
		.flatMap((thread) => thread.messages)
		.filter((message) => message.direction === "INBOUND")
		.sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());

	const now = new Date();
	const upcoming = meetings
		.filter((meeting) => meeting.startsAt > now)
		.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

	return {
		contact: {
			fullName: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
			email: contact.email,
			title: contact.title,
		},
		rentalContracts: [
			...contact.rentalContracts.map((contract) => ({
				id: contract.id,
				vehicle: `${contract.vehicle.make} ${contract.vehicle.model} (${contract.vehicle.plateNumber})`,
				status: contract.status,
				role: "PRIMARY",
				totalAmount:
					contract.totalAmount === null ? null : Number(contract.totalAmount),
				currency: contract.currency,
				startDate: contract.startDate.toISOString(),
				endDate: contract.endDate.toISOString(),
			})),
			...contact.driverOn.map(({ role, contract }) => ({
				id: contract.id,
				vehicle: `${contract.vehicle.make} ${contract.vehicle.model} (${contract.vehicle.plateNumber})`,
				status: contract.status,
				role,
				totalAmount:
					contract.totalAmount === null ? null : Number(contract.totalAmount),
				currency: contract.currency,
				startDate: contract.startDate.toISOString(),
				endDate: contract.endDate.toISOString(),
			})),
		],
		threads: threads.map((thread) => ({
			subject: thread.subject,
			messageCount: thread.messageCount,
			lastMessageAt: thread.lastMessageAt.toISOString(),
			messages: thread.messages.map((message) => ({
				direction: message.direction,
				from: message.fromEmail,
				fromName: message.fromName,
				sentAt: message.sentAt.toISOString(),
				body: message.body ?? message.snippet,
			})),
		})),
		meetings: meetings.map((meeting) => ({
			title: meeting.title,
			startsAt: meeting.startsAt.toISOString(),
			attended: meeting.attendees.some(
				(attendee) =>
					attendee.contactId === contactId &&
					attendee.responseStatus === "accepted",
			),
			attendees: meeting.attendees.map((attendee) => ({
				email: attendee.email,
				name: attendee.name,
			})),
		})),
		stats: {
			emails: threads.reduce((total, thread) => total + thread.messageCount, 0),
			theyReplied: inbound.length > 0,
			lastReplyAt: inbound[0]?.sentAt.toISOString() ?? null,
			meetings: meetings.length,
			nextMeetingAt: upcoming[0]?.startsAt.toISOString() ?? null,
		},
	};
}

export async function stampSocialsChecked(contactId: string): Promise<void> {
	await db.contact.update({
		where: { id: contactId },
		data: { socialsCheckedAt: new Date() },
	});
}

export async function setEnrichmentStatus(
	contactId: string,
	status: EnrichmentStatus,
	error?: string,
): Promise<void> {
	await db.contact.update({
		where: { id: contactId },
		data: {
			enrichmentStatus: status,
			enrichmentError: error ?? null,
			...(status === EnrichmentStatus.COMPLETE
				? { enrichedAt: new Date() }
				: {}),
		},
	});
}

export async function writeTimelineNote(
	contactId: string,
	subject: string,
	body: string,
	meta: Record<string, unknown> = {},
): Promise<string | null> {
	const contact = await db.contact.findUnique({
		where: { id: contactId },
		select: { id: true },
	});
	if (!contact) return null;

	const author =
		(await db.user.findFirst({ select: { id: true } }))?.id ?? null;
	if (!author) return null;

	const activity = await db.activity.create({
		data: {
			type: "NOTE",
			subject,
			body,
			occurredAt: new Date(),
			contactId,
			createdById: author,
			meta: { ...meta, agent: "people-research" },
		},
		select: { id: true },
	});

	return activity.id;
}
