import { ActivityType, db, EmailDirection } from "@crm/db";

const BODY_LIMIT = 4000;

export type AccountThread = {
	subject: string | null;
	contact: { id: string; name: string } | null;
	messageCount: number;
	lastMessageAt: string;
	messages: {
		direction: string;
		from: string;
		fromName: string | null;
		sentAt: string;
		body: string | null;
	}[];
};

export type AccountMeeting = {
	title: string | null;
	startsAt: string;
	upcoming: boolean;
	attendees: { email: string; name: string | null }[];
};

export type AccountNote = {
	type: string;
	subject: string | null;
	body: string | null;
	occurredAt: string;
};

export type RentalContractHistory = {
	rentalContract: {
		id: string;
		status: string;
		open: boolean;
		daysInStatus: number;
		channel: string;
		startDate: string;
		endDate: string;
		totalAmount: number | null;
		currency: string;
		depositAmount: number | null;
		depositStatus: string;
		cancelledAt: string | null;
		cancelledReason: string | null;
		owner: string | null;
		createdAt: string;
	};
	vehicle: {
		id: string;
		make: string;
		model: string;
		plateNumber: string;
		status: string;
	};
	people: {
		id: string;
		name: string;
		title: string | null;
		email: string | null;
		role: string;
	}[];
	statusHistory: { from: string | null; to: string | null; at: string }[];
	threads: AccountThread[];
	meetings: AccountMeeting[];
	notes: AccountNote[];
	stats: {
		theyReplied: boolean;
		lastReplyAt: string | null;
		lastReplyFrom: string | null;
		nextMeetingAt: string | null;
		daysSinceLastActivity: number | null;
	};
	note: string;
};

export async function readRentalContractHistory(
	rentalContractId: string,
	options: {
		threads?: number;
		messagesPerThread?: number;
		includeEmail?: boolean;
		includeCalendar?: boolean;
	} = {},
): Promise<RentalContractHistory | null> {
	const contract = await db.rentalContract.findUnique({
		where: { id: rentalContractId },
		select: {
			id: true,
			status: true,
			channel: true,
			startDate: true,
			endDate: true,
			totalAmount: true,
			currency: true,
			depositAmount: true,
			depositStatus: true,
			cancelledAt: true,
			cancelledReason: true,
			lastActivityAt: true,
			createdAt: true,
			owner: { select: { name: true, email: true } },
			vehicle: {
				select: {
					id: true,
					make: true,
					model: true,
					plateNumber: true,
					status: true,
				},
			},
			contact: {
				select: {
					id: true,
					firstName: true,
					lastName: true,
					title: true,
					email: true,
				},
			},
			drivers: {
				select: {
					role: true,
					contact: {
						select: {
							id: true,
							firstName: true,
							lastName: true,
							title: true,
							email: true,
						},
					},
				},
			},
		},
	});

	if (!contract) return null;
	const includeEmail = options.includeEmail ?? true;
	const includeCalendar = options.includeCalendar ?? true;

	const contactIds = [
		contract.contact.id,
		...contract.drivers.map(({ contact }) => contact.id),
	].filter((id, index, all) => all.indexOf(id) === index);

	const relatedThreads = { contactId: { in: contactIds } };

	const [statusChanges, threads, meetings, notes, lastInbound] =
		await Promise.all([
			db.activity.findMany({
				where: { rentalContractId, type: ActivityType.STAGE_CHANGE },
				orderBy: { createdAt: "asc" },
				take: 25,
				select: { meta: true, createdAt: true },
			}),
			includeEmail
				? db.emailThread.findMany({
						where: relatedThreads,
						orderBy: { lastMessageAt: "desc" },
						take: options.threads ?? 5,
						select: {
							subject: true,
							messageCount: true,
							lastMessageAt: true,
							contact: {
								select: { id: true, firstName: true, lastName: true },
							},
							messages: {
								orderBy: { sentAt: "desc" },
								take: options.messagesPerThread ?? 4,
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
							OR: [
								{ contactId: { in: contactIds } },
								{ attendees: { some: { contactId: { in: contactIds } } } },
							],
						},
						orderBy: { startsAt: "desc" },
						take: 10,
						select: {
							title: true,
							startsAt: true,
							attendees: { select: { email: true, name: true } },
						},
					})
				: Promise.resolve([]),
			recentNotes({ rentalContractId }),
			includeEmail
				? db.emailMessage.findFirst({
						where: {
							direction: EmailDirection.INBOUND,
							thread: relatedThreads,
						},
						orderBy: { sentAt: "desc" },
						select: { sentAt: true, fromEmail: true, fromName: true },
					})
				: Promise.resolve(null),
		]);

	const now = new Date();
	const statusChangedAt = statusChanges.at(-1)?.createdAt ?? contract.createdAt;

	return {
		rentalContract: {
			id: contract.id,
			status: contract.status,
			open: isOpenStatus(contract.status),
			daysInStatus: daysSince(statusChangedAt, now),
			channel: contract.channel,
			startDate: contract.startDate.toISOString(),
			endDate: contract.endDate.toISOString(),
			totalAmount:
				contract.totalAmount === null ? null : Number(contract.totalAmount),
			currency: contract.currency,
			depositAmount: Number(contract.depositAmount),
			depositStatus: contract.depositStatus,
			cancelledAt: contract.cancelledAt?.toISOString() ?? null,
			cancelledReason: contract.cancelledReason,
			owner: contract.owner?.name ?? contract.owner?.email ?? null,
			createdAt: contract.createdAt.toISOString(),
		},
		vehicle: contract.vehicle,
		people: [
			{
				id: contract.contact.id,
				name: fullName(contract.contact),
				title: contract.contact.title,
				email: contract.contact.email,
				role: "PRIMARY",
			},
			...contract.drivers.map(({ role, contact }) => ({
				id: contact.id,
				name: fullName(contact),
				title: contact.title,
				email: contact.email,
				role,
			})),
		],
		statusHistory: statusChanges.map((change) => {
			const meta = (change.meta ?? {}) as { from?: unknown; to?: unknown };
			return {
				from: typeof meta.from === "string" ? meta.from : null,
				to: typeof meta.to === "string" ? meta.to : null,
				at: change.createdAt.toISOString(),
			};
		}),
		threads: threads.map(toAccountThread),
		meetings: meetings.map((meeting) => toAccountMeeting(meeting, now)),
		notes,
		stats: {
			theyReplied: lastInbound !== null,
			lastReplyAt: lastInbound?.sentAt.toISOString() ?? null,
			lastReplyFrom: lastInbound
				? (lastInbound.fromName ?? lastInbound.fromEmail)
				: null,
			nextMeetingAt:
				meetings
					.filter((meeting) => meeting.startsAt > now)
					.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0]
					?.startsAt.toISOString() ?? null,
			daysSinceLastActivity: contract.lastActivityAt
				? daysSince(contract.lastActivityAt, now)
				: null,
		},
		note:
			includeEmail || includeCalendar
				? "Connected account history is filed against people, never against a rental contract. The history here belongs to the renter and any additional drivers on it — read the details before treating any of it as being about this contract."
				: "Connected email and calendar history are outside this agent version's approved data sources.",
	};
}

