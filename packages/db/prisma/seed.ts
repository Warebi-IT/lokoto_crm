import { db } from "../src/client";
import { DEFAULT_REPORTING_CURRENCY } from "../src/currency";
import {
	ActivityType,
	ChargeFrequency,
	DepositMethod,
	DepositStatus,
	DriverRole,
	FinancingType,
	FuelLevel,
	IncidentType,
	InspectionType,
	InsuranceClaimStatus,
	MaintenanceType,
	PaymentMethod,
	PaymentStatus,
	PaymentType,
	RateSource,
	RentalChannel,
	RentalContractStatus,
	ResponsibleParty,
	VehicleStatus,
	VehicleType,
} from "../src/generated/prisma/enums";
import { readReportingCurrency, SETTINGS_ID } from "../src/settings";

function makeRandom(seed: number): () => number {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const random = makeRandom(20260731);

function pick<T>(items: readonly T[]): T {
	const item = items[Math.floor(random() * items.length)];
	if (item === undefined) throw new Error("pick() on an empty list");
	return item;
}

function chance(probability: number): boolean {
	return random() < probability;
}

function integer(min: number, max: number): number {
	return min + Math.floor(random() * (max - min + 1));
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.now();

function daysFromNow(days: number, jitterHours = 0): Date {
	const jitter = jitterHours
		? (random() - 0.5) * jitterHours * 60 * 60 * 1000
		: 0;
	return new Date(NOW + days * DAY_MS + jitter);
}

const OWNERS = [
	{ name: "Ada Okafor", email: "ada@trycomp.ai" },
	{ name: "Marcus Lindqvist", email: "marcus@trycomp.ai" },
	{ name: "Priya Raman", email: "priya@trycomp.ai" },
] as const;

const EMAIL_DOMAINS = [
	"gmail.com",
	"outlook.com",
	"yahoo.com",
	"orange.sn",
] as const;

const FIRST_NAMES = [
	"Amara",
	"Ben",
	"Chidi",
	"Dana",
	"Elias",
	"Farah",
	"Gus",
	"Hana",
	"Ines",
	"Jonas",
	"Kofi",
	"Lena",
	"Mateo",
	"Nadia",
	"Omar",
	"Pia",
	"Quinn",
	"Rosa",
	"Sami",
	"Tara",
	"Ugo",
	"Vera",
	"Wes",
	"Yuki",
] as const;

const LAST_NAMES = [
	"Adeyemi",
	"Bergström",
	"Chen",
	"Dubois",
	"Eriksen",
	"Fontaine",
	"Gupta",
	"Haddad",
	"Ivanova",
	"Jensen",
	"Kowalski",
	"Lombardi",
	"Moreau",
	"Nakamura",
	"Oyelaran",
	"Petrov",
	"Quintana",
	"Rossi",
	"Sørensen",
	"Takahashi",
] as const;

const NOTE_BODIES = [
	"Client called ahead to say they're running about an hour late for pickup.",
	"Asked about extending the mileage allowance for a trip to Saint-Louis.",
	"Client mentioned a faint noise from the front brakes — flagged for the return inspection.",
	"Paid the deposit in two installments, cash then Wave — both confirmed.",
	"Requested an extra day; the vehicle is already reserved right after this contract, declined.",
	"Vehicle picked up on time, all documents in order.",
] as const;

const CALL_SUBJECTS = [
	"Pickup confirmation call",
	"Deposit reminder call",
	"Late return follow-up",
	"Damage discussion",
	"Extension request",
] as const;

const TASK_SUBJECTS = [
	"Confirm pickup time with client",
	"Chase outstanding deposit",
	"Schedule vehicle inspection",
	"Follow up on late return",
	"Send contract for signature",
] as const;

const MEETING_SUBJECTS = [
	"Vehicle hand-over",
	"Vehicle return / état des lieux",
	"Contract signing",
] as const;

const EMAIL_SUBJECTS = [
	"Your rental contract and receipt",
	"Reminder: return your vehicle tomorrow",
	"Deposit refund confirmation",
	"Following up on the damage report",
] as const;

const TRANSLITERATIONS: Record<string, string> = {
	ø: "o",
	æ: "ae",
	œ: "oe",
	å: "a",
	ß: "ss",
	đ: "d",
	ł: "l",
	þ: "th",
};

function slug(value: string): string {
	return value
		.toLowerCase()
		.replace(/[øæœåßđłþ]/g, (char) => TRANSLITERATIONS[char] ?? char)
		.normalize("NFD")
		.replace(/\p{Mn}/gu, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

async function seedOwners(): Promise<string[]> {
	const existing = await db.user.findMany({ select: { id: true } });

	if (existing.length > 0) {
		console.log(`Using ${existing.length} existing user(s) as owners.`);
		return existing.map((user) => user.id);
	}

	console.log("No users yet — creating placeholder sales reps.");
	const created = await Promise.all(
		OWNERS.map((owner) =>
			db.user.upsert({
				where: { email: owner.email },
				create: {
					id: `seed-${slug(owner.name)}`,
					name: owner.name,
					email: owner.email,
					emailVerified: true,
					updatedAt: new Date(),
				},
				update: {},
				select: { id: true },
			}),
		),
	);

	return created.map((user) => user.id);
}

type SeededContact = { id: string };

const CONTACT_COUNT = 40;

async function seedContacts(): Promise<SeededContact[]> {
	const contacts: SeededContact[] = [];
	const used = new Set<string>();

	while (contacts.length < CONTACT_COUNT) {
		const firstName = pick(FIRST_NAMES);
		const lastName = pick(LAST_NAMES);
		const domain = pick(EMAIL_DOMAINS);
		const email = `${slug(firstName)}.${slug(lastName)}${integer(1, 99)}@${domain}`;
		if (used.has(email)) continue;
		used.add(email);

		const contact = await db.contact.upsert({
			where: { email },
			create: {
				firstName,
				lastName,
				email,
				phone: chance(0.6)
					? `+221 77 ${integer(100, 999)} ${integer(10, 99)} ${integer(10, 99)}`
					: null,
				createdAt: daysFromNow(-integer(10, 300), 12),
			},
			update: {},
			select: { id: true },
		});

		contacts.push({ id: contact.id });
	}

	return contacts;
}

const SEED_RATES: Record<string, number> = {
	EUR: 1.09,
	GBP: 1.27,
	CAD: 0.73,
	AUD: 0.66,
	JPY: 0.0067,
};

const RENTAL_CURRENCIES = ["USD", "USD", "USD", "EUR"];

let seedBase = "USD";

async function seedRates(): Promise<number> {
	const asOf = daysFromNow(-1);

	await db.appSetting.upsert({
		where: { id: SETTINGS_ID },
		create: {
			id: SETTINGS_ID,
			reportingCurrency: DEFAULT_REPORTING_CURRENCY,
		},
		update: {},
		select: { id: true },
	});

	seedBase = await readReportingCurrency(db);

	if (seedBase !== "USD") {
		console.log(
			`Reporting currency is ${seedBase} — seeding a converted figure only for ` +
				`records already in ${seedBase}; the rates cron converts the rest.`,
		);
	}

	for (const [quoteCurrency, rate] of Object.entries(SEED_RATES)) {
		await db.exchangeRate.upsert({
			where: {
				baseCurrency_quoteCurrency_source: {
					baseCurrency: "USD",
					quoteCurrency,
					source: RateSource.FETCHED,
				},
			},
			create: {
				baseCurrency: "USD",
				quoteCurrency,
				rate,
				asOf,
				source: RateSource.FETCHED,
				provider: "seed",
			},
			update: { rate, asOf, provider: "seed" },
		});
	}

	return Object.keys(SEED_RATES).length;
}

function money(usdAmount: number, currency: string) {
	const rate = SEED_RATES[currency] ?? 1;
	const places = currency === "JPY" ? 0 : 2;
	const amount = Number((usdAmount / rate).toFixed(places));

	const converted =
		currency === seedBase
			? { baseAmount: amount, fxRate: 1 }
			: seedBase === "USD"
				? { baseAmount: Number((amount * rate).toFixed(2)), fxRate: rate }
				: null;

	return {
		amount,
		currency,
		baseAmount: converted?.baseAmount ?? null,
		baseCurrency: converted ? seedBase : null,
		fxRate: converted?.fxRate ?? null,
	};
}

type SeedVehicleSpec = {
	type: VehicleType;
	make: string;
	model: string;
	year: number;
	plateNumber: string;
	color: string;
	dailyRateUsd: number;
	mileage: number;
	status?: VehicleStatus;
};

const VEHICLES: readonly SeedVehicleSpec[] = [
	{
		type: VehicleType.CAR,
		make: "Toyota",
		model: "Corolla",
		year: 2021,
		plateNumber: "DK-1234-AA",
		color: "White",
		dailyRateUsd: 45,
		mileage: 38000,
	},
	{
		type: VehicleType.CAR,
		make: "Toyota",
		model: "Hilux",
		year: 2022,
		plateNumber: "DK-2201-AB",
		color: "Grey",
		dailyRateUsd: 70,
		mileage: 21000,
	},
	{
		type: VehicleType.CAR,
		make: "Hyundai",
		model: "Tucson",
		year: 2020,
		plateNumber: "DK-3120-AC",
		color: "Black",
		dailyRateUsd: 55,
		mileage: 61000,
	},
	{
		type: VehicleType.CAR,
		make: "Toyota",
		model: "Yaris",
		year: 2019,
		plateNumber: "DK-3388-AD",
		color: "Blue",
		dailyRateUsd: 38,
		mileage: 84000,
		status: VehicleStatus.OUT_OF_SERVICE,
	},
	{
		type: VehicleType.MOTORCYCLE,
		make: "Suzuki",
		model: "Djakarta 125",
		year: 2023,
		plateNumber: "DK-4410-MB",
		color: "Red",
		dailyRateUsd: 12,
		mileage: 9000,
	},
	{
		type: VehicleType.MOTORCYCLE,
		make: "Yamaha",
		model: "XTZ 125",
		year: 2022,
		plateNumber: "DK-4521-MB",
		color: "White",
		dailyRateUsd: 14,
		mileage: 15000,
	},
	{
		type: VehicleType.SCOOTER,
		make: "TVS",
		model: "Wego",
		year: 2023,
		plateNumber: "DK-5502-SC",
		color: "Yellow",
		dailyRateUsd: 9,
		mileage: 4200,
	},
	{
		type: VehicleType.SCOOTER,
		make: "Sanya",
		model: "Elec 50",
		year: 2024,
		plateNumber: "DK-5610-SC",
		color: "Green",
		dailyRateUsd: 8,
		mileage: 1800,
	},
	{
		type: VehicleType.TRUCK,
		make: "Renault",
		model: "Master",
		year: 2019,
		plateNumber: "DK-6011-CT",
		color: "White",
		dailyRateUsd: 90,
		mileage: 92000,
		status: VehicleStatus.MAINTENANCE,
	},
	{
		type: VehicleType.TRUCK,
		make: "Isuzu",
		model: "NPR",
		year: 2020,
		plateNumber: "DK-6120-CT",
		color: "White",
		dailyRateUsd: 110,
		mileage: 74000,
	},
	{
		type: VehicleType.MINIBUS,
		make: "Mercedes-Benz",
		model: "Sprinter",
		year: 2021,
		plateNumber: "DK-7002-TP",
		color: "White",
		dailyRateUsd: 130,
		mileage: 55000,
	},
	{
		type: VehicleType.MINIBUS,
		make: "Toyota",
		model: "Coaster",
		year: 2018,
		plateNumber: "DK-7110-TP",
		color: "Blue",
		dailyRateUsd: 140,
		mileage: 103000,
	},
];

type SeededVehicle = {
	id: string;
	plateNumber: string;
	dailyRateUsd: number;
	status: VehicleStatus;
};

async function seedVehicles(): Promise<SeededVehicle[]> {
	const vehicles: SeededVehicle[] = [];

	for (const spec of VEHICLES) {
		const currency = pick(RENTAL_CURRENCIES);
		const { amount, baseAmount, baseCurrency, fxRate } = money(
			spec.dailyRateUsd,
			currency,
		);

		const row = await db.vehicle.upsert({
			where: { plateNumber: spec.plateNumber },
			create: {
				type: spec.type,
				make: spec.make,
				model: spec.model,
				year: spec.year,
				plateNumber: spec.plateNumber,
				color: spec.color,
				status: spec.status ?? VehicleStatus.AVAILABLE,
				dailyRate: amount,
				currency,
				baseAmount,
				baseCurrency,
				fxRate,
				fxRateAt: fxRate === null ? null : daysFromNow(-1),
				mileage: spec.mileage,
				insurancePolicyNumber: `POL-${integer(100000, 999999)}`,
				insuranceExpiresAt: daysFromNow(integer(-30, 300)),
				registrationExpiresAt: daysFromNow(integer(-10, 400)),
				nextMaintenanceAtKm: spec.mileage + integer(1500, 5000),
				createdAt: daysFromNow(-integer(30, 500), 12),
			},
			update: {},
			select: { id: true, plateNumber: true, status: true },
		});

		vehicles.push({
			id: row.id,
			plateNumber: row.plateNumber,
			dailyRateUsd: spec.dailyRateUsd,
			status: row.status,
		});
	}

	return vehicles;
}

type SeededContract = {
	id: string;
	vehicleId: string;
	contactId: string;
	ownerId: string;
	status: RentalContractStatus;
	pricePerDayUsd: number;
	days: number;
	currency: string;
};

async function seedRentalContracts(
	vehicles: SeededVehicle[],
	contacts: SeededContact[],
	ownerIds: string[],
): Promise<SeededContract[]> {
	const contracts: SeededContract[] = [];

	const plan: {
		status: RentalContractStatus;
		startOffsetDays: number;
		durationDays: number;
		withAdditionalDriver?: boolean;
		cancelled?: boolean;
	}[] = [
		{
			status: RentalContractStatus.COMPLETED,
			startOffsetDays: -20,
			durationDays: 4,
		},
		{
			status: RentalContractStatus.COMPLETED,
			startOffsetDays: -12,
			durationDays: 3,
			withAdditionalDriver: true,
		},
		{
			status: RentalContractStatus.COMPLETED,
			startOffsetDays: -7,
			durationDays: 2,
		},
		{
			status: RentalContractStatus.ACTIVE,
			startOffsetDays: -2,
			durationDays: 5,
		},
		{
			status: RentalContractStatus.ACTIVE,
			startOffsetDays: -1,
			durationDays: 3,
		},
		{
			status: RentalContractStatus.RESERVED,
			startOffsetDays: 3,
			durationDays: 4,
		},
		{
			status: RentalContractStatus.RESERVED,
			startOffsetDays: 7,
			durationDays: 2,
		},
		{
			status: RentalContractStatus.DRAFT,
			startOffsetDays: 10,
			durationDays: 3,
		},
		{
			status: RentalContractStatus.CANCELLED,
			startOffsetDays: -5,
			durationDays: 3,
			cancelled: true,
		},
	];

	const availableVehicles = vehicles.filter(
		(vehicle) => vehicle.status !== VehicleStatus.OUT_OF_SERVICE,
	);

	for (const [index, entry] of plan.entries()) {
		const vehicle = availableVehicles[index % availableVehicles.length];
		if (!vehicle) continue;

		const renter = pick(contacts);
		const ownerId = pick(ownerIds);
		const startDate = daysFromNow(entry.startOffsetDays, 6);
		const endDate = daysFromNow(entry.startOffsetDays + entry.durationDays, 6);
		const currency = pick(RENTAL_CURRENCIES);
		const totalUsd = vehicle.dailyRateUsd * entry.durationDays;
		const {
			amount: totalAmount,
			baseAmount,
			baseCurrency,
			fxRate,
		} = money(totalUsd, currency);
		const { amount: pricePerDay } = money(vehicle.dailyRateUsd, currency);
		const depositUsd = Math.round(vehicle.dailyRateUsd * 2);
		const { amount: depositAmount } = money(depositUsd, currency);

		const isCompleted = entry.status === RentalContractStatus.COMPLETED;
		const isActive = entry.status === RentalContractStatus.ACTIVE;
		const isCancelled = entry.cancelled === true;

		const id = `seed-contract-${slug(vehicle.plateNumber)}-${index}`;

		const contract = await db.rentalContract.upsert({
			where: { id },
			create: {
				id,
				vehicleId: vehicle.id,
				contactId: renter.id,
				ownerId,
				status: entry.status,
				channel: chance(0.3) ? RentalChannel.ONLINE : RentalChannel.AGENT,
				startDate,
				endDate,
				actualPickupAt: isCompleted || isActive ? startDate : null,
				actualReturnAt: isCompleted ? endDate : null,
				pricePerDay,
				currency,
				totalAmount,
				baseAmount,
				baseCurrency,
				fxRate,
				fxRateAt: fxRate === null ? null : daysFromNow(-1),
				mileageIncludedPerDay: 150,
				extraMileageFeePerKm: money(0.3, currency).amount,
				mileageAtPickup: isCompleted || isActive ? integer(1000, 90000) : null,
				mileageAtReturn: isCompleted
					? integer(1000, 90000) + integer(50, 600)
					: null,
				fuelLevelAtPickup: isCompleted || isActive ? FuelLevel.FULL : null,
				fuelLevelAtReturn: isCompleted
					? pick([FuelLevel.FULL, FuelLevel.THREE_QUARTER, FuelLevel.HALF])
					: null,
				depositAmount,
				depositCurrency: currency,
				depositMethod: pick([DepositMethod.CASH, DepositMethod.MOBILE_MONEY]),
				depositStatus: isCompleted
					? DepositStatus.RETURNED
					: isCancelled
						? DepositStatus.RETURNED
						: DepositStatus.HELD,
				depositReturnedAmount:
					isCompleted || isCancelled ? depositAmount : null,
				depositReturnedAt: isCompleted || isCancelled ? endDate : null,
				cancelledAt: isCancelled
					? daysFromNow(entry.startOffsetDays - 1)
					: null,
				cancelledReason: isCancelled
					? "Client no-show, deposit refunded"
					: null,
				signedAt: isCompleted || isActive ? startDate : null,
				createdAt: daysFromNow(entry.startOffsetDays - integer(1, 5), 12),
			},
			update: {},
			select: { id: true },
		});

		if (entry.withAdditionalDriver) {
			const secondDriver = pick(
				contacts.filter((contact) => contact.id !== renter.id),
			);
			await db.rentalContractDriver.upsert({
				where: {
					contractId_contactId: {
						contractId: contract.id,
						contactId: secondDriver.id,
					},
				},
				create: {
					contractId: contract.id,
					contactId: secondDriver.id,
					role: DriverRole.ADDITIONAL,
				},
				update: {},
			});
		}

		await db.rentalContractDriver.upsert({
			where: {
				contractId_contactId: { contractId: contract.id, contactId: renter.id },
			},
			create: {
				contractId: contract.id,
				contactId: renter.id,
				role: DriverRole.PRIMARY,
			},
			update: {},
		});

		contracts.push({
			id: contract.id,
			vehicleId: vehicle.id,
			contactId: renter.id,
			ownerId,
			status: entry.status,
			pricePerDayUsd: vehicle.dailyRateUsd,
			days: entry.durationDays,
			currency,
		});
	}

	return contracts;
}

async function seedPayments(contracts: SeededContract[]): Promise<number> {
	let count = 0;

	for (const [index, contract] of contracts.entries()) {
		if (contract.status === RentalContractStatus.DRAFT) continue;

		const totalUsd = contract.pricePerDayUsd * contract.days;
		const depositUsd = Math.round(contract.pricePerDayUsd * 2);
		const split = index === 0;

		const rentalPayments = split
			? [
					{ shareUsd: totalUsd * 0.5, method: PaymentMethod.CASH },
					{ shareUsd: totalUsd * 0.5, method: PaymentMethod.WAVE },
				]
			: [
					{
						shareUsd: totalUsd,
						method: pick([
							PaymentMethod.CASH,
							PaymentMethod.WAVE,
							PaymentMethod.ORANGE_MONEY,
						]),
					},
				];

		for (const [n, payment] of rentalPayments.entries()) {
			const { amount, currency, baseAmount, baseCurrency, fxRate } = money(
				payment.shareUsd,
				contract.currency,
			);
			await db.payment.upsert({
				where: { id: `seed-payment-${contract.id}-rental-${n}` },
				create: {
					id: `seed-payment-${contract.id}-rental-${n}`,
					rentalContractId: contract.id,
					type: PaymentType.RENTAL_FEE,
					amount,
					currency,
					baseAmount,
					baseCurrency,
					fxRate,
					fxRateAt: fxRate === null ? null : daysFromNow(-1),
					method: payment.method,
					status: PaymentStatus.COMPLETED,
					reference:
						payment.method === PaymentMethod.CASH
							? null
							: `${payment.method}-${integer(100000, 999999)}`,
					paidAt: daysFromNow(-integer(1, 15)),
					recordedById: contract.ownerId,
				},
				update: {},
			});
			count += 1;
		}

		const { amount, currency, baseAmount, baseCurrency, fxRate } = money(
			depositUsd,
			contract.currency,
		);
		await db.payment.upsert({
			where: { id: `seed-payment-${contract.id}-deposit` },
			create: {
				id: `seed-payment-${contract.id}-deposit`,
				rentalContractId: contract.id,
				type: PaymentType.DEPOSIT,
				amount,
				currency,
				baseAmount,
				baseCurrency,
				fxRate,
				fxRateAt: fxRate === null ? null : daysFromNow(-1),
				method: pick([PaymentMethod.CASH, PaymentMethod.WAVE]),
				status: PaymentStatus.COMPLETED,
				reference: null,
				paidAt: daysFromNow(-integer(1, 15)),
				recordedById: contract.ownerId,
			},
			update: {},
		});
		count += 1;
	}

	return count;
}

async function seedIncidents(
	vehicles: SeededVehicle[],
	contracts: SeededContract[],
	ownerIds: string[],
): Promise<number> {
	const completed = contracts.find(
		(contract) => contract.status === RentalContractStatus.COMPLETED,
	);
	const spareVehicle = vehicles[vehicles.length - 1];

	let count = 0;

	if (completed) {
		await db.incident.upsert({
			where: { id: "seed-incident-damage" },
			create: {
				id: "seed-incident-damage",
				vehicleId: completed.vehicleId,
				rentalContractId: completed.id,
				type: IncidentType.DAMAGE,
				reportedAt: daysFromNow(-6),
				reportedById: completed.ownerId,
				description: "Scratch on the rear bumper noticed at check-in.",
				responsibleParty: ResponsibleParty.CLIENT,
				insuranceClaimNumber: `CLM-${integer(10000, 99999)}`,
				insuranceStatus: InsuranceClaimStatus.PAID,
				estimatedCost: 120,
				actualCost: 95,
				currency: "USD",
				resolvedAt: daysFromNow(-2),
			},
			update: {},
		});
		count += 1;
	}

	if (spareVehicle) {
		await db.incident.upsert({
			where: { id: "seed-incident-breakdown" },
			create: {
				id: "seed-incident-breakdown",
				vehicleId: spareVehicle.id,
				type: IncidentType.BREAKDOWN,
				reportedAt: daysFromNow(-1),
				reportedById: pick(ownerIds),
				description: "Won't start — suspected battery, at the depot.",
				responsibleParty: ResponsibleParty.AGENCY,
				insuranceStatus: InsuranceClaimStatus.NOT_FILED,
				estimatedCost: 60,
				currency: "USD",
			},
			update: {},
		});
		count += 1;
	}

	return count;
}

async function seedMaintenanceRecords(
	vehicles: SeededVehicle[],
): Promise<number> {
	if (vehicles.length < 2) return 0;
	let count = 0;

	const serviced = vehicles[0];
	if (serviced) {
		await db.maintenanceRecord.upsert({
			where: { id: "seed-maintenance-oil-change" },
			create: {
				id: "seed-maintenance-oil-change",
				vehicleId: serviced.id,
				type: MaintenanceType.SCHEDULED,
				description: "Oil and filter change",
				completedAt: daysFromNow(-15),
				odometerAtService: integer(30000, 40000),
				mechanic: "Garage Diallo",
				cost: 45,
				currency: "USD",
				invoiceReference: "INV-2211",
			},
			update: {},
		});
		count += 1;
	}

	const upcoming = vehicles[1];
	if (upcoming) {
		await db.maintenanceRecord.upsert({
			where: { id: "seed-maintenance-upcoming-service" },
			create: {
				id: "seed-maintenance-upcoming-service",
				vehicleId: upcoming.id,
				type: MaintenanceType.SCHEDULED,
				description: "40,000 km service",
				scheduledAtKm: 40000,
				scheduledAtDate: daysFromNow(10),
				blocksAvailability: false,
			},
			update: {},
		});
		count += 1;
	}

	return count;
}

async function seedInspections(contracts: SeededContract[]): Promise<number> {
	let count = 0;

	for (const contract of contracts) {
		if (
			contract.status !== RentalContractStatus.COMPLETED &&
			contract.status !== RentalContractStatus.ACTIVE
		) {
			continue;
		}

		await db.vehicleInspection.upsert({
			where: { id: `seed-inspection-${contract.id}-out` },
			create: {
				id: `seed-inspection-${contract.id}-out`,
				rentalContractId: contract.id,
				type: InspectionType.CHECK_OUT,
				odometer: integer(1000, 90000),
				fuelLevel: FuelLevel.FULL,
				inspectedById: contract.ownerId,
				inspectedAt: daysFromNow(-integer(1, 20)),
			},
			update: {},
		});
		count += 1;

		if (contract.status === RentalContractStatus.COMPLETED) {
			await db.vehicleInspection.upsert({
				where: { id: `seed-inspection-${contract.id}-in` },
				create: {
					id: `seed-inspection-${contract.id}-in`,
					rentalContractId: contract.id,
					type: InspectionType.CHECK_IN,
					odometer: integer(1000, 90000),
					fuelLevel: pick([
						FuelLevel.FULL,
						FuelLevel.THREE_QUARTER,
						FuelLevel.HALF,
					]),
					damageNotes: chance(0.3) ? "Minor scuff on rear bumper." : null,
					inspectedById: contract.ownerId,
					inspectedAt: daysFromNow(-integer(1, 10)),
				},
				update: {},
			});
			count += 1;
		}
	}

	return count;
}

async function seedVehicleFinancing(
	vehicles: SeededVehicle[],
): Promise<number> {
	let count = 0;

	const financed = vehicles[0];
	if (financed) {
		const {
			amount: monthlyPayment,
			baseAmount,
			baseCurrency,
			fxRate,
		} = money(350, "USD");
		await db.vehicleFinancing.upsert({
			where: { vehicleId: financed.id },
			create: {
				vehicleId: financed.id,
				type: FinancingType.LOAN,
				principalAmount: 18000,
				monthlyPayment,
				currency: "USD",
				baseAmount,
				baseCurrency,
				fxRate,
				fxRateAt: fxRate === null ? null : daysFromNow(-1),
				interestRate: 7.5,
				termMonths: 48,
				startDate: daysFromNow(-200),
			},
			update: {},
		});
		count += 1;
	}

	const leased = vehicles[1];
	if (leased) {
		const {
			amount: monthlyPayment,
			baseAmount,
			baseCurrency,
			fxRate,
		} = money(300, "USD");
		await db.vehicleFinancing.upsert({
			where: { vehicleId: leased.id },
			create: {
				vehicleId: leased.id,
				type: FinancingType.LEASING,
				monthlyPayment,
				currency: "USD",
				baseAmount,
				baseCurrency,
				fxRate,
				fxRateAt: fxRate === null ? null : daysFromNow(-1),
				termMonths: 36,
				startDate: daysFromNow(-90),
			},
			update: {},
		});
		count += 1;
	}

	return count;
}

async function seedVehicleCharges(vehicles: SeededVehicle[]): Promise<number> {
	let count = 0;

	const insured = vehicles[2];
	if (insured) {
		const { amount, baseAmount, baseCurrency, fxRate } = money(40, "USD");
		await db.vehicleCharge.upsert({
			where: { id: "seed-charge-insurance" },
			create: {
				id: "seed-charge-insurance",
				vehicleId: insured.id,
				label: "Assurance mensuelle",
				amount,
				currency: "USD",
				baseAmount,
				baseCurrency,
				fxRate,
				fxRateAt: fxRate === null ? null : daysFromNow(-1),
				frequency: ChargeFrequency.MONTHLY,
				startDate: daysFromNow(-150),
			},
			update: {},
		});
		count += 1;
	}

	const taxed = vehicles[3];
	if (taxed) {
		const { amount, baseAmount, baseCurrency, fxRate } = money(80, "USD");
		await db.vehicleCharge.upsert({
			where: { id: "seed-charge-tax" },
			create: {
				id: "seed-charge-tax",
				vehicleId: taxed.id,
				label: "Vignette annuelle",
				amount,
				currency: "USD",
				baseAmount,
				baseCurrency,
				fxRate,
				fxRateAt: fxRate === null ? null : daysFromNow(-1),
				frequency: ChargeFrequency.ONE_TIME,
				startDate: daysFromNow(-60),
			},
			update: {},
		});
		count += 1;
	}

	return count;
}

async function seedActivities(
	vehicles: SeededVehicle[],
	contracts: SeededContract[],
	ownerIds: string[],
): Promise<number> {
	const existing = await db.activity.count();
	if (existing > 0) {
		console.log(`Activities already seeded (${existing}) — skipping.`);
		return existing;
	}

	type ActivityRow = {
		type: ActivityType;
		subject: string | null;
		body: string | null;
		occurredAt: Date | null;
		dueAt: Date | null;
		completedAt: Date | null;
		contactId: string | null;
		vehicleId: string | null;
		rentalContractId: string | null;
		createdById: string;
		createdAt: Date;
	};

	const rows: ActivityRow[] = [];

	const base = (createdById: string, createdAt: Date) => ({
		contactId: null,
		vehicleId: null,
		rentalContractId: null,
		occurredAt: null,
		dueAt: null,
		completedAt: null,
		subject: null,
		body: null,
		createdById,
		createdAt,
	});

	for (const contract of contracts) {
		if (contract.status === RentalContractStatus.DRAFT) continue;

		for (let n = 0; n < integer(2, 4); n++) {
			const at = daysFromNow(-integer(1, 20), 18);
			const type = pick([
				ActivityType.NOTE,
				ActivityType.CALL,
				ActivityType.EMAIL,
				ActivityType.MEETING,
			]);

			rows.push({
				...base(contract.ownerId, at),
				type,
				rentalContractId: contract.id,
				vehicleId: contract.vehicleId,
				contactId: contract.contactId,
				subject:
					type === ActivityType.CALL
						? pick(CALL_SUBJECTS)
						: type === ActivityType.MEETING
							? pick(MEETING_SUBJECTS)
							: type === ActivityType.EMAIL
								? pick(EMAIL_SUBJECTS)
								: null,
				body: type === ActivityType.NOTE ? pick(NOTE_BODIES) : null,
				occurredAt: type === ActivityType.NOTE ? null : at,
			});
		}

		if (
			contract.status === RentalContractStatus.RESERVED ||
			contract.status === RentalContractStatus.ACTIVE
		) {
			const roll = random();
			const overdue = roll < 0.3;
			const done = roll >= 0.3 && roll < 0.55;
			const dueAt = overdue
				? daysFromNow(-integer(1, 5), 6)
				: daysFromNow(integer(1, 10), 6);

			rows.push({
				...base(contract.ownerId, daysFromNow(-integer(1, 8), 12)),
				type: ActivityType.TASK,
				rentalContractId: contract.id,
				vehicleId: contract.vehicleId,
				contactId: contract.contactId,
				subject: pick(TASK_SUBJECTS),
				dueAt: done ? daysFromNow(-integer(1, 5), 6) : dueAt,
				completedAt: done ? daysFromNow(-integer(1, 3), 6) : null,
			});
		}
	}

	for (const vehicle of vehicles) {
		if (!chance(0.3)) continue;
		rows.push({
			...base(pick(ownerIds), daysFromNow(-integer(1, 60), 12)),
			type: ActivityType.NOTE,
			vehicleId: vehicle.id,
			body: pick(NOTE_BODIES),
		});
	}

	await db.activity.createMany({ data: rows });
	return rows.length;
}

async function main() {
	const rates = await seedRates();
	const ownerIds = await seedOwners();
	const contacts = await seedContacts();
	const vehicles = await seedVehicles();
	const contracts = await seedRentalContracts(vehicles, contacts, ownerIds);
	const payments = await seedPayments(contracts);
	const incidents = await seedIncidents(vehicles, contracts, ownerIds);
	const maintenanceRecords = await seedMaintenanceRecords(vehicles);
	const inspections = await seedInspections(contracts);
	const financing = await seedVehicleFinancing(vehicles);
	const charges = await seedVehicleCharges(vehicles);
	const activities = await seedActivities(vehicles, contracts, ownerIds);

	console.log(
		`Seeded ${contacts.length} contacts, ${vehicles.length} vehicles, ` +
			`${contracts.length} rental contracts, ${payments} payments, ` +
			`${incidents} incidents, ${maintenanceRecords} maintenance records, ` +
			`${inspections} inspections, ${financing} financing plans, ${charges} ` +
			`charges, ${activities} activities, ${rates} exchange rates.`,
	);
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await db.$disconnect();
	});
