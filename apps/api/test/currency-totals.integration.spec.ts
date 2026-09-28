import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { db, RateSource } from "@crm/db";
import { normalizeCurrency } from "@crm/db/currency";
import { SETTINGS_ID, writeReportingCurrency } from "@crm/db/settings";
import { ActivityStampService } from "../src/crm/activity-stamp.service";
import { ConversionService } from "../src/currency/conversion.service";
import { DashboardService } from "../src/dashboard/dashboard.service";
import { FieldsService } from "../src/fields/fields.service";
import { RentalContractsService } from "../src/rental-contracts/rental-contracts.service";

const suffix = process.env.TEST_RUN_ID ?? "currency-totals-spec";
const userId = `user-${suffix}`;
const domain = `money-${suffix}.test`;
const platePrefix = `MONEY-${suffix}`;

const conversion = new ConversionService(db);
const rentalContracts = new RentalContractsService(
	db,
	new ActivityStampService(db),
	conversion,
	new FieldsService(db, { fieldBackfill: async () => undefined } as never),
);
const dashboard = new DashboardService(db, conversion);

let renterId: string;
let vehicleCounter = 0;
let previousReportingCurrency: string | null = null;

const MILLION = 100_000_000;
const HALF_MILLION = 50_000_000;

async function rate(quote: string, value: string, source: RateSource) {
	await db.exchangeRate.upsert({
		where: {
			baseCurrency_quoteCurrency_source: {
				baseCurrency: "USD",
				quoteCurrency: quote,
				source,
			},
		},
		create: {
			baseCurrency: "USD",
			quoteCurrency: quote,
			rate: value,
			asOf: new Date("2026-08-01T00:00:00.000Z"),
			source,
		},
		update: { rate: value },
	});
}

async function clearRates() {
	await db.exchangeRate.deleteMany({
		where: {
			baseCurrency: { in: ["USD", "EUR"] },
			quoteCurrency: { in: ["USD", "EUR", "CHF"] },
		},
	});
}

async function pipelineCents(ownerId = userId): Promise<number> {
	const summary = await dashboard.summary(ownerId, { scope: "me" });
	return summary.fleet.totalCents;
}

function tomorrowRange(): { startDate: string; endDate: string } {
	const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
	const end = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
	return { startDate: start.toISOString(), endDate: end.toISOString() };
}

async function makeVehicle(): Promise<string> {
	vehicleCounter += 1;
	const vehicle = await db.vehicle.create({
		data: {
			type: "CAR",
			make: "Money",
			model: "Test",
			plateNumber: `${platePrefix}-${vehicleCounter}`,
		},
		select: { id: true },
	});
	return vehicle.id;
}

async function makeContract(input: {
	ownerId: string;
	amountCents: number;
	currency: string;
}): Promise<string> {
	const vehicleId = await makeVehicle();
	const { startDate, endDate } = tomorrowRange();

	const contract = await rentalContracts.create({
		vehicleId,
		contactId: renterId,
		ownerId: input.ownerId,
		startDate,
		endDate,
		pricePerDayCents: input.amountCents,
		currency: input.currency,
		depositAmountCents: 10_000,
	});

	return contract.id;
}

beforeAll(async () => {
	const existing = await db.appSetting.findUnique({
		where: { id: SETTINGS_ID },
		select: { reportingCurrency: true },
	});
	previousReportingCurrency = existing?.reportingCurrency ?? null;

	await writeReportingCurrency(db, "USD");
	await clearRates();

	await db.user.upsert({
		where: { id: userId },
		create: {
			id: userId,
			name: "Rate Tester",
			email: `rates@${domain}`,
			emailVerified: true,
		},
		update: {},
	});

	const renter = await db.contact.upsert({
		where: { email: `renter@${domain}` },
		create: {
			firstName: "Money",
			lastName: "Renter",
			email: `renter@${domain}`,
		},
		update: {},
		select: { id: true },
	});
	renterId = renter.id;

	await rate("EUR", "1.10", RateSource.FETCHED);
});

afterAll(async () => {
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
	await db.contact.deleteMany({ where: { email: { endsWith: `@${domain}` } } });
	await db.user.deleteMany({ where: { id: userId } });
	await clearRates();

	if (previousReportingCurrency) {
		await writeReportingCurrency(db, previousReportingCurrency);
	} else {
		await db.appSetting.updateMany({ data: { reportingCurrency: null } });
	}

	await conversion.rerateAll("rentalContract");
});