function isOpenStatus(status: string): boolean {
	return status === "DRAFT" || status === "RESERVED" || status === "ACTIVE";
}

async function recentNotes(where: {
	rentalContractId: string;
}): Promise<AccountNote[]> {
	const rows = await db.activity.findMany({
		where: {
			...where,
			type: {
				in: [
					ActivityType.NOTE,
					ActivityType.CALL,
					ActivityType.TASK,
					ActivityType.ENRICHMENT,
				],
			},
		},
		orderBy: { createdAt: "desc" },
		take: 10,
		select: {
			type: true,
			subject: true,
			body: true,
			occurredAt: true,
			createdAt: true,
		},
	});

	return rows.map((row) => ({
		type: row.type,
		subject: row.subject,
		body: row.body ? row.body.slice(0, BODY_LIMIT) : null,
		occurredAt: (row.occurredAt ?? row.createdAt).toISOString(),
	}));
}

function toAccountThread(thread: {
	subject: string | null;
	messageCount: number;
	lastMessageAt: Date;
	contact: { id: string; firstName: string; lastName: string | null } | null;
	messages: {
		direction: string;
		fromEmail: string;
		fromName: string | null;
		sentAt: Date;
		body: string | null;
		snippet: string | null;
	}[];
}): AccountThread {
	return {
		subject: thread.subject,
		contact: thread.contact
			? { id: thread.contact.id, name: fullName(thread.contact) }
			: null,
		messageCount: thread.messageCount,
		lastMessageAt: thread.lastMessageAt.toISOString(),
		messages: thread.messages.map((message) => ({
			direction: message.direction,
			from: message.fromEmail,
			fromName: message.fromName,
			sentAt: message.sentAt.toISOString(),
			body: (message.body ?? message.snippet)?.slice(0, BODY_LIMIT) ?? null,
		})),
	};
}

function toAccountMeeting(
	meeting: {
		title: string | null;
		startsAt: Date;
		attendees: { email: string; name: string | null }[];
	},
	now: Date,
): AccountMeeting {
	return {
		title: meeting.title,
		startsAt: meeting.startsAt.toISOString(),
		upcoming: meeting.startsAt > now,
		attendees: meeting.attendees,
	};
}

function fullName(person: {
	firstName: string;
	lastName: string | null;
}): string {
	return [person.firstName, person.lastName].filter(Boolean).join(" ");
}

function daysSince(date: Date, now: Date): number {
	return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000));
}
