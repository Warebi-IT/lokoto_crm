import { db } from "@crm/db";
import { websiteUrl } from "@crm/db/workspace";
import { capabilitiesMarkdown } from "./capabilities";
import { identity, usMarkdown, type WorkspaceIdentity } from "./workspace";

export type Opened = {
	dispatched: boolean;
	kind?: string | null;
	reason?: string | null;
	budget?: number | null;
};

export type Preamble = {
	markdown: string;
	focus: { contactId?: string | null };
};

export async function sessionPreamble(
	record: {
		contactId?: string | null;
		vehicleId?: string | null;
		rentalContractId?: string | null;
	},
	opened: Opened,
): Promise<Preamble> {
	if (opened.kind === "workspace-profile") return workspacePreamble();
	if (record.contactId) return contactPreamble(record.contactId, opened);
	if (record.vehicleId) return vehiclePreamble(record.vehicleId, opened);
	if (record.rentalContractId) {
		return rentalContractPreamble(record.rentalContractId, opened);
	}
	return noRecordPreamble();
}

export async function composeClosing(
	us: WorkspaceIdentity | null,
): Promise<string> {
	return [usMarkdown(us), await capabilitiesMarkdown()]
		.filter(Boolean)
		.join("\n\n");
}

async function closing(): Promise<string> {
	return composeClosing(await identity());
}

function opening(opened: Opened, questions: string): string {
	if (opened.dispatched) {
		return [
			"This session was started by the dispatcher, not by a person. Nobody is",
			"waiting on a reply — do the work, record what you find, and stop.",
		].join(" ");
	}

	return [
		"**A rep has this record open and is talking to you.** Answer what they",
		`actually asked — usually some form of ${questions} — from what the CRM`,
		"already holds, and say plainly when we do not know something. Research it",
		"further only if the answer needs it or they ask you to. Never ask them for",
		"an id, a name or an address you can look up yourself.",
	].join(" ");
}

export async function contactPreamble(
	contactId: string,
	opened: Opened,
): Promise<Preamble> {
	const contact = await db.contact.findUnique({
		where: { id: contactId },
		select: {
			firstName: true,
			lastName: true,
			email: true,
			title: true,
			brief: { select: { refreshedAt: true } },
			rentalContracts: {
				orderBy: { lastActivityAt: "desc" },
				take: 5,
				select: {
					id: true,
					status: true,
					vehicle: { select: { make: true, model: true, plateNumber: true } },
				},
			},
			driverOn: {
				orderBy: { contract: { lastActivityAt: "desc" } },
				take: 5,
				select: {
					role: true,
					contract: {
						select: {
							id: true,
							status: true,
							vehicle: {
								select: { make: true, model: true, plateNumber: true },
							},
						},
					},
				},
			},
			_count: { select: { emailThreads: true, calendarEvents: true } },
		},
	});

	if (!contact) {
		return { markdown: await closing(), focus: { contactId } };
	}

	const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ");

	const known =
		contact._count.emailThreads > 0 || contact._count.calendarEvents > 0
			? `We have ${contact._count.emailThreads} thread(s) and ${contact._count.calendarEvents} meeting(s) with them — read those first.`
			: "We have never corresponded with them, so there is nothing internal to go on.";

	const rentalContracts = [
		...contact.rentalContracts.map(
			(contract) =>
				`${contract.vehicle.make} ${contract.vehicle.model} (${contract.status}, renter) \`${contract.id}\``,
		),
		...contact.driverOn.map(
			({ role, contract }) =>
				`${contract.vehicle.make} ${contract.vehicle.model} (${contract.status}, ${role.toLowerCase()}) \`${contract.id}\``,
		),
	].join("; ");

	const markdown = [
		"## This session",
		"",
		`You are working on **${name}** (\`${contactId}\`)${
			contact.email ? `, ${contact.email}` : ""
		}${contact.title ? `, ${contact.title}` : ""}.`,
		opened.kind ? `Task: **${opened.kind}**.` : "",
		opened.reason ? `Why now: ${opened.reason}` : "",
		opened.budget
			? `Budget: **${opened.budget}** vendor calls. Spend them where they matter.`
			: "",
		"",
		opening(
			opened,
			"who this person is, whether they are still there, or what to know before a call",
		),
		"",
		rentalContracts
			? `They are on: ${rentalContracts}.`
			: "They are not on any rental contract.",
		"",
		known,
		contact.brief
			? `A background already exists, written ${contact.brief.refreshedAt.toDateString()}. Replace it only if you learn something it does not say.`
			: "There is no background on them yet.",
		"",
		"Start with `read_crm_history` on this contact id.",
		"",
		await closing(),
	]
		.filter(Boolean)
		.join("\n");

	return {
		markdown,
		focus: { contactId },
	};
}