describe("a total across currencies", () => {
	it("converts on write and never adds two currencies together", async () => {
		await makeContract({
			ownerId: userId,
			amountCents: MILLION,
			currency: "USD",
		});

		await makeContract({
			ownerId: userId,
			amountCents: MILLION,
			currency: "EUR",
		});

		expect(await pipelineCents()).toBe(MILLION + 1.1 * MILLION);
	});

	it("locks the rate onto the rental contract, so the row says how it was converted", async () => {
		const row = await db.rentalContract.findFirst({
			where: { ownerId: userId, currency: "EUR" },
			select: {
				totalAmount: true,
				baseAmount: true,
				fxRate: true,
				fxRateAt: true,
			},
		});

		expect(row?.totalAmount?.toNumber()).toBe(1_000_000);
		expect(row?.baseAmount?.toNumber()).toBe(1_100_000);
		expect(row?.fxRate?.toNumber()).toBe(1.1);
		expect(row?.fxRateAt).toBeInstanceOf(Date);
	});

	it("leaves a rental contract it cannot convert out of the total, and says so", async () => {
		const before = await pipelineCents();

		await makeContract({
			ownerId: userId,
			amountCents: HALF_MILLION,
			currency: "CHF",
		});

		expect(await pipelineCents()).toBe(before);

		const summary = await dashboard.summary(userId, { scope: "me" });
		expect(summary.reportingCurrency).toBe("USD");
		expect(summary.unconverted.count).toBe(1);
		expect(summary.unconverted.currencies).toEqual(["CHF"]);
	});

	it("picks the waiting contract up when a rate finally arrives", async () => {
		await rate("CHF", "1.25", RateSource.MANUAL);

		const filled = await conversion.fillMissing("rentalContract");
		expect(filled.converted).toBeGreaterThan(0);

		expect(await pipelineCents()).toBe(
			MILLION + 1.1 * MILLION + 1.25 * HALF_MILLION,
		);

		const summary = await dashboard.summary(userId, { scope: "me" });
		expect(summary.unconverted.count).toBe(0);
	});

	it("does not re-rate a contract that already has a rate", async () => {
		await rate("EUR", "9.99", RateSource.FETCHED);

		await conversion.fillMissing("rentalContract");

		const row = await db.rentalContract.findFirst({
			where: { ownerId: userId, currency: "EUR" },
			select: { baseAmount: true },
		});

		expect(row?.baseAmount?.toNumber()).toBe(1_100_000);
	});

	it("lets a rate entered by hand beat the fetched one on a re-rate", async () => {
		await rate("EUR", "1.50", RateSource.MANUAL);

		await conversion.rerateAll("rentalContract");

		const row = await db.rentalContract.findFirst({
			where: { ownerId: userId, currency: "EUR" },
			select: { baseAmount: true, fxRate: true },
		});

		expect(row?.fxRate?.toNumber()).toBe(1.5);
		expect(row?.baseAmount?.toNumber()).toBe(1_500_000);
	});

	it("re-rates everything when the reporting currency changes", async () => {
		await writeReportingCurrency(db, "EUR");

		const rerated = await conversion.rerateAll("rentalContract");
		expect(rerated.missing).toContain("USD");

		const summary = await dashboard.summary(userId, { scope: "me" });

		expect(summary.reportingCurrency).toBe("EUR");
		expect(summary.fleet.totalCents).toBe(MILLION);
		expect(summary.unconverted.currencies).toEqual(["CHF", "USD"]);
	});
});

describe("the rental contracts list", () => {
	it("reports the reporting currency and discloses what it could not convert, sorted by value", async () => {
		await writeReportingCurrency(db, "USD");
		await conversion.rerateAll("rentalContract");

		const list = await rentalContracts.list({
			q: "",
			page: 1,
			pageSize: 25,
			sort: "amount",
			dir: "desc",
			status: "all",
			owner: userId,
			vehicle: "all",
			channel: "all",
		});

		expect(list.reportingCurrency).toBe("USD");
		expect(list.unconverted.count).toBe(0);

		const amounts = list.rows.map((row) => row.baseAmountCents);
		expect(amounts).toEqual([...amounts].sort((a, b) => (b ?? 0) - (a ?? 0)));
	});
});

