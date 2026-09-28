import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db } from "@crm/db";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { FieldsService } from "../src/fields/fields.service";
import { RentalContractsService } from "../src/rental-contracts/rental-contracts.service";

const suffix = process.env.TEST_RUN_ID ?? "rental-contract-drivers-spec";
const userId = `user-${suffix}`;
const plateNumber = `DRV-${suffix}`;

const rentalContracts = new RentalContractsService(
	db,
	new ActivityStampService(db),
	new ConversionService(db),
	new FieldsService(db, { fieldBackfill: async () => undefined } as never),
);

let vehicleId: string;
let contractId: string;
let primaryId: string;
let candidateAId: string;
let candidateBId: string;

async function clean() {
	await db.rentalContractDriver.deleteMany({
		where: { contract: { vehicle: { plateNumber } } },
	});
	await db.rentalContract.deleteMany({ where: { vehicle: { plateNumber } } });
	await db.vehicle.deleteMany({ where: { plateNumber } });
	await db.contact.deleteMany({ where: { email: { contains: suffix } } });
	await db.user.deleteMany({ where: { id: userId } });
}

beforeAll(async () => {
	await clean();

	await db.user.create({
		data: {
			id: userId,
			name: "Rental Agent",
			email: `${userId}@example.test`,
			emailVerified: true,
		},
	});

	const vehicle = await db.vehicle.create({
		data: {
			type: "CAR",
			make: "Toyota",
			model: "Corolla",
			plateNumber,
		},
		select: { id: true },
	});
	vehicleId = vehicle.id;

	const primary = await db.contact.create({
		data: {
			firstName: "Ada",
			lastName: "Primary",
			email: `ada.${suffix}@example.test`,
		},
		select: { id: true },
	});
	primaryId = primary.id;

	const candidateA = await db.contact.create({
		data: {
			firstName: "Beau",
			lastName: "Candidate",
			email: `beau.${suffix}@example.test`,
		},
		select: { id: true },
	});
	candidateAId = candidateA.id;

	const candidateB = await db.contact.create({
		data: {
			firstName: "Cass",
			lastName: "Candidate",
			email: `cass.${suffix}@example.test`,
		},
		select: { id: true },
	});
	candidateBId = candidateB.id;

	const contract = await rentalContracts.create({
		vehicleId,
		contactId: primaryId,
		ownerId: userId,
		startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
		endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
		pricePerDayCents: 4500,
		depositAmountCents: 10000,
	});
	contractId = contract.id;
});

afterAll(clean);

describe("bringing an additional driver onto a rental contract", () => {
	it("creates the primary renter as a PRIMARY driver automatically", async () => {
		const contract = await rentalContracts.byId(contractId);

		expect(contract.drivers).toHaveLength(1);
		expect(contract.drivers[0]?.id).toBe(primaryId);
		expect(contract.drivers[0]?.role).toBe("PRIMARY");
	});

	it("offers everyone not already driving, and nobody already on it", async () => {
		const options = await rentalContracts.driverOptions(contractId);
		const ids = options.map((option) => option.id);

		expect(ids).not.toContain(primaryId);
		expect(ids).toContain(candidateAId);
		expect(ids).toContain(candidateBId);
	});

	it("attaches an additional driver with a role", async () => {
		await rentalContracts.attachDriver({
			contractId,
			contactId: candidateAId,
			role: "ADDITIONAL",
		});

		const contract = await rentalContracts.byId(contractId);
		const driver = contract.drivers.find((d) => d.id === candidateAId);

		expect(driver?.role).toBe("ADDITIONAL");
	});

	it("stops offering somebody already driving", async () => {
		const options = await rentalContracts.driverOptions(contractId);

		expect(options.map((option) => option.id)).not.toContain(candidateAId);
	});

	it("attaching again without a role keeps the role it already has", async () => {
		await rentalContracts.attachDriver({ contractId, contactId: candidateAId });

		const contract = await rentalContracts.byId(contractId);
		const driver = contract.drivers.find((d) => d.id === candidateAId);

		expect(driver?.role).toBe("ADDITIONAL");
	});

	it("will not set a role on somebody who is not driving", async () => {
		await expect(
			rentalContracts.setDriverRole({
				contractId,
				contactId: candidateBId,
				role: "ADDITIONAL",
			}),
		).rejects.toThrow("That person is not a driver on this contract.");
	});

	it("takes them off again, leaving the contact in the CRM", async () => {
		await rentalContracts.detachDriver({ contractId, contactId: candidateAId });

		const contract = await rentalContracts.byId(contractId);

		expect(contract.drivers.map((d) => d.id)).not.toContain(candidateAId);
		expect(await db.contact.count({ where: { id: candidateAId } })).toBe(1);
	});

	it("says so when they were never driving", async () => {
		await expect(
			rentalContracts.detachDriver({ contractId, contactId: candidateAId }),
		).rejects.toThrow("That person is not a driver on this contract.");
	});
});
