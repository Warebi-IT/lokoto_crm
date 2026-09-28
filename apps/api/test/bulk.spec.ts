import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { AgentQueueService } from "../src/agent/agent-queue.service";
import type { AgentTriggerService } from "../src/agent/agent-trigger.service";
import { ContactsService } from "../src/contacts/contacts.service";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { FieldsService } from "../src/fields/fields.service";
import { RentalContractsService } from "../src/rental-contracts/rental-contracts.service";
import { VehiclesService } from "../src/vehicles/vehicles.service";

const suffix = process.env.TEST_RUN_ID ?? "bulk-spec";
const domain = `bulk-${suffix}.test`;
const ownerId = `owner-${suffix}`;
const secondOwnerId = `second-owner-${suffix}`;
const ours = { OR: [{ email: { endsWith: `@${domain}` } }] };
const platePrefix = `BULK-${suffix}`;

const agent = {
	contactCreated: async () => undefined,
} as unknown as AgentTriggerService;

const stamp = new ActivityStampService(db);
const queue = new AgentQueueService(db);
const conversion = new ConversionService(db);

const fields = new FieldsService(db, agent);
const contacts = new ContactsService(db, agent, queue, stamp, fields);
const vehicles = new VehiclesService(db, stamp, conversion, fields);
const rentalContracts = new RentalContractsService(
	db,
	stamp,
	conversion,
	fields,
);

async function clean() {
	await db.rentalContractDriver.deleteMany({
		where: {
			contract: { vehicle: { plateNumber: { startsWith: platePrefix } } },
		},
	});
	await db.rentalContract.deleteMany({
		where: { vehicle: { plateNumber: { startsWith: platePrefix } } },
	});
	await db.vehicle.deleteMany({
		where: { plateNumber: { startsWith: platePrefix } },
	});
	await db.contact.deleteMany({ where: ours });
	await db.suppressedContact.deleteMany({ where: ours });
	await db.user.deleteMany({ where: { id: { in: [ownerId, secondOwnerId] } } });
}

beforeAll(async () => {
	await clean();

	await db.user.createMany({
		data: [
			{ id: ownerId, name: "First Rep", email: `first@${domain}` },
			{ id: secondOwnerId, name: "Second Rep", email: `second@${domain}` },
		],
	});
});

afterAll(clean);

async function makeVehicle(plateSuffix: string): Promise<string> {
	const vehicle = await vehicles.create({
		type: "CAR",
		make: "Bulk",
		model: "Test",
		plateNumber: `${platePrefix}-${plateSuffix}`,
	});
	return vehicle.id;
}

async function makeContract(
	vehicleId: string,
	renterId: string,
): Promise<string> {
	const contract = await rentalContracts.create({
		vehicleId,
		contactId: renterId,
		ownerId,
		startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
		pricePerDayCents: 4500,
		depositAmountCents: 10000,
	});
	return contract.id;
}

describe("setting the status of a selection of vehicles", () => {
	it("moves every vehicle it was given", async () => {
		const first = await makeVehicle("status-1");
		const second = await makeVehicle("status-2");

		expect(
			await vehicles.bulkSetStatus({
				ids: [first, second],
				status: "MAINTENANCE",
			}),
		).toEqual({ requested: 2, succeeded: 2, failed: 0, message: null });

		expect(
			await db.vehicle.count({
				where: { id: { in: [first, second] }, status: "MAINTENANCE" },
			}),
		).toBe(2);
	});
});

describe("deleting a selection", () => {
	it("suppresses every address, exactly as deleting them one by one would", async () => {
		const first = await contacts.create({
			firstName: "Gone",
			email: `gone@${domain}`,
		});
		const second = await contacts.create({
			firstName: "Also Gone",
			email: `also-gone@${domain}`,
		});

		expect(await contacts.bulkDelete([first.id, second.id])).toEqual({
			requested: 2,
			succeeded: 2,
			failed: 0,
			message: null,
		});

		expect(
			await db.suppressedContact.count({
				where: { email: { in: [`gone@${domain}`, `also-gone@${domain}`] } },
			}),
		).toBe(2);
	});

	it("finishes the rest and says what it could not do", async () => {
		const survivor = await contacts.create({
			firstName: "Doomed",
			email: `doomed@${domain}`,
		});

		const result = await contacts.bulkDelete([
			survivor.id,
			`missing-${suffix}`,
		]);

		expect(result.succeeded).toBe(1);
		expect(result.failed).toBe(1);
		expect(result.message).toMatch(/No contact with id/);
		expect(
			await db.contact.findUnique({ where: { id: survivor.id } }),
		).toBeNull();
	});

	it("removes a selection of rental contracts", async () => {
		const renter = await contacts.create({
			firstName: "Renter",
			email: `renter@${domain}`,
		});
		const vehicleId = await makeVehicle("delete-1");
		const contractId = await makeContract(vehicleId, renter.id);

		expect(await rentalContracts.bulkDelete([contractId])).toEqual({
			requested: 1,
			succeeded: 1,
			failed: 0,
			message: null,
		});

		expect(
			await db.rentalContract.findUnique({ where: { id: contractId } }),
		).toBeNull();
	});
});

describe("changing a rental contract's status", () => {
	it("will not cancel one without a reason", async () => {
		const renter = await contacts.create({
			firstName: "Unreasoned",
			email: `unreasoned@${domain}`,
		});
		const vehicleId = await makeVehicle("reason-1");
		const contractId = await makeContract(vehicleId, renter.id);

		await expect(
			rentalContracts.setStatus(
				{ id: contractId, status: "CANCELLED" },
				ownerId,
			),
		).rejects.toThrow(/cancelled/);

		expect(
			await db.rentalContract.findUnique({
				where: { id: contractId },
				select: { status: true },
			}),
		).toEqual({ status: "DRAFT" });
	});

	it("writes the one reason onto every contract's timeline", async () => {
		const renterA = await contacts.create({
			firstName: "Cancelled",
			lastName: "One",
			email: `cancelled-one@${domain}`,
		});
		const renterB = await contacts.create({
			firstName: "Cancelled",
			lastName: "Two",
			email: `cancelled-two@${domain}`,
		});
		const vehicleA = await makeVehicle("reason-2");
		const vehicleB = await makeVehicle("reason-3");
		const first = await makeContract(vehicleA, renterA.id);
		const second = await makeContract(vehicleB, renterB.id);

		for (const id of [first, second]) {
			const result = await rentalContracts.setStatus(
				{ id, status: "CANCELLED", cancelledReason: "Budget pulled" },
				ownerId,
			);
			expect(result.changed).toBe(true);
		}

		const cancelled = await db.rentalContract.findMany({
			where: { id: { in: [first, second] } },
			select: { status: true, cancelledReason: true, cancelledAt: true },
		});

		expect(cancelled.every((row) => row.status === "CANCELLED")).toBe(true);
		expect(
			cancelled.every((row) => row.cancelledReason === "Budget pulled"),
		).toBe(true);
		expect(cancelled.every((row) => row.cancelledAt !== null)).toBe(true);

		expect(
			await db.activity.count({
				where: {
					rentalContractId: { in: [first, second] },
					type: "STAGE_CHANGE",
					body: "Budget pulled",
				},
			}),
		).toBe(2);
	});
});
