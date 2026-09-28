import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
	ActivityType,
	db,
	EmailDirection,
	RentalContractStatus,
	VehicleType,
} from "@crm/db";
import { readRentalContractHistory } from "../agent/lib/accounts";

const suffix = process.env.TEST_RUN_ID ?? "accounts-spec";
const domain = `fernhill-${suffix}.test`;

let vehicleId: string;
let rentalContractId: string;
let paulaId: string;
let userId: string;

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
const daysAhead = (days: number) => new Date(Date.now() + days * 86_400_000);

beforeAll(async () => {
	await cleanup();

	const user = await db.user.create({
		data: {
			id: `user-${suffix}`,
			name: "Rep One",
			email: `rep.${suffix}@example.test`,
			emailVerified: true,
		},
		select: { id: true },
	});
	userId = user.id;

	const paula = await db.contact.create({
		data: {
			firstName: "Paula",
			lastName: "Marchetti",
			title: "Growth Specialist",
			email: `paula.marchetti@${domain}`,
			lastActivityAt: daysAgo(1),
		},
		select: { id: true },
	});
	paulaId = paula.id;

	const vehicle = await db.vehicle.create({
		data: {
			type: VehicleType.MINIBUS,
			make: "Toyota",
			model: "Hiace",
			plateNumber: `FERNHILL-${suffix}`,
			dailyRate: 40_000,
			currency: "USD",
		},
		select: { id: true },
	});
	vehicleId = vehicle.id;

	const rentalContract = await db.rentalContract.create({
		data: {
			vehicleId,
			contactId: paulaId,
			ownerId: userId,
			status: RentalContractStatus.ACTIVE,
			startDate: daysAgo(14),
			endDate: daysAhead(14),
			pricePerDay: 4_000,
			currency: "USD",
			totalAmount: 48_000,
			depositAmount: 10_000,
			depositCurrency: "USD",
			lastActivityAt: daysAgo(3),
		},
		select: { id: true },
	});
	rentalContractId = rentalContract.id;

	await db.activity.createMany({
		data: [
			{
				type: ActivityType.STAGE_CHANGE,
				subject: "Status changed",
				rentalContractId,
				createdById: userId,
				createdAt: daysAgo(60),
				meta: { from: "DRAFT", to: "RESERVED" },
			},
			{
				type: ActivityType.STAGE_CHANGE,
				subject: "Status changed",
				rentalContractId,
				createdById: userId,
				createdAt: daysAgo(42),
				meta: { from: "RESERVED", to: "ACTIVE" },
			},
			{
				type: ActivityType.NOTE,
				subject: "Pricing pushback",
				body: "They want the security review done before signing.",
				occurredAt: daysAgo(5),
				rentalContractId,
				createdById: userId,
			},
			{
				type: ActivityType.EMAIL,
				subject: "Re: Contract",
				rentalContractId,
				createdById: userId,
			},
		],
	});

	const thread = await db.emailThread.create({
		data: {
			rootMessageId: `<root.${suffix}@example.test>`,
			subject: "Re: Contract",
			contactId: paulaId,
			firstMessageAt: daysAgo(9),
			lastMessageAt: daysAgo(3),
			messageCount: 2,
		},
		select: { id: true },
	});

	await db.emailMessage.createMany({
		data: [
			{
				threadId: thread.id,
				rfcMessageId: `<out.${suffix}@example.test>`,
				direction: EmailDirection.OUTBOUND,
				fromEmail: `rep.${suffix}@example.test`,
				recipients: [],
				subject: "Contract",
				body: "Sending the paperwork over.",
				sentAt: daysAgo(9),
			},
			{
				threadId: thread.id,
				rfcMessageId: `<in.${suffix}@example.test>`,
				direction: EmailDirection.INBOUND,
				fromEmail: `paula.marchetti@${domain}`,
				fromName: "Paula Marchetti",
				recipients: [],
				subject: "Re: Contract",
				body: "Thanks — Paula Marchetti, Growth Specialist, Fernhill.",
				sentAt: daysAgo(3),
			},
		],
	});

	await db.calendarEvent.create({
		data: {
			iCalUid: `event.${suffix}@example.test`,
			originalStartTime: daysAhead(4),
			title: "Security review",
			startsAt: daysAhead(4),
			endsAt: daysAhead(4),
			status: "confirmed",
			contactId: paulaId,
			attendees: {
				create: [
					{ email: `paula.marchetti@${domain}`, name: "Paula Marchetti" },
				],
			},
		},
	});
});

afterAll(cleanup);

async function cleanup(): Promise<void> {
	const contact = await db.contact.findFirst({
		where: { email: `paula.marchetti@${domain}` },
		select: { id: true },
	});

	if (contact) {
		await db.activity.deleteMany({ where: { contactId: contact.id } });
		await db.calendarEvent.deleteMany({ where: { contactId: contact.id } });
		await db.emailThread.deleteMany({ where: { contactId: contact.id } });
		await db.rentalContract.deleteMany({ where: { contactId: contact.id } });
		await db.vehicle.deleteMany({
			where: { plateNumber: `FERNHILL-${suffix}` },
		});
		await db.contact.delete({ where: { id: contact.id } });
	}

	await db.user.deleteMany({ where: { email: `rep.${suffix}@example.test` } });
}

describe("readRentalContractHistory", () => {
	it("reports the status clock, not just the status", async () => {
		const history = await readRentalContractHistory(rentalContractId);

		expect(history?.rentalContract.status).toBe("ACTIVE");
		expect(history?.rentalContract.open).toBe(true);
		expect(history?.rentalContract.daysInStatus).toBeGreaterThanOrEqual(41);
	});

	it("returns every status it moved through, oldest first", async () => {
		const history = await readRentalContractHistory(rentalContractId);

		expect(history?.statusHistory.map((change) => change.to)).toEqual([
			"RESERVED",
			"ACTIVE",
		]);
	});

	it("names who is on it, with ids and roles", async () => {
		const history = await readRentalContractHistory(rentalContractId);

		expect(history?.people).toEqual([
			{
				id: paulaId,
				name: "Paula Marchetti",
				title: "Growth Specialist",
				email: `paula.marchetti@${domain}`,
				role: "PRIMARY",
			},
		]);
		expect(history?.vehicle.id).toBe(vehicleId);
	});

	it("says the correspondence is the renter's, not the contract's", async () => {
		const history = await readRentalContractHistory(rentalContractId);

		expect(history?.threads).toHaveLength(1);
		expect(history?.stats.theyReplied).toBe(true);
		expect(history?.note).toContain("never against a rental contract");
	});

	it("omits contract correspondence when connected sources are not approved", async () => {
		const history = await readRentalContractHistory(rentalContractId, {
			includeEmail: false,
			includeCalendar: false,
		});

		expect(history?.threads).toEqual([]);
		expect(history?.meetings).toEqual([]);
		expect(history?.stats.theyReplied).toBe(false);
		expect(history?.stats.nextMeetingAt).toBeNull();
		expect(history?.note).toContain("outside this agent version");
	});

	it("returns null for a rental contract that does not exist", async () => {
		expect(await readRentalContractHistory("nope")).toBeNull();
	});
});