describe("a converted figure knows which currency it is in", () => {
	it("leaves a rental contract whose baseAmount predates a currency change out of totals", async () => {
		await writeReportingCurrency(db, "USD");
		await conversion.rerateAll("rentalContract");

		const before = await pipelineCents();
		const summary = await dashboard.summary(userId, { scope: "me" });
		expect(summary.unconverted.count).toBe(0);

		const contractId = await makeContract({
			ownerId: userId,
			amountCents: MILLION,
			currency: "USD",
		});

		expect(await pipelineCents()).toBe(before + MILLION);

		await db.rentalContract.update({
			where: { id: contractId },
			data: { baseCurrency: "JPY" },
		});

		expect(await pipelineCents()).toBe(before);

		const stale = await dashboard.summary(userId, { scope: "me" });
		expect(stale.unconverted.count).toBe(1);

		const filled = await conversion.fillMissing("rentalContract");
		expect(filled.converted).toBeGreaterThan(0);

		expect(await pipelineCents()).toBe(before + MILLION);

		await db.rentalContract.delete({ where: { id: contractId } });
	});

	it("never lets a converted figure with no currency on it go unnoticed", async () => {
		await writeReportingCurrency(db, "USD");
		await conversion.rerateAll("rentalContract");

		const before = await pipelineCents();
		const vehicleId = await makeVehicle();
		const { startDate, endDate } = tomorrowRange();

		const orphan = await db.rentalContract.create({
			data: {
				vehicleId,
				contactId: renterId,
				ownerId: userId,
				startDate: new Date(startDate),
				endDate: new Date(endDate),
				pricePerDay: 50_000,
				currency: "USD",
				totalAmount: 50_000,
				baseAmount: 50_000,
				fxRate: 1,
				fxRateAt: new Date(),
				depositAmount: 100,
			},
			select: { id: true },
		});

		expect(await pipelineCents()).toBe(before);

		const summary = await dashboard.summary(userId, { scope: "me" });
		expect(summary.unconverted.count).toBe(1);

		await conversion.fillMissing("rentalContract");

		const healed = await db.rentalContract.findUnique({
			where: { id: orphan.id },
			select: { baseCurrency: true },
		});
		expect(healed?.baseCurrency).toBe("USD");
		expect(await pipelineCents()).toBe(before + 5_000_000);

		await db.rentalContract.delete({ where: { id: orphan.id } });
	});

	it("counts a currency once however it was cased or padded", async () => {
		const rows = await Promise.all(
			[" usd ", "Usd"].map(async (currency) => {
				const vehicleId = await makeVehicle();
				const { startDate, endDate } = tomorrowRange();
				return db.rentalContract.create({
					data: {
						vehicleId,
						contactId: renterId,
						ownerId: userId,
						startDate: new Date(startDate),
						endDate: new Date(endDate),
						pricePerDay: 1000,
						currency,
						totalAmount: 1000,
						depositAmount: 100,
					},
					select: { id: true },
				});
			}),
		);

		const pending = await conversion.unconverted("rentalContract");
		expect(pending.currencies.filter((code) => code === "USD")).toEqual([
			"USD",
		]);

		const rerated = await conversion.rerateAll("rentalContract");

		const written = await db.rentalContract.findMany({
			where: { id: { in: rows.map((row) => row.id) } },
			select: { baseAmount: true, baseCurrency: true },
		});

		for (const row of written) {
			expect(row.baseCurrency).toBe("USD");
			expect(row.baseAmount?.toNumber()).toBe(1000);
		}

		const groups = await db.rentalContract.groupBy({
			by: ["currency"],
			_count: { _all: true },
		});

		const convertible = groups
			.filter(
				(group) => !rerated.missing.includes(normalizeCurrency(group.currency)),
			)
			.reduce((total, group) => total + group._count._all, 0);

		expect(rerated.converted).toBe(convertible);

		await db.rentalContract.deleteMany({
			where: { id: { in: rows.map((row) => row.id) } },
		});
	});

	it("keeps a converted rental contract when the rate behind it has gone away", async () => {
		await writeReportingCurrency(db, "USD");
		await conversion.rerateAll("rentalContract");

		const contractId = await makeContract({
			ownerId: userId,
			amountCents: MILLION,
			currency: "EUR",
		});

		const frozen = await db.rentalContract.findUnique({
			where: { id: contractId },
			select: { baseAmount: true },
		});
		expect(frozen?.baseAmount).not.toBeNull();

		const before = await pipelineCents();

		await clearRates();

		const strandedVehicleId = await makeVehicle();
		const { startDate, endDate } = tomorrowRange();
		const stranded = await db.rentalContract.create({
			data: {
				vehicleId: strandedVehicleId,
				contactId: renterId,
				ownerId: userId,
				startDate: new Date(startDate),
				endDate: new Date(endDate),
				pricePerDay: 1000,
				currency: "EUR",
				totalAmount: 1000,
				depositAmount: 100,
			},
			select: { id: true },
		});

		const filled = await conversion.fillMissing("rentalContract");
		expect(filled.missing).toContain("EUR");
		expect(filled.cleared).toBe(0);

		const kept = await db.rentalContract.findUnique({
			where: { id: contractId },
			select: { baseAmount: true, baseCurrency: true },
		});
		expect(kept?.baseCurrency).toBe("USD");
		expect(kept?.baseAmount?.toNumber()).toBe(frozen?.baseAmount?.toNumber());
		expect(await pipelineCents()).toBe(before);

		await db.rentalContract.deleteMany({
			where: { id: { in: [contractId, stranded.id] } },
		});
		await rate("EUR", "1.10", RateSource.FETCHED);
	});
});

