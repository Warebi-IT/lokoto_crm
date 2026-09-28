import {
	ActivityType,
	type Db,
	DepositMethod,
	DepositStatus,
	DriverRole,
	type Prisma,
	Prisma as PrismaNamespace,
	type RentalChannel,
	RentalContractStatus,
	VehicleStatus,
} from "@crm/db";
import { normalizeCurrency } from "@crm/db/currency";
import {
	BadRequestException,
	ConflictException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common";
import {
	ActivityStampService,
	type StampTargets,
} from "../crm/activity-stamp.service";
import { type BulkResult, requireOwner, runBulk } from "../crm/bulk";
import { decimalFromCents, parseDate, toCents } from "../crm/values";
import {
	ConversionService,
	type Unconverted,
} from "../currency/conversion.service";
import { InjectDatabase } from "../database/database.constants";
import { FieldsService } from "../fields/fields.service";
import {
	countsByKey,
	FACET_ALL,
	FACET_UNASSIGNED,
	type ListResult,
	paginate,
	resolveOrderBy,
} from "../trpc/list-input";
import type {
	AttachDriverInput,
	DetachDriverInput,
	RecordPickupInput,
	RecordReturnInput,
	RentalContractBulkOwnerInput,
	RentalContractCreateInput,
	RentalContractListInput,
	RentalContractPlanningInput,
	RentalContractUpdateInput,
	SetDepositStatusInput,
	SetDriverRoleInput,
	SetRentalContractStatusInput,
} from "./rental-contracts.contracts";

function extraMileageAmount(
	kilometers: number,
	includedPerDay: number | null,
	days: number,
	rules: Array<{
		kilometers: number | null;
		pricePerKm: PrismaNamespace.Decimal;
	}>,
	fallback: PrismaNamespace.Decimal | null,
) {
	const included = (includedPerDay ?? 0) * days;
	let remaining = Math.max(0, kilometers - included);
	if (remaining === 0) return new PrismaNamespace.Decimal(0);

	if (rules.length === 0) {
		return fallback
			? fallback.times(remaining)
			: new PrismaNamespace.Decimal(0);
	}

	let total = new PrismaNamespace.Decimal(0);
	for (const rule of rules) {
		const tierKilometers = rule.kilometers ?? remaining;
		const charged = Math.min(remaining, tierKilometers);
		total = total.plus(rule.pricePerKm.times(charged));
		remaining -= charged;
		if (remaining <= 0) break;
	}
	return total;
}

const OWNER_SELECT = {
	id: true,
	name: true,
	email: true,
	image: true,
} as const;

const CONTACT_SELECT = {
	id: true,
	firstName: true,
	lastName: true,
	email: true,
	phone: true,
	imageUrl: true,
} as const;

const VEHICLE_SELECT = {
	id: true,
	plateNumber: true,
	make: true,
	model: true,
	type: true,
} as const;

const ACTIVE_OR_PENDING: RentalContractStatus[] = [
	RentalContractStatus.DRAFT,
	RentalContractStatus.RESERVED,
	RentalContractStatus.ACTIVE,
];

const SORTABLE: Record<
	string,
	(dir: Prisma.SortOrder) => Prisma.RentalContractOrderByWithRelationInput[]
> = {
	vehicle: (dir) => [{ vehicle: { plateNumber: dir } }],
	contact: (dir) => [{ contact: { firstName: dir } }],
	status: (dir) => [{ status: dir }, { startDate: "asc" }],
	startDate: (dir) => [{ startDate: dir }],
	endDate: (dir) => [{ endDate: dir }],
	amount: (dir) => [{ baseAmount: { sort: dir, nulls: "last" } }],
	createdAt: (dir) => [{ createdAt: dir }],
	owner: (dir) => [{ owner: { name: dir } }, { startDate: "asc" }],
	lastActivity: (dir) => [{ lastActivityAt: { sort: dir, nulls: "last" } }],
};

function daysBetween(start: Date, end: Date): number {
	const diff = end.getTime() - start.getTime();
	return Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

function requireDate(value: string): Date {
	const parsed = parseDate(value);
	if (!parsed) throw new BadRequestException(`"${value}" is not a date.`);
	return parsed;
}

@Injectable()
export class RentalContractsService {
	private readonly logger = new Logger(RentalContractsService.name);

	constructor(
		@InjectDatabase() private readonly db: Db,
		private readonly stamp: ActivityStampService,
		private readonly conversion: ConversionService,
		private readonly fields: FieldsService,
	) {}

	async list(input: RentalContractListInput) {
		const where = this.buildWhere(input);
		const { skip, take } = paginate(input);
		const base = await this.conversion.reportingCurrency();
		const now = new Date();

		const [rows, total, facetCounts, unconverted] = await Promise.all([
			this.db.rentalContract.findMany({
				where,
				skip,
				take,
				orderBy: resolveOrderBy(input, SORTABLE, [{ createdAt: "desc" }]),
				select: {
					id: true,
					status: true,
					channel: true,
					startDate: true,
					endDate: true,
					pickupTime: true,
					returnTime: true,
					totalAmount: true,
					currency: true,
					baseAmount: true,
					depositStatus: true,
					vehicle: { select: VEHICLE_SELECT },
					contact: { select: CONTACT_SELECT },
					owner: { select: OWNER_SELECT },
					lastActivityAt: true,
					createdAt: true,
				},
			}),
			this.db.rentalContract.count({ where }),
			this.facetCounts(input),
			this.conversion.unconverted("rentalContract", where),
		]);

		const tableFields = await this.fields.tableValuesFor(
			"RENTAL_CONTRACT",
			rows.map((row) => row.id),
		);

		return {
			rows: rows.map(
				({
					totalAmount,
					baseAmount,
					startDate,
					endDate,
					pickupTime,
					returnTime,
					lastActivityAt,
					createdAt,
					status,
					...row
				}) => ({
					...row,
					status,
					startDate: startDate.toISOString(),
					endDate: endDate.toISOString(),
					pickupTime,
					returnTime,
					isLate: status === RentalContractStatus.ACTIVE && endDate < now,
					totalAmountCents: toCents(totalAmount),
					baseAmountCents: toCents(baseAmount),
					lastActivityAt: lastActivityAt?.toISOString() ?? null,
					createdAt: createdAt.toISOString(),
					fields: tableFields.get(row.id) ?? {},
				}),
			),
			total,
			facetCounts,
			reportingCurrency: base,
			unconverted,
		} satisfies ListResult<unknown> & {
			reportingCurrency: string;
			unconverted: Unconverted;
		};
	}

	async planning(input: RentalContractPlanningInput) {
		const startDate = parseDate(input.startDate);
		const endDate = parseDate(input.endDate);
		if (!startDate || !endDate || endDate <= startDate) {
			throw new BadRequestException("End date must be after start date.");
		}

		const [vehicles, contracts] = await Promise.all([
			this.db.vehicle.findMany({
				orderBy: [{ make: "asc" }, { model: "asc" }, { plateNumber: "asc" }],
				select: VEHICLE_SELECT,
			}),
			this.db.rentalContract.findMany({
				where: {
					status: { not: RentalContractStatus.CANCELLED },
					startDate: { lt: endDate },
					endDate: { gt: startDate },
				},
				orderBy: { startDate: "asc" },
				select: {
					id: true,
					vehicleId: true,
					status: true,
					startDate: true,
					endDate: true,
					pickupTime: true,
					returnTime: true,
					contact: { select: CONTACT_SELECT },
				},
			}),
		]);

		return {
			vehicles,
			contracts: contracts.map(({ startDate, endDate, ...row }) => ({
				...row,
				startDate: startDate.toISOString(),
				endDate: endDate.toISOString(),
			})),
		};
	}

	async byId(id: string) {
		const contract = await this.db.rentalContract.findUnique({
			where: { id },
			select: {
				id: true,
				status: true,
				channel: true,
				startDate: true,
				endDate: true,
				pickupTime: true,
				returnTime: true,
				actualPickupAt: true,
				actualReturnAt: true,
				pricePerDay: true,
				currency: true,
				totalAmount: true,
				baseAmount: true,
				fxRate: true,
				fxRateAt: true,
				mileageIncludedPerDay: true,
				extraMileageFeePerKm: true,
				extraMileageAmount: true,
				mileageRules: {
					orderBy: { position: "asc" },
					select: { kilometers: true, pricePerKm: true },
				},
				mileageAtPickup: true,
				mileageAtReturn: true,
				fuelLevelAtPickup: true,
				fuelLevelAtReturn: true,
				depositAmount: true,
				depositCurrency: true,
				depositMethod: true,
				depositStatus: true,
				depositReturnedAmount: true,
				depositReturnedAt: true,
				cancelledAt: true,
				cancelledReason: true,
				contractDocumentUrl: true,
				signedAt: true,
				notes: true,
				createdAt: true,
				vehicle: { select: VEHICLE_SELECT },
				contact: { select: CONTACT_SELECT },
				owner: { select: OWNER_SELECT },
				drivers: {
					select: { role: true, contact: { select: CONTACT_SELECT } },
					orderBy: { role: "asc" },
				},
			},
		});

		if (!contract) {
			throw new NotFoundException(`No rental contract with id ${id}.`);
		}

		const {
			drivers,
			totalAmount,
			baseAmount,
			fxRate,
			fxRateAt,
			pricePerDay,
			extraMileageFeePerKm,
			extraMileageAmount,
			mileageRules,
			depositAmount,
			depositReturnedAmount,
			startDate,
			endDate,
			pickupTime,
			returnTime,
			actualPickupAt,
			actualReturnAt,
			depositReturnedAt,
			cancelledAt,
			signedAt,
			createdAt,
			...rest
		} = contract;

		return {
			...rest,
			fields: await this.fields.valuesFor("RENTAL_CONTRACT", id),
			pricePerDayCents: toCents(pricePerDay),
			totalAmountCents: toCents(totalAmount),
			baseAmountCents: toCents(baseAmount),
			extraMileageFeePerKmCents: toCents(extraMileageFeePerKm),
			extraMileageAmountCents: toCents(extraMileageAmount),
			mileagePricingRules: mileageRules.map((rule) => ({
				kilometers: rule.kilometers,
				pricePerKmCents: toCents(rule.pricePerKm) ?? 0,
			})),
			depositAmountCents: toCents(depositAmount),
			depositReturnedAmountCents: toCents(depositReturnedAmount),
			reportingCurrency: await this.conversion.reportingCurrency(),
			fxRate: fxRate?.toNumber() ?? null,
			fxRateAt: fxRateAt?.toISOString() ?? null,
			startDate: startDate.toISOString(),
			endDate: endDate.toISOString(),
			pickupTime,
			returnTime,
			actualPickupAt: actualPickupAt?.toISOString() ?? null,
			actualReturnAt: actualReturnAt?.toISOString() ?? null,
			depositReturnedAt: depositReturnedAt?.toISOString() ?? null,
			cancelledAt: cancelledAt?.toISOString() ?? null,
			signedAt: signedAt?.toISOString() ?? null,
			createdAt: createdAt.toISOString(),
			isLate:
				contract.status === RentalContractStatus.ACTIVE && endDate < new Date(),
			drivers: drivers.map(({ role, contact }) => ({ ...contact, role })),
		};
	}

	async create(input: RentalContractCreateInput) {
		const startDate = requireDate(input.startDate);
		const endDate = requireDate(input.endDate);

		if (endDate <= startDate) {
			throw new BadRequestException(
				"The end date must be after the start date.",
			);
		}

		await this.assertAvailable(input.vehicleId, startDate, endDate);

		const currency = normalizeCurrency(
			input.currency ?? (await this.conversion.reportingCurrency()),
		);
		const pricePerDay =
			decimalFromCents(input.pricePerDayCents) ??
			new PrismaNamespace.Decimal(0);
		const totalAmount = pricePerDay.times(daysBetween(startDate, endDate));
		const fx = await this.conversion.convertFields(totalAmount, currency);

		const depositCurrency = normalizeCurrency(
			input.depositCurrency ?? currency,
		);
		const depositAmount =
			decimalFromCents(input.depositAmountCents) ??
			new PrismaNamespace.Decimal(0);

		try {
			const contract = await this.db.$transaction(async (tx) => {
				const created = await tx.rentalContract.create({
					data: {
						vehicleId: input.vehicleId,
						contactId: input.contactId,
						ownerId: input.ownerId,
						channel: input.channel,
						startDate,
						endDate,
						pickupTime: input.pickupTime ?? null,
						returnTime: input.returnTime ?? null,
						pricePerDay,
						currency,
						totalAmount,
						...fx,
						mileageIncludedPerDay: input.mileageIncludedPerDay ?? null,
						extraMileageFeePerKm: decimalFromCents(
							input.extraMileageFeePerKmCents,
						),
						depositAmount,
						depositCurrency,
						depositMethod: input.depositMethod ?? DepositMethod.NONE,
						notes: input.notes ?? null,
					},
					select: { id: true, vehicleId: true },
				});

				if (input.mileagePricingRules) {
					await tx.rentalContractMileageRule.createMany({
						data: input.mileagePricingRules.map((rule, position) => ({
							contractId: created.id,
							kilometers: rule.kilometers,
							pricePerKm:
								decimalFromCents(rule.pricePerKmCents) ??
								new PrismaNamespace.Decimal(0),
							position,
						})),
					});
				}

				await tx.rentalContractDriver.create({
					data: {
						contractId: created.id,
						contactId: input.contactId,
						role: DriverRole.PRIMARY,
					},
				});

				return created;
			});

			this.logger.log({
				message: "Rental contract created",
				rentalContractId: contract.id,
				vehicleId: contract.vehicleId,
			});

			return contract;
		} catch (error) {
			throw this.translateRelations(error);
		}
	}

	async update(id: string, input: RentalContractUpdateInput) {
		const current = await this.db.rentalContract.findUnique({
			where: { id },
			select: {
				vehicleId: true,
				startDate: true,
				endDate: true,
				pricePerDay: true,
				currency: true,
			},
		});

		if (!current) {
			throw new NotFoundException(`No rental contract with id ${id}.`);
		}

		const data: Prisma.RentalContractUpdateInput = {};
		let startDate = current.startDate;
		let endDate = current.endDate;
		let pricePerDay = current.pricePerDay;
		let currency = normalizeCurrency(current.currency);
		let recompute = false;

		if (input.startDate !== undefined) {
			startDate = requireDate(input.startDate);
			recompute = true;
		}
		if (input.endDate !== undefined) {
			endDate = requireDate(input.endDate);
			recompute = true;
		}
		if (input.pickupTime !== undefined) {
			data.pickupTime = input.pickupTime;
		}
		if (input.returnTime !== undefined) {
			data.returnTime = input.returnTime;
		}
		if (endDate <= startDate) {
			throw new BadRequestException(
				"The end date must be after the start date.",
			);
		}

		if (input.startDate !== undefined || input.endDate !== undefined) {
			await this.assertAvailable(current.vehicleId, startDate, endDate, id);
			data.startDate = startDate;
			data.endDate = endDate;
		}

		if (input.pricePerDayCents !== undefined) {
			pricePerDay = decimalFromCents(input.pricePerDayCents) ?? pricePerDay;
			data.pricePerDay = pricePerDay;
			recompute = true;
		}
		if (input.currency !== undefined) {
			currency = normalizeCurrency(input.currency);
			data.currency = currency;
			recompute = true;
		}
		if (input.mileageIncludedPerDay !== undefined) {
			data.mileageIncludedPerDay = input.mileageIncludedPerDay;
		}
		if (input.extraMileageFeePerKmCents !== undefined) {
			data.extraMileageFeePerKm = decimalFromCents(
				input.extraMileageFeePerKmCents,
			);
		}
		if (input.mileagePricingRules !== undefined) {
			data.mileageRules = {
				deleteMany: {},
				create: input.mileagePricingRules.map((rule, position) => ({
					kilometers: rule.kilometers,
					pricePerKm:
						decimalFromCents(rule.pricePerKmCents) ??
						new PrismaNamespace.Decimal(0),
					position,
				})),
			};
		}
		if (input.contractDocumentUrl !== undefined) {
			data.contractDocumentUrl = input.contractDocumentUrl;
		}
		if (input.notes !== undefined) data.notes = input.notes;

		if (recompute) {
			const totalAmount = pricePerDay.times(daysBetween(startDate, endDate));
			data.totalAmount = totalAmount;
			Object.assign(
				data,
				await this.conversion.convertFields(totalAmount, currency),
			);
		}

		try {
			return await this.db.$transaction(async (tx) => {
				if (input.fields) {
					await this.fields.applyValues(
						tx,
						"RENTAL_CONTRACT",
						id,
						input.fields,
					);
				}

				return tx.rentalContract.update({
					where: { id },
					data,
					select: { id: true },
				});
			});
		} catch (error) {
			throw this.translate(error, id);
		}
	}

	async delete(id: string): Promise<{ id: string }> {
		let deleted: { targets: StampTargets };

		try {
			deleted = await this.db.$transaction(async (tx) => {
				const targets = await this.stamp.targetsOf(
					{ rentalContractId: id },
					tx,
				);
				await tx.rentalContract.delete({ where: { id } });
				return { targets };
			});
		} catch (error) {
			throw this.translate(error, id);
		}

		await this.stamp.recomputeAfterDelete(deleted.targets, {
			rentalContractId: id,
		});

		this.logger.log({
			message: "Rental contract deleted",
			rentalContractId: id,
		});

		return { id };
	}

	async setStatus(input: SetRentalContractStatusInput, actingUserId: string) {
		const contract = await this.db.rentalContract.findUnique({
			where: { id: input.id },
			select: {
				id: true,
				status: true,
				vehicleId: true,
				contactId: true,
				startDate: true,
				endDate: true,
			},
		});

		if (!contract) {
			throw new NotFoundException(`No rental contract with id ${input.id}.`);
		}

		if (contract.status === input.status) {
			return { id: contract.id, status: contract.status, changed: false };
		}

		const cancelledReason = input.cancelledReason?.trim();
		if (input.status === RentalContractStatus.CANCELLED && !cancelledReason) {
			throw new BadRequestException(
				"Say why the contract was cancelled — it helps when a client disputes a deposit later.",
			);
		}

		if (
			(input.status === RentalContractStatus.RESERVED ||
				input.status === RentalContractStatus.ACTIVE) &&
			!ACTIVE_OR_PENDING.includes(contract.status)
		) {
			await this.assertAvailable(
				contract.vehicleId,
				contract.startDate,
				contract.endDate,
				contract.id,
			);
		}

		const now = new Date();

		const updated = await this.db.$transaction(async (tx) => {
			const row = await tx.rentalContract.update({
				where: { id: input.id },
				data: {
					status: input.status,
					cancelledAt:
						input.status === RentalContractStatus.CANCELLED ? now : null,
					cancelledReason:
						input.status === RentalContractStatus.CANCELLED
							? (cancelledReason ?? null)
							: null,
				},
				select: { id: true, status: true },
			});

			await tx.activity.create({
				data: {
					type: ActivityType.STAGE_CHANGE,
					subject: "Status changed",
					body: cancelledReason ?? null,
					occurredAt: now,
					rentalContractId: row.id,
					contactId: contract.contactId,
					createdById: actingUserId,
					meta: { from: contract.status, to: input.status },
				},
			});

			await this.syncVehicleStatus(tx, contract.vehicleId, input.status);

			return row;
		});

		await this.stamp.touch({ rentalContractId: contract.id }, now);

		this.logger.log({
			message: "Rental contract status changed",
			rentalContractId: contract.id,
			from: contract.status,
			to: input.status,
		});

		return { ...updated, changed: true };
	}

	async recordPickup(input: RecordPickupInput) {
		const contract = await this.db.rentalContract.findUnique({
			where: { id: input.id },
			select: { id: true, vehicleId: true },
		});

		if (!contract) {
			throw new NotFoundException(`No rental contract with id ${input.id}.`);
		}

		const actualPickupAt =
			parseDate(input.actualPickupAt ?? null) ?? new Date();

		const updated = await this.db.$transaction(async (tx) => {
			const row = await tx.rentalContract.update({
				where: { id: input.id },
				data: {
					mileageAtPickup: input.mileageAtPickup,
					fuelLevelAtPickup: input.fuelLevelAtPickup,
					actualPickupAt,
					status: RentalContractStatus.ACTIVE,
				},
				select: { id: true, status: true },
			});

			await this.syncVehicleStatus(
				tx,
				contract.vehicleId,
				RentalContractStatus.ACTIVE,
			);

			return row;
		});

		await this.stamp.touch({ rentalContractId: contract.id }, actualPickupAt);

		this.logger.log({
			message: "Rental contract pickup recorded",
			rentalContractId: contract.id,
		});

		return updated;
	}

	async recordReturn(input: RecordReturnInput) {
		const contract = await this.db.rentalContract.findUnique({
			where: { id: input.id },
			select: {
				id: true,
				vehicleId: true,
				startDate: true,
				endDate: true,
				pricePerDay: true,
				currency: true,
				mileageIncludedPerDay: true,
				extraMileageFeePerKm: true,
				mileageAtPickup: true,
				mileageRules: {
					orderBy: { position: "asc" },
					select: { kilometers: true, pricePerKm: true },
				},
			},
		});

		if (!contract) {
			throw new NotFoundException(`No rental contract with id ${input.id}.`);
		}

		const actualReturnAt =
			parseDate(input.actualReturnAt ?? null) ?? new Date();
		if (
			contract.mileageAtPickup !== null &&
			input.mileageAtReturn < contract.mileageAtPickup
		) {
			throw new BadRequestException(
				"The return mileage cannot be lower than the pickup mileage.",
			);
		}

		const extraAmount = extraMileageAmount(
			contract.mileageAtPickup === null
				? 0
				: input.mileageAtReturn - contract.mileageAtPickup,
			contract.mileageIncludedPerDay,
			daysBetween(contract.startDate, contract.endDate),
			contract.mileageRules,
			contract.extraMileageFeePerKm,
		);
		const rentalAmount = contract.pricePerDay.times(
			daysBetween(contract.startDate, contract.endDate),
		);
		const totalAmount = rentalAmount.plus(extraAmount);
		const fx = await this.conversion.convertFields(
			totalAmount,
			contract.currency,
		);

		const updated = await this.db.$transaction(async (tx) => {
			const row = await tx.rentalContract.update({
				where: { id: input.id },
				data: {
					mileageAtReturn: input.mileageAtReturn,
					fuelLevelAtReturn: input.fuelLevelAtReturn,
					actualReturnAt,
					status: RentalContractStatus.COMPLETED,
					extraMileageAmount: extraAmount,
					totalAmount,
					...fx,
				},
				select: { id: true, status: true },
			});

			await tx.vehicle.update({
				where: { id: contract.vehicleId },
				data: { mileage: input.mileageAtReturn },
			});

			await tx.vehicleMileageEntry.upsert({
				where: { contractId: contract.id },
				create: {
					vehicleId: contract.vehicleId,
					contractId: contract.id,
					mileage: input.mileageAtReturn,
					recordedAt: actualReturnAt,
				},
				update: {
					vehicleId: contract.vehicleId,
					mileage: input.mileageAtReturn,
					recordedAt: actualReturnAt,
				},
			});

			await this.syncVehicleStatus(
				tx,
				contract.vehicleId,
				RentalContractStatus.COMPLETED,
			);

			return row;
		});

		await this.stamp.touch({ rentalContractId: contract.id }, actualReturnAt);

		this.logger.log({
			message: "Rental contract return recorded",
			rentalContractId: contract.id,
		});

		return updated;
	}

	async setDepositStatus(input: SetDepositStatusInput) {
		const contract = await this.db.rentalContract.findUnique({
			where: { id: input.id },
			select: { depositStatus: true, depositAmount: true },
		});

		if (!contract) {
			throw new NotFoundException(`No rental contract with id ${input.id}.`);
		}

		if (contract.depositStatus !== DepositStatus.HELD) {
			throw new BadRequestException("This deposit has already been settled.");
		}

		const returnedAmount =
			input.depositStatus === DepositStatus.FORFEITED
				? new PrismaNamespace.Decimal(0)
				: decimalFromCents(input.depositReturnedAmountCents);

		if (
			input.depositStatus !== DepositStatus.FORFEITED &&
			returnedAmount === null
		) {
			throw new BadRequestException(
				"Say how much of the deposit is being returned.",
			);
		}

		if (returnedAmount?.greaterThan(contract.depositAmount)) {
			throw new BadRequestException(
				"That is more than the deposit that was held.",
			);
		}

		return this.db.rentalContract.update({
			where: { id: input.id },
			data: {
				depositStatus: input.depositStatus,
				depositReturnedAmount: returnedAmount,
				depositReturnedAt: new Date(),
			},
			select: { id: true, depositStatus: true },
		});
	}

	async driverOptions(contractId: string) {
		const contract = await this.db.rentalContract.findUnique({
			where: { id: contractId },
			select: { drivers: { select: { contactId: true } } },
		});

		if (!contract) {
			throw new NotFoundException(`No rental contract with id ${contractId}.`);
		}

		return this.db.contact.findMany({
			where: { id: { notIn: contract.drivers.map((row) => row.contactId) } },
			select: CONTACT_SELECT,
			orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
			take: 100,
		});
	}

	async attachDriver(input: AttachDriverInput) {
		const contact = await this.db.contact.findUnique({
			where: { id: input.contactId },
			select: { id: true },
		});

		if (!contact) {
			throw new NotFoundException(`No contact with id ${input.contactId}.`);
		}

		await this.db.rentalContractDriver.upsert({
			where: {
				contractId_contactId: {
					contractId: input.contractId,
					contactId: input.contactId,
				},
			},
			create: {
				contractId: input.contractId,
				contactId: input.contactId,
				role: input.role ?? DriverRole.ADDITIONAL,
			},
			update: input.role ? { role: input.role } : {},
		});

		return { contractId: input.contractId, contactId: input.contactId };
	}

	async detachDriver(input: DetachDriverInput) {
		const { count } = await this.db.rentalContractDriver.deleteMany({
			where: { contractId: input.contractId, contactId: input.contactId },
		});

		if (count === 0) {
			throw new NotFoundException(
				"That person is not a driver on this contract.",
			);
		}

		return { contractId: input.contractId, contactId: input.contactId };
	}

	async setDriverRole(input: SetDriverRoleInput) {
		const { count } = await this.db.rentalContractDriver.updateMany({
			where: { contractId: input.contractId, contactId: input.contactId },
			data: { role: input.role },
		});

		if (count === 0) {
			throw new NotFoundException(
				"That person is not a driver on this contract.",
			);
		}

		return {
			contractId: input.contractId,
			contactId: input.contactId,
			role: input.role,
		};
	}

	async bulkAssignOwner(
		input: RentalContractBulkOwnerInput,
	): Promise<BulkResult> {
		await requireOwner(this.db, input.ownerId);

		const ids = [...new Set(input.ids)];
		const { count } = await this.db.rentalContract.updateMany({
			where: { id: { in: ids } },
			data: { ownerId: input.ownerId },
		});

		return {
			requested: ids.length,
			succeeded: count,
			failed: ids.length - count,
			message: null,
		};
	}

	async bulkDelete(ids: string[]): Promise<BulkResult> {
		return runBulk(ids, (id) => this.delete(id));
	}

	private async assertAvailable(
		vehicleId: string,
		startDate: Date,
		endDate: Date,
		excludeContractId?: string,
	): Promise<void> {
		const [vehicle, conflict] = await Promise.all([
			this.db.vehicle.findUnique({
				where: { id: vehicleId },
				select: { status: true },
			}),
			this.db.rentalContract.findFirst({
				where: {
					vehicleId,
					id: excludeContractId ? { not: excludeContractId } : undefined,
					status: { in: ACTIVE_OR_PENDING },
					startDate: { lt: endDate },
					endDate: { gt: startDate },
				},
				select: { startDate: true, endDate: true },
			}),
		]);

		if (!vehicle) {
			throw new NotFoundException("The vehicle was not found.");
		}

		if (
			vehicle.status === VehicleStatus.MAINTENANCE ||
			vehicle.status === VehicleStatus.OUT_OF_SERVICE ||
			vehicle.status === VehicleStatus.STOLEN
		) {
			throw new ConflictException(
				"This vehicle is not available for a rental contract.",
			);
		}

		if (conflict) {
			throw new ConflictException(
				`This vehicle is already booked from ${conflict.startDate.toISOString().slice(0, 10)} to ${conflict.endDate.toISOString().slice(0, 10)}.`,
			);
		}
	}

	private async syncVehicleStatus(
		tx: Prisma.TransactionClient,
		vehicleId: string,
		status: RentalContractStatus,
	): Promise<void> {
		if (status === RentalContractStatus.RESERVED) {
			await tx.vehicle.update({
				where: { id: vehicleId },
				data: { status: VehicleStatus.RESERVED },
			});
			return;
		}

		if (status === RentalContractStatus.ACTIVE) {
			await tx.vehicle.update({
				where: { id: vehicleId },
				data: { status: VehicleStatus.RENTED },
			});
			return;
		}

		if (
			status === RentalContractStatus.COMPLETED ||
			status === RentalContractStatus.CANCELLED
		) {
			const [openIncident, blockingMaintenance] = await Promise.all([
				tx.incident.findFirst({
					where: { vehicleId, resolvedAt: null },
					select: { id: true },
				}),
				tx.maintenanceRecord.findFirst({
					where: { vehicleId, blocksAvailability: true, completedAt: null },
					select: { id: true },
				}),
			]);

			await tx.vehicle.update({
				where: { id: vehicleId },
				data: {
					status:
						openIncident || blockingMaintenance
							? VehicleStatus.MAINTENANCE
							: VehicleStatus.AVAILABLE,
				},
			});
		}
	}

	private searchFilter(q: string): Prisma.RentalContractWhereInput {
		const term = q.trim();
		if (!term) return {};

		return {
			OR: [
				{ vehicle: { plateNumber: { contains: term, mode: "insensitive" } } },
				{ vehicle: { make: { contains: term, mode: "insensitive" } } },
				{ vehicle: { model: { contains: term, mode: "insensitive" } } },
				{ contact: { firstName: { contains: term, mode: "insensitive" } } },
				{ contact: { lastName: { contains: term, mode: "insensitive" } } },
			],
		};
	}

	private buildWhere(
		input: RentalContractListInput,
	): Prisma.RentalContractWhereInput {
		const where: Prisma.RentalContractWhereInput = this.searchFilter(input.q);

		if (input.owner !== FACET_ALL) {
			where.ownerId =
				input.owner === FACET_UNASSIGNED ? { in: [] } : input.owner;
		}

		if (input.status !== FACET_ALL) {
			where.status = input.status as RentalContractStatus;
		}

		if (input.vehicle !== FACET_ALL) {
			where.vehicleId = input.vehicle;
		}

		if (input.channel !== FACET_ALL) {
			where.channel = input.channel as RentalChannel;
		}

		return where;
	}

	private async facetCounts(input: RentalContractListInput) {
		const where = this.searchFilter(input.q);

		const [owners, statuses, channels] = await Promise.all([
			this.db.rentalContract.groupBy({
				by: ["ownerId"],
				where,
				_count: { _all: true },
			}),
			this.db.rentalContract.groupBy({
				by: ["status"],
				where,
				_count: { _all: true },
			}),
			this.db.rentalContract.groupBy({
				by: ["channel"],
				where,
				_count: { _all: true },
			}),
		]);

		return {
			owner: countsByKey(owners, "ownerId", FACET_UNASSIGNED),
			status: countsByKey(statuses, "status"),
			channel: countsByKey(channels, "channel"),
		};
	}

	private translate(error: unknown, id: string): unknown {
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			error.code === "P2025"
		) {
			return new NotFoundException(`No rental contract with id ${id}.`);
		}
		return this.translateRelations(error);
	}

	private translateRelations(error: unknown): unknown {
		if (
			error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
			(error.code === "P2003" || error.code === "P2025")
		) {
			return new BadRequestException(
				"That vehicle, contact or owner does not exist any more.",
			);
		}
		return error;
	}
}
