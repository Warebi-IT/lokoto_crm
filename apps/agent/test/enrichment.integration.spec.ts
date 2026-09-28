import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { db, EnrichmentStatus } from "@crm/db";
import { markRunning, settle } from "../agent/lib/enrichment";

async function clear() {
	await db.contact.deleteMany({
		where: { email: { startsWith: "lifecycle-" } },
	});
}

beforeEach(clear);
afterEach(clear);

async function contact() {
	return db.contact.create({
		data: {
			firstName: "Lifecycle",
			email: `lifecycle-${crypto.randomUUID()}@example.test`,
		},
		select: { id: true },
	});
}

function subjectOf(ids: { contactId?: string }) {
	return {
		id: "task",
		kind: "test",
		contactId: ids.contactId ?? null,
	};
}

async function statusOfContact(id: string) {
	const row = await db.contact.findUnique({
		where: { id },
		select: { enrichmentStatus: true, enrichedAt: true },
	});
	return row;
}

describe("the record follows the task", () => {
	it("takes a contact off PENDING, which nothing used to do", async () => {
		const person = await contact();
		const subject = subjectOf({ contactId: person.id });

		expect((await statusOfContact(person.id))?.enrichmentStatus).toBe(
			"PENDING",
		);

		await markRunning(subject);
		expect((await statusOfContact(person.id))?.enrichmentStatus).toBe(
			"RUNNING",
		);

		await settle(subject, EnrichmentStatus.COMPLETE);
		const done = await statusOfContact(person.id);
		expect(done?.enrichmentStatus).toBe("COMPLETE");
		expect(done?.enrichedAt).not.toBeNull();
	});

	it("lets a tool's more specific answer win over the queue's", async () => {
		const person = await contact();
		const subject = subjectOf({ contactId: person.id });

		await markRunning(subject);

		await db.contact.update({
			where: { id: person.id },
			data: {
				enrichmentStatus: EnrichmentStatus.SKIPPED,
				enrichmentError: "No email to look up.",
			},
		});

		await settle(subject, EnrichmentStatus.COMPLETE);

		const row = await statusOfContact(person.id);
		expect(row?.enrichmentStatus).toBe("SKIPPED");
	});

	it("puts a failed record back to work on a retry", async () => {
		const person = await contact();
		const subject = subjectOf({ contactId: person.id });

		await markRunning(subject);
		await settle(subject, EnrichmentStatus.FAILED, "the vendor refused");
		expect((await statusOfContact(person.id))?.enrichmentStatus).toBe("FAILED");

		await markRunning(subject);
		const retried = await statusOfContact(person.id);
		expect(retried?.enrichmentStatus).toBe("RUNNING");

		const row = await db.contact.findUnique({
			where: { id: person.id },
			select: { enrichmentError: true },
		});
		expect(row?.enrichmentError).toBeNull();
	});

	it("survives a record deleted while the agent was still reading about it", async () => {
		const person = await contact();
		const subject = subjectOf({ contactId: person.id });

		await markRunning(subject);
		await db.contact.delete({ where: { id: person.id } });

		await settle(subject, EnrichmentStatus.COMPLETE);
	});
});