export async function vehiclePreamble(
	vehicleId: string,
	opened: Opened,
): Promise<Preamble> {
	const vehicle = await db.vehicle.findUnique({
		where: { id: vehicleId },
		select: {
			make: true,
			model: true,
			plateNumber: true,
			status: true,
			dailyRate: true,
			currency: true,
			mileage: true,
			nextMaintenanceAtKm: true,
			nextMaintenanceAtDate: true,
			insuranceExpiresAt: true,
			lastActivityAt: true,
			rentalContracts: {
				orderBy: { lastActivityAt: "desc" },
				take: 3,
				select: {
					id: true,
					status: true,
					contact: { select: { firstName: true, lastName: true } },
				},
			},
		},
	});

	if (!vehicle) return { markdown: await closing(), focus: {} };

	const recent = vehicle.rentalContracts
		.map(
			(contract) =>
				`${[contract.contact.firstName, contract.contact.lastName].filter(Boolean).join(" ")} (${contract.status}) \`${contract.id}\``,
		)
		.join("; ");

	const markdown = [
		"## This session",
		"",
		`You are working on the vehicle **${vehicle.make} ${vehicle.model}** (\`${vehicle.plateNumber}\`) — vehicle id \`${vehicleId}\`.`,
		`Status: **${vehicle.status}**${
			vehicle.dailyRate
				? `. Daily rate: ${vehicle.dailyRate} ${vehicle.currency}`
				: ""
		}. Mileage: ${vehicle.mileage} km.`,
		vehicle.nextMaintenanceAtDate
			? `Next maintenance due ${vehicle.nextMaintenanceAtDate.toDateString()}.`
			: vehicle.nextMaintenanceAtKm
				? `Next maintenance due at ${vehicle.nextMaintenanceAtKm} km.`
				: "No maintenance threshold set.",
		vehicle.insuranceExpiresAt
			? `Insurance expires ${vehicle.insuranceExpiresAt.toDateString()}.`
			: "No insurance expiry on file.",
		vehicle.lastActivityAt
			? `Last touched ${vehicle.lastActivityAt.toDateString()}.`
			: "Nothing has happened on it yet.",
		recent ? `Recent contracts: ${recent}.` : "It has no rental history yet.",
		"",
		opening(
			opened,
			"when this is due for service, how much it has earned, or whether anything is open against it",
		),
		"",
		"A vehicle itself has no research tools — the history worth reading lives on its rental contracts and the people who rented it. Use `search_crm` to find the contract you need, then `read_rental_contract_history` on it.",
		"",
		await closing(),
	]
		.filter(Boolean)
		.join("\n");

	return { markdown, focus: {} };
}