describe("the dashboard only values what it can convert", () => {
	const analystId = `analyst-${suffix}`;

	beforeAll(async () => {
		await writeReportingCurrency(db, "USD");

		await db.user.upsert({
			where: { id: analystId },
			create: {
				id: analystId,
				name: "Dashboard Tester",
				email: `dashboard@${domain}`,
				emailVerified: true,
			},
			update: {},
		});
	});

	afterAll(async () => {
		await db.rentalContract.deleteMany({ where: { ownerId: analystId } });
		await db.user.deleteMany({ where: { id: analystId } });
	});

	async function staleCompleted(): Promise<string> {
		const vehicleId = await makeVehicle();
		const { startDate, endDate } = tomorrowRange();

		const contract = await db.rentalContract.create({
			data: {
				vehicleId,
				contactId: renterId,
				ownerId: analystId,
				status: "COMPLETED",
				startDate: new Date(startDate),
				endDate: new Date(endDate),
				actualReturnAt: new Date(),
				pricePerDay: 9_000,
				currency: "USD",
				totalAmount: 9_000,
				baseAmount: 9_000,
				baseCurrency: "JPY",
				fxRate: 1,
				fxRateAt: new Date(),
				depositAmount: 100,
			},
			select: { id: true },
		});

		return contract.id;
	}

	async function staleOpen(): Promise<string> {
		const vehicleId = await makeVehicle();
		const { startDate, endDate } = tomorrowRange();

		const contract = await db.rentalContract.create({
			data: {
				vehicleId,
				contactId: renterId,
				ownerId: analystId,
				status: "RESERVED",
				startDate: new Date(startDate),
				endDate: new Date(endDate),
				pricePerDay: 9_000,
				currency: "USD",
				totalAmount: 9_000,
				baseAmount: 9_000,
				baseCurrency: "JPY",
				fxRate: 1,
				fxRateAt: new Date(),
				depositAmount: 100,
			},
			select: { id: true },
		});

		return contract.id;
	}

	it("does not average a completed contract it cannot value into the rest", async () => {
		const wonId = await makeContract({
			ownerId: analystId,
			amountCents: 10_000,
			currency: "USD",
		});
		await rentalContracts.recordReturn({
			id: wonId,
			mileageAtReturn: 100,
			fuelLevelAtReturn: "FULL",
		});

		const unvaluedId = await staleCompleted();

		const summary = await dashboard.summary(analystId, { scope: "me" });

		expect(summary.performance.completedCount).toBe(2);
		expect(summary.performance.avgContractCents).toBe(10_000);
		expect(summary.unconverted.count).toBe(1);

		await db.rentalContract.deleteMany({
			where: { id: { in: [wonId, unvaluedId] } },
		});
	});

	it("does not let a stale figure set the highest-value active contract", async () => {
		const openId = await makeContract({
			ownerId: analystId,
			amountCents: 10_000,
			currency: "USD",
		});
		await rentalContracts.setStatus(
			{ id: openId, status: "RESERVED" },
			analystId,
		);

		const unvaluedId = await staleOpen();

		const summary = await dashboard.summary(analystId, { scope: "me" });

		expect(summary.topActiveContracts[0]?.id).toBe(openId);
		expect(summary.topActiveContracts[0]?.baseAmountCents).toBe(10_000);
		expect(
			summary.topActiveContracts.find((contract) => contract.id === unvaluedId)
				?.baseAmountCents,
		).toBeNull();

		await db.rentalContract.deleteMany({
			where: { id: { in: [openId, unvaluedId] } },
		});
	});
});