export async function rentalContractPreamble(
	rentalContractId: string,
	opened: Opened,
): Promise<Preamble> {
	const contract = await db.rentalContract.findUnique({
		where: { id: rentalContractId },
		select: {
			status: true,
			totalAmount: true,
			currency: true,
			startDate: true,
			endDate: true,
			lastActivityAt: true,
			vehicle: {
				select: { id: true, make: true, model: true, plateNumber: true },
			},
			contact: {
				select: {
					id: true,
					firstName: true,
					lastName: true,
					title: true,
				},
			},
			drivers: {
				where: { role: "ADDITIONAL" },
				select: {
					contact: {
						select: { id: true, firstName: true, lastName: true, title: true },
					},
				},
			},
		},
	});

	if (!contract) return { markdown: await closing(), focus: {} };

	const people = [
		{ role: "renter", contact: contract.contact },
		...contract.drivers.map(({ contact }) => ({
			role: "additional driver",
			contact,
		})),
	]
		.map(({ role, contact }) => {
			const name = [contact.firstName, contact.lastName]
				.filter(Boolean)
				.join(" ");
			return `${name}${contact.title ? ` (${contact.title})` : ""} — ${role} \`${contact.id}\``;
		})
		.join("; ");

	const markdown = [
		"## This session",
		"",
		`You are working on the rental contract for **${contract.vehicle.make} ${contract.vehicle.model}** (\`${contract.vehicle.plateNumber}\`) — rental contract id \`${rentalContractId}\`, vehicle id \`${contract.vehicle.id}\`.`,
		`Status: **${contract.status}**${
			contract.totalAmount
				? `. Total: ${contract.totalAmount} ${contract.currency ?? ""}`.trim()
				: ""
		}. ${contract.startDate.toDateString()} – ${contract.endDate.toDateString()}.`,
		contract.lastActivityAt
			? `Last touched ${contract.lastActivityAt.toDateString()}.`
			: "Nothing has happened on it yet.",
		people ? `People on it: ${people}` : "Nobody is attached to it yet.",
		"",
		opening(
			opened,
			"where this stands, whether the deposit is settled, or whether it is overdue",
		),
		"",
		"Start with `read_rental_contract_history` on this rental contract id. It returns the status history, the last reply from the renter's side and the next meeting — which is how you answer *where does this stand* rather than reciting the status field back.",
		"",
		"You can research the renter with the usual tools — a rental contract itself has no fields to enrich, so anything you learn is recorded against them.",
		"",
		await closing(),
	].join("\n");

	return {
		markdown,
		focus: { contactId: contract.contact.id },
	};
}

export async function noRecordPreamble(): Promise<Preamble> {
	return {
		markdown: [
			"## This session",
			"",
			"No record was named, so nothing is in focus yet.",
			"`list_outstanding_work` shows contacts with research outstanding, and",
			"`search_crm` finds any contact or rental contract by name, plate number",
			"or email address. Look the record up rather than asking for an id.",
			"",
			await closing(),
		].join("\n"),
		focus: {},
	};
}

export async function workspacePreamble(
	known?: WorkspaceIdentity | null,
): Promise<Preamble> {
	const us = known === undefined ? await identity() : known;
	const site = websiteUrl(us?.website);

	if (!us || !site) {
		return {
			markdown: [
				"## This session",
				"",
				"You were asked to write the profile of the company you work for, and",
				"this install has no web address on record — nobody gave one, or what is",
				"stored is not one. There is nothing to read. Stop — do not guess at it",
				"from the email addresses in the CRM.",
			].join("\n"),
			focus: {},
		};
	}

	const markdown = [
		"## This session",
		"",
		`You are writing the profile of **the company you work for** — ${us.name} (${us.website}).`,
		us.profile
			? `One already exists, written ${us.profile.refreshedAt.toDateString()}. Replace it only if the site now says something different.`
			: "There is no profile of us yet.",
		"",
		`Read ${site} with \`web_fetch\` — the home page, and the pricing or product`,
		"page if there is one — and search the web only if the site does not say who",
		"the customer is. Then call `write_workspace_profile`.",
		"",
		"**Every other session opens with what you write here**, in front of the",
		"record a rep is asking about, so it has to be short and it has to be",
		"substance. The tool enforces that: 320 characters of narrative and one",
		"short line each for what we sell, who we sell to, and what we are picked",
		"over. Leave a line out rather than padding it. No marketing adjectives —",
		'"leading", "innovative" and "best-in-class" say nothing a rep can use.',
		"",
		"You are describing us to a colleague who has just joined, not writing our",
		"home page back to us.",
		"",
		await capabilitiesMarkdown(),
	].join("\n");

	return { markdown, focus: {} };
}
